import { getStoreId } from "@/lib/store-id"
import {
  localPutMany, localPut, localDelete, localGetByStoreId,
  getPendingWrites, removePendingWrite, bumpRetry, setLastSyncTime,
  getPendingWriteCount,
} from "./store"
import { startRealtimeSync as startSSESync } from "@/lib/db/realtime"
import type { PendingWrite } from "./db"

let syncing = false
let listeners: (() => void)[] = []

export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true
}

// ── Collection → API route map ────────────────────────────────────────────────

const COLLECTION_ROUTE: Record<string, string> = {
  products:              "/api/products",
  categories:            "/api/categories",
  sales:                 "/api/sales",
  utang:                 "/api/utang",
  inventoryTransactions: "/api/inventory-transactions",
  ewalletTransactions:   "/api/ewallet-transactions",
  elistas:               "/api/elistas",
}

// ── Push: send pending local writes to API routes ─────────────────────────────

export async function pushPendingWrites(): Promise<{ synced: number; failed: number }> {
  if (syncing || !isOnline()) return { synced: 0, failed: 0 }

  const pending = await getPendingWrites()
  if (pending.length === 0) return { synced: 0, failed: 0 }

  syncing = true
  let synced = 0
  let failed = 0

  for (const pw of pending) {
    try {
      await executePendingWrite(pw)
      await removePendingWrite(pw.id)
      synced++
    } catch (err: any) {
      console.error("[Sync] Failed to push:", pw.id, err)
      // Delete that 404s = already gone, clear it
      const isGone = pw.operation === "delete"
        && (err.message?.includes("404") || err.message?.includes("not found") || err.message?.includes("P2025"))
      // Writes that have failed 3+ times are stale — clear them to unblock the queue
      const retries = (pw.retries ?? 0) + 1
      const isStale = retries >= 3
      if (isGone || isStale) {
        await removePendingWrite(pw.id)
        synced++
      } else {
        // Bump retry count in the queue
        await bumpRetry(pw.id, retries)
        failed++
      }
    }
  }

  syncing = false

  if (synced > 0 || failed > 0) {
    window.dispatchEvent(new CustomEvent("offline-sync-complete", { detail: { synced, failed } }))
  }

  return { synced, failed }
}

async function executePendingWrite(pw: PendingWrite) {
  const storeId = getStoreId()
  const route = COLLECTION_ROUTE[pw.collection]
  if (!route) throw new Error(`No route for collection: ${pw.collection}`)

  if (pw.operation === "add") {
    const data = { ...pw.data }
    delete data._createdAtMs
    delete data._updatedAtMs
    delete data._needsServerTimestamp
    await apiFetch(route, "POST", { ...data, storeId })
  } else if (pw.operation === "update") {
    const data = { ...pw.data }
    delete data._createdAtMs
    delete data._updatedAtMs
    delete data._needsServerTimestamp
    await apiFetch(route, "PATCH", { id: pw.docId, ...data })
  } else if (pw.operation === "delete") {
    await apiFetch(`${route}?id=${pw.docId}`, "DELETE")
  }
}

async function apiFetch(url: string, method: string, body?: object) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Pull: fetch latest data from API into IndexedDB ───────────────────────────

export async function pullCollection(
  collectionName: "products" | "categories" | "sales" | "utang" | "inventoryTransactions" | "ewalletTransactions",
): Promise<number> {
  if (!isOnline()) return 0

  const storeId = getStoreId()
  if (!storeId) return 0

  const route = COLLECTION_ROUTE[collectionName]
  if (!route) return 0

  try {
    const res = await fetch(`${route}?storeId=${encodeURIComponent(storeId)}`)
    if (!res.ok) return 0
    const { data } = await res.json()
    const items = (data ?? []).map((item: any) => ({
      ...item,
      _createdAtMs: item.createdAt ? new Date(item.createdAt).getTime() : Date.now(),
      _updatedAtMs: item.updatedAt ? new Date(item.updatedAt).getTime() : Date.now(),
    }))
    await localPutMany(collectionName, items)
    await setLastSyncTime(collectionName, Date.now())
    return items.length
  } catch (err) {
    console.error(`[Sync] Pull ${collectionName} failed:`, err)
    return 0
  }
}

export async function pullElistas(userId: string): Promise<number> {
  if (!isOnline()) return 0
  try {
    const res = await fetch(`/api/elistas?userId=${encodeURIComponent(userId)}`)
    if (!res.ok) return 0
    const { data } = await res.json()
    const items = (data ?? []).map((item: any) => ({
      ...item,
      _createdAtMs: item.createdAt ? new Date(item.createdAt).getTime() : Date.now(),
      _updatedAtMs: item.updatedAt ? new Date(item.updatedAt).getTime() : Date.now(),
    }))
    await localPutMany("elistas", items)
    await setLastSyncTime("elistas", Date.now())
    return items.length
  } catch (err) {
    console.error("[Sync] Pull elistas failed:", err)
    return 0
  }
}

// ── Full sync ─────────────────────────────────────────────────────────────────

export async function fullSync(): Promise<{ pushed: number; pulled: number }> {
  if (!isOnline()) return { pushed: 0, pulled: 0 }

  const { synced: pushed } = await pushPendingWrites()

  let pulled = 0
  const collections = ["products", "categories", "sales", "utang", "inventoryTransactions", "ewalletTransactions"] as const
  for (const col of collections) {
    pulled += await pullCollection(col)
  }

  return { pushed, pulled }
}

// ── Real-time sync via SSE (replaces onSnapshot) ──────────────────────────────

export function startRealtimeSync(): () => void {
  const storeId = getStoreId()
  if (!storeId) return () => {}

  const unsubProducts = startSSESync(storeId)

  // Re-pull products whenever a change is notified
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail
    if (detail?.channel === "products_changed") pullCollection("products")
    if (detail?.channel === "sales_changed") pullCollection("sales")
    if (detail?.channel === "utang_records_changed") pullCollection("utang")
    if (detail?.channel === "ewallet_transactions_changed") pullCollection("ewalletTransactions")
  }

  window.addEventListener("realtime-change", handler)
  listeners.push(() => window.removeEventListener("realtime-change", handler))

  return () => {
    unsubProducts()
    listeners.forEach(fn => fn())
    listeners = []
  }
}

// ── Auto-sync on connectivity changes ─────────────────────────────────────────

let initialized = false

export function initOfflineDB() {
  if (typeof window === "undefined" || initialized) return
  initialized = true

  window.addEventListener("online", () => {
    setTimeout(() => pushPendingWrites(), 1000)
  })

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && isOnline()) {
      pushPendingWrites()
    }
  })

  if (isOnline()) {
    setTimeout(() => fullSync(), 2000)
  }
}

export { getPendingWriteCount }
