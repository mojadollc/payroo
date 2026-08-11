// Migration: Firebase → PostgreSQL
// Run: node scripts/migrate-plain.mjs
// Requires: DATABASE_URL in .env

import { readFileSync } from "fs"
import { createRequire } from "module"
import { pathToFileURL } from "url"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..")

// ── Load .env manually ────────────────────────────────────────────────────────
const envPath = path.join(root, ".env")
try {
  const envContent = readFileSync(envPath, "utf8")
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "")
    if (!process.env[key]) process.env[key] = val
  }
} catch { console.warn("No .env file found, relying on environment variables") }

// ── Firebase client SDK (already installed as 'firebase') ────────────────────
import { initializeApp } from "firebase/app"
import { getFirestore, collection, getDocs } from "firebase/firestore"

// ── pg ────────────────────────────────────────────────────────────────────────
import pg from "pg"
const { Pool } = pg

// ── Firebase config from serviceAccountKey.json ───────────────────────────────
const svcPath = path.join(root, "serviceAccountKey.json")
const svc = JSON.parse(readFileSync(svcPath, "utf8"))

// Build Firebase client config from service account fields
const projectId = svc.project_id
const firebaseApp = initializeApp({
  apiKey: "migration-script",   // not needed for Firestore Admin-equivalent reads
  projectId,
})
const firestore = getFirestore(firebaseApp)

// ── PostgreSQL ────────────────────────────────────────────────────────────────
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

function toDate(v) {
  if (!v) return null
  if (v instanceof Date) return v
  if (typeof v.toDate === "function") return v.toDate()
  if (v._seconds) return new Date(v._seconds * 1000)
  if (typeof v === "string" || typeof v === "number") return new Date(v)
  return null
}
function toDateReq(v) { return toDate(v) || new Date() }

async function fetchAll(col) {
  const snap = await getDocs(collection(firestore, col))
  return snap.docs.map(d => ({ _id: d.id, ...d.data() }))
}

