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

// ── Verification: compare Firebase vs PostgreSQL counts ───────────────────────
async function verify() {
  const [fbProds, fbSales, fbEwallet, fbInv] = await Promise.all([
    fetchAll("products"),
    fetchAll("sales"),
    fetchAll("ewalletTransactions"),
    fetchAll("inventoryTransactions"),
  ])

  const [pgProds, pgSales, pgEwallet, pgInv] = await Promise.all([
    pool.query("SELECT COUNT(*) FROM products"),
    pool.query("SELECT COUNT(*) FROM sales"),
    pool.query("SELECT COUNT(*) FROM ewallet_transactions"),
    pool.query("SELECT COUNT(*) FROM inventory_transactions"),
  ])

  // Firebase counts (with storeId only — same filter as migration)
  const fbProdCount  = fbProds.filter(d => d.storeId).length
  const fbSaleCount  = fbSales.filter(d => d.storeId).length
  const fbEwCount    = fbEwallet.filter(d => d.storeId).length
  const fbInvCount   = fbInv.filter(d => d.storeId).length

  const pgProdCount  = parseInt(pgProds.rows[0].count)
  const pgSaleCount  = parseInt(pgSales.rows[0].count)
  const pgEwCount    = parseInt(pgEwallet.rows[0].count)
  const pgInvCount   = parseInt(pgInv.rows[0].count)

  // Revenue totals
  const fbSalesRevenue = fbSales
    .filter(d => d.storeId && d.status !== "voided")
    .reduce((s, d) => s + (d.total || 0), 0)
  const { rows: pgRevRows } = await pool.query(
    `SELECT COALESCE(SUM(total),0) as rev FROM sales WHERE status != 'voided'`
  )
  const pgSalesRevenue = parseFloat(pgRevRows[0].rev)

  const fbEwRevenue = fbEwallet
    .filter(d => d.storeId)
    .reduce((s, d) => s + (d.amount || 0), 0)
  const { rows: pgEwRevRows } = await pool.query(
    `SELECT COALESCE(SUM(amount),0) as rev FROM ewallet_transactions`
  )
  const pgEwRevenue = parseFloat(pgEwRevRows[0].rev)

  console.log("\n══════════════════════════════════════════════")
  console.log("  VERIFICATION: Firebase vs PostgreSQL")
  console.log("══════════════════════════════════════════════")
  console.log(`  ${"".padEnd(28)} ${"Firebase".padStart(10)} ${"PostgreSQL".padStart(12)} ${"Match?".padStart(8)}`)
  console.log(`  ${"─".repeat(60)}`)

  const row = (label, fb, pg) => {
    const match = fb === pg ? "✅" : "❌"
    console.log(`  ${label.padEnd(28)} ${String(fb).padStart(10)} ${String(pg).padStart(12)} ${match.padStart(8)}`)
  }
  const rowAmt = (label, fb, pg) => {
    const match = Math.abs(fb - pg) < 0.01 ? "✅" : "❌"
    console.log(`  ${label.padEnd(28)} ${fb.toFixed(2).padStart(10)} ${pg.toFixed(2).padStart(12)} ${match.padStart(8)}`)
  }

  row("Products (count)",          fbProdCount,  pgProdCount)
  row("Sales (count)",             fbSaleCount,  pgSaleCount)
  row("E-Wallet txns (count)",     fbEwCount,    pgEwCount)
  row("Inventory txns (count)",    fbInvCount,   pgInvCount)
  rowAmt("Sales Revenue (active)", fbSalesRevenue, pgSalesRevenue)
  rowAmt("E-Wallet Revenue",       fbEwRevenue,    pgEwRevenue)

  console.log("══════════════════════════════════════════════\n")

  const allMatch =
    fbProdCount === pgProdCount &&
    fbSaleCount === pgSaleCount &&
    fbEwCount   === pgEwCount   &&
    Math.abs(fbSalesRevenue - pgSalesRevenue) < 0.01 &&
    Math.abs(fbEwRevenue    - pgEwRevenue)    < 0.01

  if (allMatch) {
    console.log("✅ All counts and totals match!")
  } else {
    console.log("⚠️  Some numbers don't match — check warnings above.")
    console.log("   Re-run the script to retry failed records.")
  }
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
