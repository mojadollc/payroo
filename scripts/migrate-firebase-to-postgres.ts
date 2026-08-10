/**
 * Phase 8 — Firebase → PostgreSQL Migration
 * Run: npx tsx scripts/migrate-firebase-to-postgres.ts
 *
 * Safe to re-run — uses upsert (skipDuplicates) throughout.
 * Run order respects FK constraints (parents before children).
 */

import "dotenv/config"
import { initializeApp } from "firebase/app"
import {
  getFirestore, collection, getDocs, query, orderBy,
  type Timestamp,
} from "firebase/firestore"
import { PrismaClient } from "@prisma/client"

// ─── Firebase config ──────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
}

const app    = initializeApp(firebaseConfig)
const fsdb   = getFirestore(app)
const prisma = new PrismaClient()

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDate(v: any): Date | null {
  if (!v) return null
  if (v instanceof Date) return v
  if (typeof v.toDate === "function") return v.toDate()
  if (typeof v === "string" || typeof v === "number") return new Date(v)
  return null
}

function toDateRequired(v: any): Date {
  return toDate(v) ?? new Date()
}

async function fetchAll(col: string): Promise<any[]> {
  const snap = await getDocs(collection(fsdb, col))
  return snap.docs.map(d => ({ _id: d.id, ...d.data() }))
}

function log(msg: string) { console.log(`[migrate] ${msg}`) }

// ─── Migration steps ──────────────────────────────────────────────────────────

async function migrateSubscriptionPlans() {
  const docs = await fetchAll("subscriptionPlans")
  log(`subscription_plans: ${docs.length} docs`)
  for (const d of docs) {
    await prisma.subscriptionPlan.upsert({
      where: { id: d._id },
      update: {},
      create: {
        id:          d._id,
        tier:        d.tier,
        name:        d.name,
        price:       d.price ?? 0,
        description: d.description ?? "",
        features:    d.features ?? {},
        isActive:    d.isActive ?? true,
        updatedAt:   toDateRequired(d.updatedAt),
      },
    })
  }
  log(`subscription_plans: done`)
}

async function migrateCustomerSubscriptions() {
  const docs = await fetchAll("customerSubscriptions")
  log(`customer_subscriptions: ${docs.length} docs`)

  // Collect valid planIds from DB
  const plans = await prisma.subscriptionPlan.findMany({ select: { id: true } })
  const planIds = new Set(plans.map(p => p.id))

  // For orphaned planIds, remap to the existing basic plan
  const basicPlan = await prisma.subscriptionPlan.findFirst({ where: { tier: "basic" } })
  const fallbackPlanId = basicPlan?.id ?? plans[0]?.id

  for (const d of docs) {
    if (!planIds.has(d.planId)) {
      if (!fallbackPlanId) { log(`  skip sub ${d._id} — no fallback plan available`); continue }
      log(`  remapping sub ${d._id} planId ${d.planId} → basic`)
      d.planId = fallbackPlanId
    }
    await prisma.customerSubscription.upsert({
      where: { externalId: d.externalId ?? d._id },
      update: {},
      create: {
        id:                  d._id,
        externalId:          d.externalId ?? d._id,
        parentExternalId:    d.parentExternalId ?? null,
        ownerName:           d.ownerName ?? "",
        ownerEmail:          d.ownerEmail ?? "",
        storeName:           d.storeName ?? "",
        businessType:        d.businessType ?? null,
        phone:               d.phone ?? null,
        planId:              d.planId,
        tier:                d.tier ?? "basic",
        status:              d.status ?? "pending",
        features:            d.features ?? null,
        startDate:           toDate(d.startDate),
        endDate:             toDate(d.endDate),
        notes:               d.notes ?? null,
        referralCode:        d.referralCode ?? null,
        xenditInvoiceId:     d.xenditInvoiceId ?? null,
        xenditPaymentStatus: d.xenditPaymentStatus ?? null,
        xenditPaymentUrl:    d.xenditPaymentUrl ?? null,
        oldExternalId:       d.oldExternalId ?? null,
        expiryReminderDate:  toDate(d.expiryReminderDate),
        expiryReminderSent:  d.expiryReminderSent ?? false,
        createdAt:           toDateRequired(d.createdAt),
        updatedAt:           toDateRequired(d.updatedAt),
      },
    })
  }
  log(`customer_subscriptions: done`)
}