// ── Migrate Categories ────────────────────────────────────────────────────────
async function migrateCategories() {
  const docs = await fetchAll("categories")
  console.log(`categories: ${docs.length} found`)
  let n = 0
  for (const d of docs) {
    if (!d.storeId) continue
    await pool.query(
      `INSERT INTO categories (id, "storeId", name, description, "createdAt")
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [d._id, d.storeId, d.name || "", d.description || null, toDateReq(d.createdAt)]
    )
    n++
  }
  console.log(`categories: ${n} upserted`)
}

// ── Migrate Products ──────────────────────────────────────────────────────────
async function migrateProducts() {
  const docs = await fetchAll("products")
  console.log(`products: ${docs.length} found`)
  let n = 0
  for (const d of docs) {
    if (!d.storeId) continue
    await pool.query(
      `INSERT INTO products (id, "storeId", name, barcode, price, cost, stock, category,
        "imageUrl", description, unit, "onSale", "salePrice", sku, weight, variants,
        "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       ON CONFLICT (id) DO UPDATE SET
         name=EXCLUDED.name, price=EXCLUDED.price, cost=EXCLUDED.cost,
         stock=EXCLUDED.stock, category=EXCLUDED.category, barcode=EXCLUDED.barcode`,
      [
        d._id, d.storeId, d.name || "", d.barcode || "",
        d.price || 0, d.cost || 0, d.stock || 0, d.category || "",
        d.imageUrl || null, d.description || null, d.unit || null,
        d.onSale || false, d.salePrice || null, d.sku || null,
        d.weight || null,
        d.variants ? JSON.stringify(d.variants) : null,
        toDateReq(d.createdAt), toDateReq(d.updatedAt),
      ]
    )
    n++
  }
  console.log(`products: ${n} upserted`)
}

// ── Migrate Sales ─────────────────────────────────────────────────────────────
async function migrateSales() {
  const docs = await fetchAll("sales")
  console.log(`sales: ${docs.length} found`)
  const { rows: existingProducts } = await pool.query(`SELECT id FROM products`)
  const productIds = new Set(existingProducts.map(p => p.id))
  let inserted = 0, existed = 0, skipped = 0

  for (const d of docs) {
    if (!d.storeId) { skipped++; continue }
    const { rows } = await pool.query(`SELECT id FROM sales WHERE id=$1`, [d._id])
    if (rows.length) { existed++; continue }

    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      await client.query(
        `INSERT INTO sales (id, "storeId", total, profit, "paymentMethod", status, "voidedAt", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          d._id, d.storeId, d.total || 0, d.profit || 0,
          d.paymentMethod || "cash", d.status || "completed",
          toDate(d.voidedAt), toDateReq(d.createdAt), toDateReq(d.updatedAt || d.createdAt),
        ]
      )
      const items = (d.items || []).filter(i => productIds.has(i.productId))
      for (const i of items) {
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
      console.warn(`  sale ${d._id} skipped: ${err.message}`)
      skipped++
    } finally {
      client.release()
    }
  }
  console.log(`sales: ${inserted} inserted, ${existed} already existed, ${skipped} skipped`)
}

// ── Migrate E-Wallet ──────────────────────────────────────────────────────────
async function migrateEWallet() {
  const docs = await fetchAll("ewalletTransactions")
  console.log(`ewallet: ${docs.length} found`)
  let n = 0
  for (const d of docs) {
    if (!d.storeId) continue
    await pool.query(
      `INSERT INTO ewallet_transactions
         (id, "storeId", type, provider, amount, commission, "commissionRate", profit,
          "customerName", "customerNumber", "referenceNumber", status, "createdAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (id) DO NOTHING`,
      [
        d._id, d.storeId, d.type, d.provider,
        d.amount || 0, d.commission || 0, d.commissionRate || 0, d.profit || 0,
        d.customerName || null, d.customerNumber || null,
        d.referenceNumber || "", d.status || "completed",
        toDateReq(d.createdAt),
      ]
    )
    n++
  }
  console.log(`ewallet: ${n} upserted`)
}

// ── Migrate Inventory Transactions ───────────────────────────────────────────
async function migrateInventory() {
  const docs = await fetchAll("inventoryTransactions")
  console.log(`inventory_transactions: ${docs.length} found`)
  const { rows: existingProducts } = await pool.query(`SELECT id FROM products`)
  const productIds = new Set(existingProducts.map(p => p.id))
  let n = 0
  for (const d of docs) {
    if (!d.storeId || !productIds.has(d.productId)) continue
    await pool.query(
      `INSERT INTO inventory_transactions
         (id, "storeId", "productId", "productName", type, quantity, "previousStock", "newStock", notes, "createdAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO NOTHING`,
      [
        d._id, d.storeId, d.productId, d.productName || "",
        d.type || "adjustment", d.quantity || 0,
        d.previousStock || 0, d.newStock || 0,
        d.notes || null, toDateReq(d.createdAt),
      ]
    )
    n++
  }
  console.log(`inventory_transactions: ${n} upserted`)
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🚀 Migrating Firebase → PostgreSQL...\n")
  try {
    await migrateCategories()
    await migrateProducts()
    await migrateSales()
    await migrateEWallet()
    await migrateInventory()

    const counts = await Promise.all([
      pool.query("SELECT COUNT(*) FROM products"),
      pool.query("SELECT COUNT(*) FROM sales"),
      pool.query("SELECT COUNT(*) FROM ewallet_transactions"),
      pool.query("SELECT COUNT(*) FROM inventory_transactions"),
    ])
    console.log("\n── Final counts in PostgreSQL ──")
    console.log(`  Products:               ${counts[0].rows[0].count}`)
    console.log(`  Sales:                  ${counts[1].rows[0].count}`)
    console.log(`  E-Wallet Transactions:  ${counts[2].rows[0].count}`)
    console.log(`  Inventory Transactions: ${counts[3].rows[0].count}`)
    console.log("\n✅ Migration complete!")
  } catch (err) {
    console.error("❌ Error:", err.message)
    console.error(err.stack)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
