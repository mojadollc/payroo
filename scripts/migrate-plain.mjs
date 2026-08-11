// Migration: Firebase → PostgreSQL
// Run: node scripts/migrate-plain.mjs
// Requires: NEXT_PUBLIC_FIREBASE_* and DATABASE_URL in .env

import { readFileSync } from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..")

// ── Load .env ─────────────────────────────────────────────────────────────────
try {
  const envContent = readFileSync(path.join(root, ".env"), "utf8")
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "")
    if (!process.env[key]) process.env[key] = val
  }
} catch { console.warn("No .env file found") }

// ── Firebase client SDK ───────────────────────────────────────────────────────
import { initializeApp } from "firebase/app"
import { getFirestore, collection, getDocs } from "firebase/firestore"

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error("❌ Missing NEXT_PUBLIC_FIREBASE_* env vars. Check your .env file.")
  process.exit(1)
}

const firebaseApp = initializeApp(firebaseConfig)
const firestore = getFirestore(firebaseApp)

// ── PostgreSQL ────────────────────────────────────────────────────────────────
import pg from "pg"
const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// ── Helpers ───────────────────────────────────────────────────────────────────
function toDate(v) {
  if (!v) return null
  if (v instanceof Date) return v
  if (typeof v.toDate === "function") return v.toDate()
  if (v._seconds !== undefined) return new Date(v._seconds * 1000)
  if (typeof v === "string" || typeof v === "number") return new Date(v)
  return null
}
function toDateReq(v) { return toDate(v) || new Date() }

async function fetchAll(col) {
  const snap = await getDocs(collection(firestore, col))
  return snap.docs.map(d => ({ _id: d.id, ...d.data() }))
}

// ── 1. Categories ─────────────────────────────────────────────────────────────
async function migrateCategories() {
  const docs = await fetchAll("categories")
  console.log(`\ncategories: ${docs.length} found in Firebase`)
  let n = 0, skipped = 0
  for (const d of docs) {
    if (!d.storeId) { skipped++; continue }
    await pool.query(
      `INSERT INTO categories (id, "storeId", name, description, "createdAt")
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description`,
      [d._id, d.storeId, d.name || "", d.description || null, toDateReq(d.createdAt)]
    )
    n++
  }
  console.log(`categories: ${n} upserted, ${skipped} skipped (no storeId)`)
}

// ── 2. Products (with stock) ──────────────────────────────────────────────────
async function migrateProducts() {
  const docs = await fetchAll("products")
  console.log(`\nproducts: ${docs.length} found in Firebase`)
  let n = 0, skipped = 0
  for (const d of docs) {
    if (!d.storeId) { skipped++; continue }
    await pool.query(
      `INSERT INTO products (
         id, "storeId", name, barcode, price, cost, stock, category,
         "imageUrl", description, unit, "onSale", "salePrice", sku,
         weight, variants, "createdAt", "updatedAt"
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       ON CONFLICT (id) DO UPDATE SET
         name        = EXCLUDED.name,
         barcode     = EXCLUDED.barcode,
         price       = EXCLUDED.price,
         cost        = EXCLUDED.cost,
         stock       = EXCLUDED.stock,
         category    = EXCLUDED.category,
         "imageUrl"  = EXCLUDED."imageUrl",
         description = EXCLUDED.description,
         unit        = EXCLUDED.unit,
         "onSale"    = EXCLUDED."onSale",
         "salePrice" = EXCLUDED."salePrice",
         sku         = EXCLUDED.sku,
         weight      = EXCLUDED.weight,
         variants    = EXCLUDED.variants,
         "updatedAt" = EXCLUDED."updatedAt"`,
      [
        d._id, d.storeId, d.name || "", d.barcode || "",
        d.price || 0, d.cost || 0, d.stock || 0, d.category || "",
        d.imageUrl || null, d.description || null, d.unit || null,
        d.onSale || false, d.salePrice || null, d.sku || null,
        d.weight || null,
        d.variants ? JSON.stringify(d.variants) : null,
        toDateReq(d.createdAt), toDateReq(d.updatedAt || d.createdAt),
      ]
    )
    n++
  }
  console.log(`products: ${n} upserted, ${skipped} skipped (no storeId)`)
}

