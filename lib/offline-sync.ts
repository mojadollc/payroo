import type { Sale, SaleItem } from "@/lib/firebase/types"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OfflineSale {
  id: string
  items: { productId: string; productName: string; quantity: number; price: number; cost: number; subtotal: number }[]
  total: number
  profit: number
  paymentMethod: "cash" | "gcash" | "maya"
  createdAt: string // ISO string
}

export interface OfflineUtang {
  id: string
  customerName: string
  storeId: string
  storeName: string
  items: { productName: string; quantity: number; price: number; subtotal: number }[]
  totalAmount: number
  createdAt: string
}

export type OfflineEntry = 
  | { type: "sale"; data: OfflineSale }
  | { type: "utang"; data: OfflineUtang }

// ── Storage Keys ──────────────────────────────────────────────────────────────

const QUEUE_KEY = "pos_offline_queue"
const PRODUCTS_CACHE_KEY = "pos_products_cache"

// ── Online detection ──────────────────────────────────────────────────────────

export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true
}

// ── Queue operations ──────────────────────────────────────────────────────────

export function getOfflineQueue(): OfflineEntry[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]")
  } catch {
    return []
  }
}

function saveQueue(queue: OfflineEntry[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

export function enqueueOfflineSale(sale: Omit<OfflineSale, "id" | "createdAt">): string {
  const id = `offline_sale_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  const entry: OfflineEntry = {
    type: "sale",
    data: { ...sale, id, createdAt: new Date().toISOString() },
  }
  const queue = getOfflineQueue()
  queue.push(entry)
  saveQueue(queue)

  // Update cached product stock locally
  updateCachedStock(sale.items)

  return id
}

export function enqueueOfflineUtang(utang: Omit<OfflineUtang, "id" | "createdAt">): string {
  const id = `offline_utang_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  const entry: OfflineEntry = {
    type: "utang",
    data: { ...utang, id, createdAt: new Date().toISOString() },
  }
  const queue = getOfflineQueue()
  queue.push(entry)
  saveQueue(queue)
  return id
}

function removeFromQueue(id: string) {
  saveQueue(getOfflineQueue().filter(e => e.data.id !== id))
}

// ── Product cache for offline reads ───────────────────────────────────────────

export function cacheProducts(products: any[]) {
  try {
    localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(products))
  } catch { /* quota exceeded — ignore */ }
}

export function getCachedProducts(): any[] {
  try {
    return JSON.parse(localStorage.getItem(PRODUCTS_CACHE_KEY) || "[]")
  } catch {
    return []
  }
}

function updateCachedStock(items: { productId: string; quantity: number }[]) {
  const products = getCachedProducts()
  for (const item of items) {
    const p = products.find((pr: any) => pr.id === item.productId)
    if (p) p.stock = Math.max(0, p.stock - item.quantity)
  }
  cacheProducts(products)
}

// ── Sync engine ───────────────────────────────────────────────────────────────

let syncing = false

export async function syncOfflineQueue(): Promise<{ synced: number; failed: number }> {
  if (syncing || !isOnline()) return { synced: 0, failed: 0 }
  const queue = getOfflineQueue()
  if (queue.length === 0) return { synced: 0, failed: 0 }

  syncing = true
  let synced = 0
  let failed = 0

  // Lazy-import firebase services to avoid circular deps
  const { addSale, addUtang, getStoreSettings } = await import("@/lib/firebase/services")

  // Fetch store location once for market intelligence
  let storeLocation: any = undefined
  try {
    const settings = await getStoreSettings()
    if (settings?.city && settings?.region) {
      storeLocation = {
        region: settings.region,
        province: settings.province ?? "",
        city: settings.city,
        barangay: settings.barangay ?? "",
        businessType: settings.businessType ?? "retail",
      }
    }
  } catch {}

  for (const entry of queue) {
    try {
      if (entry.type === "sale") {
        const s = entry.data
        await addSale({
          items: s.items,
          total: s.total,
          profit: s.profit,
          paymentMethod: s.paymentMethod,
          status: "completed",
        }, storeLocation)
      } else if (entry.type === "utang") {
        const u = entry.data
        await addUtang({
          customerName: u.customerName,
          storeId: u.storeId,
          storeName: u.storeName,
          items: u.items,
          totalAmount: u.totalAmount,
          amountPaid: 0,
          balance: u.totalAmount,
          status: "active",
        })
      }
      removeFromQueue(entry.data.id)
      synced++
    } catch (err) {
      console.error("[OfflineSync] Failed to sync entry:", entry.data.id, err)
      failed++
    }
  }

  syncing = false

  // Dispatch event so UI can react
  if (synced > 0) {
    window.dispatchEvent(new CustomEvent("offline-sync-complete", { detail: { synced, failed } }))
  }

  return { synced, failed }
}

// ── Auto-sync listeners ───────────────────────────────────────────────────────

let initialized = false

export function initOfflineSync() {
  if (typeof window === "undefined" || initialized) return
  initialized = true

  // Sync when coming back online
  window.addEventListener("online", () => {
    setTimeout(() => syncOfflineQueue(), 1000)
  })

  // Sync on visibility change (tab focus)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && isOnline()) {
      syncOfflineQueue()
    }
  })

  // Try syncing on init if online
  if (isOnline()) {
    setTimeout(() => syncOfflineQueue(), 3000)
  }
}
