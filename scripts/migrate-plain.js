// Plain JS — run with: node scripts/migrate-plain.js
require("dotenv/config")

const admin = require("firebase-admin")
const { PrismaClient } = require("@prisma/client")
const fs = require("fs")
const path = require("path")

const serviceAccount = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "serviceAccountKey.json"), "utf8")
)

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })

const db     = admin.firestore()
const prisma = new PrismaClient()

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
  const snap = await db.collection(col).get()
  return snap.docs.map(d => ({ _id: d.id, ...d.data() }))
}

async function migrateCategories() {
  const docs = await fetchAll("categories")
  console.log(`categories: ${docs.length} found`)
  for (const d of docs) {
    if (!d.storeId) continue
    await prisma.category.upsert({
      where: { id: d._id },
      update: { name: d.name || "" },
      create: { id: d._id, storeId: d.storeId, name: d.name || "", description: d.description || null, createdAt: toDateReq(d.createdAt) },
    })
  }
  console.log("categories: done")
}

async function migrateProducts() {
  const docs = await fetchAll("products")
  console.log(`products: ${docs.length} found`)
  let n = 0
  for (const d of docs) {
    if (!d.storeId) continue
    await prisma.product.upsert({
      where: { id: d._id },
      update: { name: d.name||"", price: d.price||0, cost: d.cost||0, stock: d.stock||0, category: d.category||"", barcode: d.barcode||"" },
      create: {
        id: d._id, storeId: d.storeId, name: d.name||"", barcode: d.barcode||"",
        price: d.price||0, cost: d.cost||0, stock: d.stock||0, category: d.category||"",
        imageUrl: d.imageUrl||null, description: d.description||null, unit: d.unit||null,
        onSale: d.onSale||false, salePrice: d.salePrice||null, sku: d.sku||null,
        weight: d.weight||null, dimensions: d.dimensions||null, shippingClass: d.shippingClass||null,
        variants: d.variants||null, createdAt: toDateReq(d.createdAt), updatedAt: toDateReq(d.updatedAt),
      },
    })
    n++
  }
  console.log(`products: ${n} upserted`)
}

async function migrateSales() {
  const docs = await fetchAll("sales")
  console.log(`sales: ${docs.length} found`)
  const products = await prisma.product.findMany({ select: { id: true } })
  const productIds = new Set(products.map(p => p.id))
  let inserted = 0, skipped = 0, existed = 0
  for (const d of docs) {
    if (!d.storeId) { skipped++; continue }
    const already = await prisma.sale.findUnique({ where: { id: d._id } })
    if (already) { existed++; continue }
    const items = (d.items || []).filter(i => productIds.has(i.productId))
    await prisma.sale.create({
      data: {
        id: d._id, storeId: d.storeId, total: d.total||0, profit: d.profit||0,
        paymentMethod: d.paymentMethod||"cash", status: d.status||"completed",
        voidedAt: toDate(d.voidedAt), createdAt: toDateReq(d.createdAt), updatedAt: toDateReq(d.updatedAt||d.createdAt),
        items: {
          create: items.map(i => ({
            productId: i.productId, productName: i.productName||"",
            quantity: i.quantity||1, price: i.price||0, cost: i.cost||0,
            subtotal: i.subtotal||0, selectedVariants: i.selectedVariants||null,
          })),
        },
      },
    })
    inserted++
  }
  console.log(`sales: ${inserted} inserted, ${existed} already existed, ${skipped} skipped`)
}

async function migrateEWallet() {
  const docs = await fetchAll("ewalletTransactions")
  console.log(`ewallet: ${docs.length} found`)
  let n = 0
  for (const d of docs) {
    if (!d.storeId) continue
    await prisma.eWalletTransaction.upsert({
      where: { id: d._id },
      update: {},
      create: {
        id: d._id, storeId: d.storeId, type: d.type, provider: d.provider,
        amount: d.amount||0, commission: d.commission||0, commissionRate: d.commissionRate||0,
        profit: d.profit||0, customerName: d.customerName||null, customerNumber: d.customerNumber||null,
        referenceNumber: d.referenceNumber||"", status: d.status||"completed",
        createdAt: toDateReq(d.createdAt),
      },
    })
    n++
  }
  console.log(`ewallet: ${n} upserted`)
}

async function migrateInventory() {
  const docs = await fetchAll("inventoryTransactions")
  console.log(`inventory_transactions: ${docs.length} found`)
  const products = await prisma.product.findMany({ select: { id: true } })
  const productIds = new Set(products.map(p => p.id))
  let n = 0
  for (const d of docs) {
    if (!d.storeId || !productIds.has(d.productId)) continue
    await prisma.inventoryTransaction.upsert({
      where: { id: d._id },
      update: {},
      create: {
        id: d._id, storeId: d.storeId, productId: d.productId, productName: d.productName||"",
        type: d.type||"adjustment", quantity: d.quantity||0, previousStock: d.previousStock||0,
        newStock: d.newStock||0, notes: d.notes||null, createdAt: toDateReq(d.createdAt),
      },
    })
    n++
  }
  console.log(`inventory_transactions: ${n} upserted`)
}

async function main() {
  console.log("🚀 Migrating Firebase → PostgreSQL...\n")
  try {
    await migrateCategories()
    await migrateProducts()
    await migrateSales()
    await migrateEWallet()
    await migrateInventory()

    const [p, s, e, i] = await Promise.all([
      prisma.product.count(), prisma.sale.count(),
      prisma.eWalletTransaction.count(), prisma.inventoryTransaction.count(),
    ])
    console.log("\n── Final counts in PostgreSQL ──")
    console.log(`  Products:               ${p}`)
    console.log(`  Sales:                  ${s}`)
    console.log(`  E-Wallet Transactions:  ${e}`)
    console.log(`  Inventory Transactions: ${i}`)
    console.log("\n✅ Migration complete!")
  } catch (err) {
    console.error("❌ Error:", err.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