async function migrateStoreUsers() {
  const docs = await fetchAll("storeUsers")
  log(`store_users: ${docs.length} docs`)
  for (const d of docs) {
    await prisma.storeUser.upsert({
      where: { externalId_username: { externalId: d.externalId, username: d.username } },
      update: {},
      create: {
        id:              d._id,
        externalId:      d.externalId,
        name:            d.name ?? "",
        username:        d.username ?? "",
        pin:             d.pin ?? "",
        role:            d.role ?? "cashier",
        isActive:        d.isActive ?? true,
        allowedFeatures: d.allowedFeatures ?? null,
        permissions:     d.permissions ?? null,
        createdAt:       toDateRequired(d.createdAt),
        updatedAt:       toDateRequired(d.updatedAt),
      },
    })
  }
  log(`store_users: done`)
}

async function migrateProducts() {
  const docs = await fetchAll("products")
  log(`products: ${docs.length} docs`)
  for (const d of docs) {
    if (!d.storeId) { log(`  skip product ${d._id} — missing storeId`); continue }
    await prisma.product.upsert({
      where: { id: d._id },
      update: {},
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
  }
  log(`products: done`)
}

async function migrateCategories() {
  const docs = await fetchAll("categories")
  log(`categories: ${docs.length} docs`)
  for (const d of docs) {
    await prisma.category.upsert({
      where: { id: d._id },
      update: {},
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
  log(`sales: ${docs.length} docs`)

  // Get valid productIds
  const products = await prisma.product.findMany({ select: { id: true } })
  const productIds = new Set(products.map(p => p.id))

  for (const d of docs) {
    const existing = await prisma.sale.findUnique({ where: { id: d._id } })
    if (existing) continue

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
  }
  log(`sales: done`)
}

async function migrateInventoryTransactions() {
  const docs = await fetchAll("inventoryTransactions")
  log(`inventory_transactions: ${docs.length} docs`)

  const products = await prisma.product.findMany({ select: { id: true } })
  const productIds = new Set(products.map(p => p.id))

  for (const d of docs) {
    if (!productIds.has(d.productId)) continue
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
  }
  log(`inventory_transactions: done`)
}

async function migrateEWalletTransactions() {
  const docs = await fetchAll("ewalletTransactions")
  log(`ewallet_transactions: ${docs.length} docs`)
  for (const d of docs) {
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
  }
  log(`ewallet_transactions: done`)
}

async function migrateUtang() {
  const utangDocs    = await fetchAll("utang")
  const paymentDocs  = await fetchAll("utangPayments")
  log(`utang_records: ${utangDocs.length} docs, utang_payments: ${paymentDocs.length} docs`)

  for (const d of utangDocs) {
    const existing = await prisma.utangRecord.findUnique({ where: { id: d._id } })
    if (existing) continue

    await prisma.utangRecord.create({
      data: {
        id:            d._id,
        storeId:       d.storeId,
        storeName:     d.storeName ?? "",
        customerName:  d.customerName ?? "",
        customerPhone: d.customerPhone ?? null,
        totalAmount:   d.totalAmount ?? 0,
        amountPaid:    d.amountPaid ?? 0,
        balance:       d.balance ?? 0,
        status:        d.status ?? "active",
        dueDate:       toDate(d.dueDate),
        notes:         d.notes ?? null,
        createdAt:     toDateRequired(d.createdAt),
        updatedAt:     toDateRequired(d.updatedAt),
        items: {
          create: (d.items ?? []).map((item: any) => ({
            productName: item.productName ?? "",
            quantity:    item.quantity ?? 1,
            price:       item.price ?? 0,
            subtotal:    item.subtotal ?? 0,
          })),
        },
      },
    })
  }

  // Payments
  const utangIds = new Set((await prisma.utangRecord.findMany({ select: { id: true } })).map(u => u.id))
  for (const d of paymentDocs) {
    if (!utangIds.has(d.utangId)) continue
    await prisma.utangPayment.upsert({
      where: { id: d._id },
      update: {},
      create: {
        id:              d._id,
        utangId:         d.utangId,
        customerName:    d.customerName ?? "",
        amount:          d.amount ?? 0,
        method:          d.method ?? "cash",
        referenceNumber: d.referenceNumber ?? null,
        createdAt:       toDateRequired(d.createdAt),
      },
    })
  }
  log(`utang: done`)
}

async function migrateLoyalty() {
  const customers    = await fetchAll("loyaltyCustomers")
  const transactions = await fetchAll("loyaltyTransactions")
  const rules        = await fetchAll("loyaltyRules")
  const settings     = await fetchAll("loyaltySettings")
  log(`loyalty_customers: ${customers.length}, transactions: ${transactions.length}, rules: ${rules.length}, settings: ${settings.length}`)

  for (const d of customers) {
    await prisma.loyaltyCustomer.upsert({
      where: { qrCode: d.qrCode },
      update: {},
      create: {
        id:           d._id,
        storeId:      d.storeId,
        name:         d.name ?? "",
        phone:        d.phone ?? null,
        coins:        d.coins ?? 0,
        totalEarned:  d.totalEarned ?? 0,
        totalRedeemed: d.totalRedeemed ?? 0,
        qrCode:       d.qrCode,
        createdAt:    toDateRequired(d.createdAt),
        updatedAt:    toDateRequired(d.updatedAt),
      },
    })
  }

  const custIds = new Set((await prisma.loyaltyCustomer.findMany({ select: { id: true } })).map(c => c.id))
  for (const d of transactions) {
    if (!custIds.has(d.customerId)) continue
    await prisma.loyaltyTransaction.upsert({
      where: { id: d._id },
      update: {},
      create: {
        id:           d._id,
        customerId:   d.customerId,
        customerName: d.customerName ?? "",
        type:         d.type,
        coins:        d.coins ?? 0,
        saleItems:    d.saleItems ?? null,
        saleTotal:    d.saleTotal ?? null,
        createdAt:    toDateRequired(d.createdAt),
      },
    })
  }

  for (const d of rules) {
    await prisma.loyaltyRule.upsert({
      where: { productId: d.productId },
      update: {},
      create: {
        id:          d._id,
        productId:   d.productId,
        productName: d.productName ?? "",
        buyQty:      d.buyQty ?? 1,
        earnCoins:   d.earnCoins ?? 1,
        updatedAt:   toDateRequired(d.updatedAt),
      },
    })
  }

  for (const d of settings) {
    await prisma.loyaltySettings.upsert({
      where: { storeId: d.storeId },
      update: {},
      create: {
        id:             d._id,
        storeId:        d.storeId,
        minRedeemCoins: d.minRedeemCoins ?? 100,
        coinValuePeso:  d.coinValuePeso ?? 1,
        updatedAt:      toDateRequired(d.updatedAt),
      },
    })
  }
  log(`loyalty: done`)
}

async function migrateAffiliates() {
  const affiliates   = await fetchAll("affiliates")
  const earnings     = await fetchAll("affiliateEarnings")
  const withdrawals  = await fetchAll("affiliateWithdrawals")
  log(`affiliates: ${affiliates.length}, earnings: ${earnings.length}, withdrawals: ${withdrawals.length}`)

  for (const d of affiliates) {
    await prisma.affiliate.upsert({
      where: { email: d.email },
      update: {},
      create: {
        id:             d._id,
        name:           d.name ?? "",
        email:          d.email,
        phone:          d.phone ?? null,
        referralCode:   d.referralCode,
        walletBalance:  d.walletBalance ?? 0,
        totalEarned:    d.totalEarned ?? 0,
        totalWithdrawn: d.totalWithdrawn ?? 0,
        totalReferrals: d.totalReferrals ?? 0,
        isActive:       d.isActive ?? true,
        createdAt:      toDateRequired(d.createdAt),
        updatedAt:      toDateRequired(d.updatedAt),
      },
    })
  }

  const affIds = new Set((await prisma.affiliate.findMany({ select: { id: true } })).map(a => a.id))

  for (const d of earnings) {
    if (!affIds.has(d.affiliateId)) continue
    await prisma.affiliateEarning.upsert({
      where: { id: d._id },
      update: {},
      create: {
        id:                d._id,
        affiliateId:       d.affiliateId,
        referralCode:      d.referralCode ?? "",
        referredEmail:     d.referredEmail ?? "",
        referredStoreName: d.referredStoreName ?? "",
        planName:          d.planName ?? "",
        planPrice:         d.planPrice ?? 0,
        commission:        d.commission ?? 150,
        createdAt:         toDateRequired(d.createdAt),
      },
    })
  }

  for (const d of withdrawals) {
    if (!affIds.has(d.affiliateId)) continue
    await prisma.affiliateWithdrawal.upsert({
      where: { id: d._id },
      update: {},
      create: {
        id:             d._id,
        affiliateId:    d.affiliateId,
        affiliateName:  d.affiliateName ?? "",
        affiliateEmail: d.affiliateEmail ?? "",
        amount:         d.amount ?? 0,
        gcashNumber:    d.gcashNumber ?? "",
        gcashName:      d.gcashName ?? "",
        paymentMethod:  d.paymentMethod ?? null,
        accountNumber:  d.accountNumber ?? null,
        accountName:    d.accountName ?? null,
        status:         d.status ?? "pending",
        notes:          d.notes ?? null,
        createdAt:      toDateRequired(d.createdAt),
        updatedAt:      toDateRequired(d.updatedAt),
      },
    })
  }
  log(`affiliates: done`)
}

async function migrateDelivery() {
  const settings = await fetchAll("deliverySettings")
  const orders   = await fetchAll("deliveryOrders")
  const banners  = await fetchAll("deliveryBanners")
  log(`delivery_settings: ${settings.length}, orders: ${orders.length}, banners: ${banners.length}`)

  for (const d of settings) {
    await prisma.deliverySettings.upsert({
      where: { storeId: d.storeId },
      update: {},
      create: {
        id:               d._id,
        storeId:          d.storeId,
        enabled:          d.enabled ?? false,
        storeName:        d.storeName ?? "",
        storeImage:       d.storeImage ?? null,
        storeLogo:        d.storeLogo ?? null,
        description:      d.description ?? null,
        address:          d.address ?? null,
        phone:            d.phone ?? null,
        openTime:         d.openTime ?? "08:00",
        closeTime:        d.closeTime ?? "22:00",
        minOrder:         d.minOrder ?? null,
        deliveryFee:      d.deliveryFee ?? null,
        enabledProductIds: d.enabledProductIds ?? [],
        createdAt:        toDateRequired(d.createdAt),
        updatedAt:        toDateRequired(d.updatedAt),
      },
    })
  }

  const storeIds = new Set((await prisma.deliverySettings.findMany({ select: { storeId: true } })).map(s => s.storeId))
  for (const d of orders) {
    if (!storeIds.has(d.storeId)) continue
    await prisma.deliveryOrder.upsert({
      where: { id: d._id },
      update: {},
      create: {
        id:              d._id,
        storeId:         d.storeId,
        storeName:       d.storeName ?? "",
        customerName:    d.customerName ?? "",
        customerPhone:   d.customerPhone ?? "",
        customerAddress: d.customerAddress ?? "",
        items:           d.items ?? [],
        total:           d.total ?? 0,
        deliveryFee:     d.deliveryFee ?? 0,
        status:          d.status ?? "pending",
        notes:           d.notes ?? null,
        createdAt:       toDateRequired(d.createdAt),
        updatedAt:       toDateRequired(d.updatedAt),
      },
    })
  }

  for (const d of banners) {
    await prisma.deliveryBanner.upsert({
      where: { id: d._id },
      update: {},
      create: {
        id:        d._id,
        imageUrl:  d.imageUrl ?? "",
        title:     d.title ?? null,
        link:      d.link ?? null,
        order:     d.order ?? 0,
        active:    d.active ?? true,
        createdAt: toDateRequired(d.createdAt),
        updatedAt: toDateRequired(d.updatedAt),
      },
    })
  }
  log(`delivery: done`)
}

async function migrateStoreBranches() {
  const docs = await fetchAll("storeBranches")
  log(`store_branches: ${docs.length} docs`)
  for (const d of docs) {
    await prisma.storeBranch.upsert({
      where: { branchExternalId: d.branchExternalId },
      update: {},
      create: {
        id:               d._id,
        mainExternalId:   d.mainExternalId,
        branchExternalId: d.branchExternalId,
        branchName:       d.branchName ?? "",
        address:          d.address ?? null,
        phone:            d.phone ?? null,
        isActive:         d.isActive ?? true,
        createdAt:        toDateRequired(d.createdAt),
        updatedAt:        toDateRequired(d.updatedAt),
      },
    })
  }
  log(`store_branches: done`)
}

async function migrateMarketData() {
  const docs = await fetchAll("marketData")
  log(`market_data: ${docs.length} docs`)
  // createMany with skipDuplicates is faster for large datasets
  const data = docs.map(d => ({
    id:           d._id,
    region:       d.region ?? "",
    province:     d.province ?? "",
    city:         d.city ?? "",
    barangay:     d.barangay ?? "",
    businessType: d.businessType ?? "",
    productName:  d.productName ?? "",
    category:     d.category ?? "",
    quantity:     d.quantity ?? 0,
    revenue:      d.revenue ?? 0,
    hour:         d.hour ?? 0,
    dayOfWeek:    d.dayOfWeek ?? 0,
    date:         d.date ?? "",
    month:        d.month ?? "",
    createdAt:    toDateRequired(d.createdAt),
  }))
  await prisma.marketData.createMany({ data, skipDuplicates: true })
  log(`market_data: done`)
}

async function migrateSiteVisits() {
  const docs = await fetchAll("siteVisits")
  log(`site_visits: ${docs.length} docs`)
  const data = docs.map(d => ({
    id:          d._id,
    ip:          d.ip ?? "",
    country:     d.country ?? "",
    countryCode: d.countryCode ?? "",
    city:        d.city ?? "",
    region:      d.region ?? "",
    page:        d.page ?? "",
    referrer:    d.referrer ?? "",
    userAgent:   d.userAgent ?? "",
    isPWA:       d.isPWA ?? false,
    createdAt:   toDateRequired(d.createdAt),
  }))
  await prisma.siteVisit.createMany({ data, skipDuplicates: true })
  log(`site_visits: done`)
}

// ─── Verify row counts ────────────────────────────────────────────────────────

async function verifyCounts() {
  console.log("\n── Row count verification ──────────────────────────────────")
  const checks = [
    ["subscription_plans",       prisma.subscriptionPlan.count(),       fetchAll("subscriptionPlans")],
    ["customer_subscriptions",   prisma.customerSubscription.count(),   fetchAll("customerSubscriptions")],
    ["store_users",              prisma.storeUser.count(),              fetchAll("storeUsers")],
    ["products",                 prisma.product.count(),                fetchAll("products")],
    ["categories",               prisma.category.count(),               fetchAll("categories")],
    ["sales",                    prisma.sale.count(),                   fetchAll("sales")],
    ["inventory_transactions",   prisma.inventoryTransaction.count(),   fetchAll("inventoryTransactions")],
    ["ewallet_transactions",     prisma.eWalletTransaction.count(),     fetchAll("ewalletTransactions")],
    ["utang_records",            prisma.utangRecord.count(),            fetchAll("utang")],
    ["utang_payments",           prisma.utangPayment.count(),           fetchAll("utangPayments")],
    ["loyalty_customers",        prisma.loyaltyCustomer.count(),        fetchAll("loyaltyCustomers")],
    ["loyalty_transactions",     prisma.loyaltyTransaction.count(),     fetchAll("loyaltyTransactions")],
    ["affiliates",               prisma.affiliate.count(),              fetchAll("affiliates")],
    ["affiliate_earnings",       prisma.affiliateEarning.count(),       fetchAll("affiliateEarnings")],
    ["affiliate_withdrawals",    prisma.affiliateWithdrawal.count(),    fetchAll("affiliateWithdrawals")],
    ["delivery_settings",        prisma.deliverySettings.count(),       fetchAll("deliverySettings")],
    ["delivery_orders",          prisma.deliveryOrder.count(),          fetchAll("deliveryOrders")],
    ["delivery_banners",         prisma.deliveryBanner.count(),         fetchAll("deliveryBanners")],
    ["store_branches",           prisma.storeBranch.count(),            fetchAll("storeBranches")],
    ["market_data",              prisma.marketData.count(),             fetchAll("marketData")],
    ["site_visits",              prisma.siteVisit.count(),              fetchAll("siteVisits")],
  ] as const

  for (const [name, pgPromise, fsPromise] of checks) {
    const [pgCount, fsDocs] = await Promise.all([pgPromise, fsPromise])
    const fsCount = (fsDocs as any[]).length
    const ok = pgCount >= fsCount
    console.log(`  ${ok ? "✅" : "⚠️ "} ${name.padEnd(28)} Firebase: ${String(fsCount).padStart(5)}  Postgres: ${String(pgCount).padStart(5)}`)
  }
  console.log("────────────────────────────────────────────────────────────\n")
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 Starting Firebase → PostgreSQL migration...\n")

  try {
    // Parents first (FK order)
    await migrateSubscriptionPlans()
    await migrateCustomerSubscriptions()
    await migrateStoreUsers()
    await migrateProducts()
    await migrateCategories()
    await migrateSales()
    await migrateInventoryTransactions()
    await migrateEWalletTransactions()
    await migrateUtang()
    await migrateLoyalty()
    await migrateAffiliates()
    await migrateDelivery()
    await migrateStoreBranches()
    await migrateMarketData()
    await migrateSiteVisits()

    await verifyCounts()

    console.log("✅ Migration complete!")
  } catch (err) {
    console.error("❌ Migration failed:", err)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