// ── 3. Sales ──────────────────────────────────────────────────────────────────
// IMPORTANT: We do NOT filter sale items by productId.
// Items reference products that must exist — we insert a "ghost" product row
// for any missing productId so FK constraints don't block the sale.
async function migrateSales() {
  const docs = await fetchAll("sales")
  console.log(`\nsales: ${docs.length} found in Firebase`)

  // Build set of all product IDs currently in PG
  const { rows: pgProds } = await pool.query(`SELECT id, "storeId" FROM products`)
  const productIds = new Set(pgProds.map(p => p.id))
  // storeId lookup for ghost products
  const productStoreMap = Object.fromEntries(pgProds.map(p => [p.id, p.storeId]))

  let inserted = 0, existed = 0, skipped = 0, ghostsCreated = 0

  for (const d of docs) {
    if (!d.storeId) { skipped++; continue }

    // Check already exists
    const { rows } = await pool.query(`SELECT id FROM sales WHERE id=$1`, [d._id])
    if (rows.length) { existed++; continue }

    const items = d.items || []

    // Create ghost product rows for any missing productIds so FK doesn't fail
    for (const item of items) {
      if (item.productId && !productIds.has(item.productId)) {
        await pool.query(
          `INSERT INTO products (id, "storeId", name, barcode, price, cost, stock, category, "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
           ON CONFLICT (id) DO NOTHING`,
          [item.productId, d.storeId, item.productName || "Deleted Product", "", item.price || 0, item.cost || 0, 0, ""]
        )
        productIds.add(item.productId)
        ghostsCreated++
      }
    }

    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      await client.query(
        `INSERT INTO sales (id, "storeId", total, profit, "paymentMethod", status, "voidedAt", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          d._id, d.storeId,
          d.total || 0,
          d.profit || 0,
          d.paymentMethod || "cash",
          d.status || "completed",
          toDate(d.voidedAt),
          toDateReq(d.createdAt),
          toDateReq(d.updatedAt || d.createdAt),
        ]
      )
      for (const i of items) {
        if (!i.productId) continue
        await client.query(
          `INSERT INTO sale_items (id, "saleId", "productId", "productName", quantity, price, cost, subtotal, "selectedVariants")
           VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            d._id, i.productId, i.productName || "",
            i.quantity || 1, i.price || 0, i.cost || 0, i.subtotal || 0,
            i.selectedVariants ? JSON.stringify(i.selectedVariants) : null,
          ]
        )
      }
      await client.query("COMMIT")
      inserted++
    } catch (err) {
      await client.query("ROLLBACK")
      console.warn(`  ⚠ sale ${d._id} skipped: ${err.message}`)
      skipped++
    } finally {
      client.release()
    }
  }
  if (ghostsCreated > 0) console.log(`  (created ${ghostsCreated} ghost product rows for deleted products)`)
  console.log(`sales: ${inserted} inserted, ${existed} already existed, ${skipped} skipped`)
}

// ── 4. E-Wallet Transactions ──────────────────────────────────────────────────
async function migrateEWallet() {
  const docs = await fetchAll("ewalletTransactions")
  console.log(`\newallet: ${docs.length} found in Firebase`)
  let n = 0, skipped = 0
  for (const d of docs) {
    if (!d.storeId) { skipped++; continue }
    // Validate enums
    const type = ["cashin","cashout","load"].includes(d.type) ? d.type : "cashin"
    const provider = ["gcash","maya"].includes(d.provider) ? d.provider : "gcash"
    const status = ["completed","pending","failed"].includes(d.status) ? d.status : "completed"
    await pool.query(
      `INSERT INTO ewallet_transactions
         (id, "storeId", type, provider, amount, commission, "commissionRate", profit,
          "customerName", "customerNumber", "referenceNumber", status, "createdAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (id) DO UPDATE SET
         amount          = EXCLUDED.amount,
         commission      = EXCLUDED.commission,
         "commissionRate"= EXCLUDED."commissionRate",
         profit          = EXCLUDED.profit,
         status          = EXCLUDED.status`,
      [
        d._id, d.storeId, type, provider,
        d.amount || 0, d.commission || 0, d.commissionRate || 0, d.profit || 0,
        d.customerName || null, d.customerNumber || null,
        d.referenceNumber || "", status,
        toDateReq(d.createdAt),
      ]
    )
    n++
  }
  console.log(`ewallet: ${n} upserted, ${skipped} skipped (no storeId)`)
}

