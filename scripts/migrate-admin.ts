/**
 * Firebase Admin → PostgreSQL Migration
 * Works on VPS/server (uses service account, not browser auth)
 * Run: npx tsx scripts/migrate-admin.ts
 */

import "dotenv/config"
import admin from "firebase-admin"
import { PrismaClient } from "@prisma/client"
import * as fs from "fs"
import * as path from "path"

// ─── Init Firebase Admin ──────────────────────────────────────────────────────

const serviceAccountPath = path.join(process.cwd(), "serviceAccountKey.json")
if (!fs.existsSync(serviceAccountPath)) {
  console.error("❌ serviceAccountKey.json not found in project root.")
  console.error("   Download it from Firebase Console → Project Settings → Service Accounts")
  process.exit(1)
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"))

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

const fsdb   = admin.firestore()
const prisma = new PrismaClient()

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDate(v: any): Date | null {
  if (!v) return null
  if (v instanceof Date) return v
  if (typeof v.toDate === "function") return v.toDate()
  if (typeof v === "string" || typeof v === "number") return new Date(v)
  if (v._seconds) return new Date(v._seconds * 1000)
  return null
}

function toDateRequired(v: any): Date {
  return toDate(v) ?? new Date()
}

async function fetchAll(col: string): Promise<any[]> {
  const snap = await fsdb.collection(col).get()
  return snap.docs.map(d => ({ _id: d.id, ...d.data() }))
}

function log(msg: string) { console.log(`[migrate] ${msg}`) }

// ─── Only migrate what you asked: Products, Sales, E-Wallet ──────────────────

async function migrateProducts() {
  const docs = await fetchAll("products")
  log(`products: ${docs.length} docs found in Firebase`)
  let inserted = 0, skipped = 0
  for (const d of docs) {
    if (!d.storeId) { skipped++; continue }
    await prisma.product.upsert({
      where: { id: d._id },
      update: {
        name:      d.name ?? "",
        price:     d.price ?? 0,
        cost:      d.cost ?? 0,
        stock:     d.stock ?? 0,
        category:  d.category ?? "",
        imageUrl:  d.imageUrl ?? null,
        barcode:   d.barcode ?? "",
        onSale:    d.onSale ?? false,
        salePrice: d.salePrice ?? null,
      },
      create: {
        id:           d._id,
        storeId:      d.storeId,
        name:         d.name ?? "",
        barcode:      d.barcode ?? "",
        price:        d.price ?? 0,
        cost:         d.cost ?? 0,
        stock:        d.stock ?? 0,
        category:     d.category ?? "",
        imageUrl:     d.imageUrl ?? null,
        description:  d.description ?? null,
        unit:         d.unit ?? null,
        onSale:       d.onSale ?? false,
        salePrice:    d.salePrice ?? null,
        sku:          d.sku ?? null,
        weight:       d.weight ?? null,
        dimensions:   d.dimensions ?? null,
        shippingClass: d.shippingClass ?? null,
        variants:     d.variants ?? null,
        createdAt:    toDateRequired(d.createdAt),
        updatedAt:    toDateRequired(d.updatedAt),
      },
    })
    inserted++
  }
  log(`products: ${inserted} upserted, ${skipped} skipped (no storeId)`)
}

async function migrateCategories() {
  const docs = await fetchAll("categories")
  log(`categories: ${docs.length} docs found`)
  for (const d of docs) {
    if (!d.storeId) continue
    await prisma.category.upsert({
      where: { id: d._id },
      update: { name: d.name ?? "" },
      create: {
        id:          d._id,
        storeId:     d.storeId,
        name:        d.name ?? "",
        description: d.description ?? null,
        createdAt:   toDateRequired(d.createdAt),
      },
    })
  }
  log(`categories: done`)
}

async function migrateSales() {
  const docs = await fetchAll("sales")
  log(`sales: ${docs.length} docs found in Firebase`)

  const products   = await prisma.product.findMany({ select: { id: true } })
  const productIds = new Set(products.map(p => p.id))

  let inserted = 0, skipped = 0, existing = 0
  for (const d of docs) {
    if (!d.storeId) { skipped++; continue }

    const already = await prisma.sale.findUnique({ where: { id: d._id } })
    if (already) { existing++; continue }

    const items = (d.items ?? []).filter((item: any) => productIds.has(item.productId))

    await prisma.sale.create({
      data: {
        id:            d._id,
        storeId:       d.storeId,
        total:         d.total ?? 0,
        profit:        d.profit ?? 0,
        paymentMethod: d.paymentMethod ?? "cash",
        status:        d.status ?? "completed",
        voidedAt:      toDate(d.voidedAt),
        createdAt:     toDateRequired(d.createdAt),
        updatedAt:     toDateRequired(d.updatedAt ?? d.createdAt),
        items: {
          create: items.map((item: any) => ({
            productId:        item.productId,
            productName:      item.productName ?? "",
            quantity:         item.quantity ?? 1,
            price:            item.price ?? 0,
            cost:             item.cost ?? 0,
            subtotal:         item.subtotal ?? 0,
            selectedVariants: item.selectedVariants ?? null,
          })),
        },
      },
    })
    inserted++
  }
  log(`sales: ${inserted} inserted, ${existing} already existed, ${skipped} skipped`)
}

async function migrateEWalletTransactions() {
  const docs = await fetchAll("ewalletTransactions")
  log(`ewallet_transactions: ${docs.length} docs found in Firebase`)
  let inserted = 0, skipped = 0
  for (const d of docs) {
    if (!d.storeId) { skipped++; continue }
    await prisma.eWalletTransaction.upsert({
      where: { id: d._id },
      update: {},
      create: {
        id:              d._id,
        storeId:         d.storeId,
        type:            d.type,
        provider:        d.provider,
        amount:          d.amount ?? 0,
        commission:      d.commission ?? 0,
        commissionRate:  d.commissionRate ?? 0,
        profit:          d.profit ?? 0,
        customerName:    d.customerName ?? null,
        customerNumber:  d.customerNumber ?? null,
        referenceNumber: d.referenceNumber ?? "",
        status:          d.status ?? "completed",
        createdAt:       toDateRequired(d.createdAt),
      },
    })
    inserted++
  }
  log(`ewallet_transactions: ${inserted} upserted, ${skipped} skipped`)
}

async function migrateInventoryTransactions() {
  const docs = await fetchAll("inventoryTransactions")
  log(`inventory_transactions: ${docs.length} docs found`)
  const products   = await prisma.product.findMany({ select: { id: true } })
  const productIds = new Set(products.map(p => p.id))
  let inserted = 0
  for (const d of docs) {
    if (!d.storeId || !productIds.has(d.productId)) continue
    await prisma.inventoryTransaction.upsert({
      where: { id: d._id },
      update: {},
      create: {
        id:            d._id,
        storeId:       d.storeId,
        productId:     d.productId,
        productName:   d.productName ?? "",
        type:          d.type ?? "adjustment",
        quantity:      d.quantity ?? 0,
        previousStock: d.previousStock ?? 0,
        newStock:      d.newStock ?? 0,
        notes:         d.notes ?? null,
        createdAt:     toDateRequired(d.createdAt),
      },
    })
    inserted++
  }
  log(`inventory_transactions: ${inserted} upserted`)
}

// ─── Summary ──────────────────────────────────────────────────────────────────

async function printSummary() {
  console.log("\n── PostgreSQL row counts after migration ────────────────────")
  const [products, categories, sales, ewallet, inventory] = await Promise.all([
    prisma.product.count(),
    prisma.category.count(),
    prisma.sale.count(),
    prisma.eWalletTransaction.count(),
    prisma.inventoryTransaction.count(),
  ])
  console.log(`  Products:               ${products}`)
  console.log(`  Categories:             ${categories}`)
  console.log(`  Sales:                  ${sales}`)
  console.log(`  E-Wallet Transactions:  ${ewallet}`)
  console.log(`  Inventory Transactions: ${inventory}`)
  console.log("─────────────────────────────────────────────────────────────\n")
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 Migrating Firebase → PostgreSQL (Products, Sales, E-Wallet)...\n")
  try {
    await migrateCategories()
    await migrateProducts()
    await migrateSales()
    await migrateEWalletTransactions()
    await migrateInventoryTransactions()
    await printSummary()
    console.log("✅ Migration complete!")
  } catch (err) {
    console.error("❌ Migration failed:", err)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