// ── 5. Inventory Transactions ─────────────────────────────────────────────────
async function migrateInventory() {
  const docs = await fetchAll("inventoryTransactions")
  console.log(`\ninventory_transactions: ${docs.length} found in Firebase`)

  const { rows: pgProds } = await pool.query(`SELECT id FROM products`)
  const productIds = new Set(pgProds.map(p => p.id))

  let n = 0, skipped = 0
  for (const d of docs) {
    if (!d.storeId) { skipped++; continue }
    if (!d.productId || !productIds.has(d.productId)) { skipped++; continue }
    const type = ["restock","sale","adjustment","void"].includes(d.type) ? d.type : "adjustment"
    await pool.query(
      `INSERT INTO inventory_transactions
         (id, "storeId", "productId", "productName", type, quantity,
          "previousStock", "newStock", notes, "createdAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO NOTHING`,
      [
        d._id, d.storeId, d.productId, d.productName || "",
        type, d.quantity || 0,
        d.previousStock || 0, d.newStock || 0,
        d.notes || null, toDateReq(d.createdAt),
      ]
    )
    n++
  }
  console.log(`inventory_transactions: ${n} upserted, ${skipped} skipped`)
}

// ── Verification ─────────────────────────────────────────────────────────────
async function verify() {
  const [fbProds, fbSales, fbEwallet, fbInv] = await Promise.all([
    fetchAll("products"),
    fetchAll("sales"),
    fetchAll("ewalletTransactions"),
    fetchAll("inventoryTransactions"),
  ])

  // Firebase sets (storeId filter)
  const fbProdIds = new Set(fbProds.filter(d => d.storeId).map(d => d._id))
  const fbSaleIds = new Set(fbSales.filter(d => d.storeId).map(d => d._id))
  const fbEwIds   = new Set(fbEwallet.filter(d => d.storeId).map(d => d._id))

  const fbSalesRevenue = fbSales
    .filter(d => d.storeId && d.status !== "voided")
    .reduce((s, d) => s + (d.total || 0), 0)
  const fbEwRevenue = fbEwallet
    .filter(d => d.storeId)
    .reduce((s, d) => s + (d.amount || 0), 0)

  // PG IDs
  const [pgProdIdRows, pgSaleIdRows, pgEwIdRows] = await Promise.all([
    pool.query(`SELECT id FROM products`),
    pool.query(`SELECT id FROM sales`),
    pool.query(`SELECT id FROM ewallet_transactions`),
  ])
  const pgProdIdSet = new Set(pgProdIdRows.rows.map(r => r.id))
  const pgSaleIdSet = new Set(pgSaleIdRows.rows.map(r => r.id))
  const pgEwIdSet   = new Set(pgEwIdRows.rows.map(r => r.id))

  // Records in Firebase but missing from PG
  const missingSales = fbSales.filter(d => d.storeId && !pgSaleIdSet.has(d._id))
  const missingEw    = fbEwallet.filter(d => d.storeId && !pgEwIdSet.has(d._id))
  const missingProds = fbProds.filter(d => d.storeId && !pgProdIdSet.has(d._id))

  // Records in PG but NOT in Firebase (created on new app after migration)
  const pgOnlySales = pgSaleIdRows.rows.filter(r => !fbSaleIds.has(r.id)).length
  const pgOnlyEw    = pgEwIdRows.rows.filter(r => !fbEwIds.has(r.id)).length
  const pgOnlyProds = pgProdIdRows.rows.filter(r => !fbProdIds.has(r.id)).length

  // Apples-to-apples revenue: only Firebase IDs that exist in PG
  const fbMigratedSaleIds = fbSales
    .filter(d => d.storeId && d.status !== "voided" && pgSaleIdSet.has(d._id))
    .map(d => d._id)
  const fbMigratedRevenue = fbSales
    .filter(d => d.storeId && d.status !== "voided" && pgSaleIdSet.has(d._id))
    .reduce((s, d) => s + (d.total || 0), 0)
  const { rows: pgMigRevRows } = await pool.query(
    `SELECT COALESCE(SUM(total),0) as rev FROM sales WHERE status != 'voided' AND id = ANY($1::text[])`,
    [fbMigratedSaleIds]
  )
  const pgMigratedRevenue = parseFloat(pgMigRevRows[0].rev)

  const fbMigratedEwIds = fbEwallet.filter(d => d.storeId && pgEwIdSet.has(d._id)).map(d => d._id)
  const fbMigratedEwRevenue = fbEwallet
    .filter(d => d.storeId && pgEwIdSet.has(d._id))
    .reduce((s, d) => s + (d.amount || 0), 0)
  const { rows: pgMigEwRows } = await pool.query(
    `SELECT COALESCE(SUM(amount),0) as rev FROM ewallet_transactions WHERE id = ANY($1::text[])`,
    [fbMigratedEwIds]
  )
  const pgMigratedEwRevenue = parseFloat(pgMigEwRows[0].rev)

  const line = "═".repeat(62)
  const dash = "─".repeat(62)
  console.log(`\n${line}`)
  console.log("  VERIFICATION")
  console.log(line)

  const row = (label, fb, pg, note = "") =>
    console.log(`  ${label.padEnd(30)} ${String(fb).padStart(8)} ${String(pg).padStart(10)}  ${note}`)
  const rowAmt = (label, fb, pg, note = "") =>
    console.log(`  ${label.padEnd(30)} ${fb.toFixed(2).padStart(8)} ${pg.toFixed(2).padStart(10)}  ${note}`)

  console.log(`\n  ${"Label".padEnd(30)} ${"Firebase".padStart(8)} ${"PostgreSQL".padStart(10)}`)
  console.log(`  ${dash}`)

  row("Products", fbProdIds.size, pgProdIdRows.rows.length,
    pgOnlyProds > 0 ? `(+${pgOnlyProds} new on pntos)` : "")
  row("Sales", fbSaleIds.size, pgSaleIdRows.rows.length,
    pgOnlySales > 0 ? `(+${pgOnlySales} new on pntos)` : "")
  row("E-Wallet txns", fbEwIds.size, pgEwIdRows.rows.length,
    pgOnlyEw > 0 ? `(+${pgOnlyEw} new on pntos)` : "")

  console.log(`\n  ${"-".repeat(62)}`)
  console.log("  Revenue (migrated records only — apples-to-apples):")
  console.log(`  ${"-".repeat(62)}`)
  rowAmt("Sales Revenue", fbMigratedRevenue, pgMigratedRevenue,
    Math.abs(fbMigratedRevenue - pgMigratedRevenue) < 0.01 ? "✅ exact match" : "❌ MISMATCH")
  rowAmt("E-Wallet Revenue", fbMigratedEwRevenue, pgMigratedEwRevenue,
    Math.abs(fbMigratedEwRevenue - pgMigratedEwRevenue) < 0.01 ? "✅ exact match" : "❌ MISMATCH")

  console.log(`\n  ${"-".repeat(62)}`)
  console.log("  Migration completeness:")
  console.log(`  ${"-".repeat(62)}`)
  if (missingSales.length === 0)  console.log("  ✅ All Firebase sales present in PG")
  else console.log(`  ❌ ${missingSales.length} Firebase sales MISSING from PG`)

  if (missingEw.length === 0)     console.log("  ✅ All Firebase e-wallet txns present in PG")
  else console.log(`  ❌ ${missingEw.length} Firebase e-wallet txns MISSING from PG`)

  if (missingProds.length === 0)  console.log("  ✅ All Firebase products present in PG")
  else console.log(`  ⚠️  ${missingProds.length} Firebase products missing from PG: ${missingProds.map(d => d.name || d._id).join(", ")}`)

  console.log(`${line}\n`)
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🚀 Migrating Firebase → PostgreSQL...\n")
  console.log(`   Firebase project: ${firebaseConfig.projectId}`)
  console.log(`   PostgreSQL:       ${process.env.DATABASE_URL?.split("@")[1] || "connected"}\n`)

  try {
    await migrateCategories()
    await migrateProducts()
    await migrateSales()
    await migrateEWallet()
    await migrateInventory()
    await verify()
  } catch (err) {
    console.error("❌ Fatal error:", err.message)
    console.error(err.stack)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
