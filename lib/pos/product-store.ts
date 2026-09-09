/**
 * POS Product Store
 *
 * Single source of truth for the product catalog in the POS.
 * Lives at module scope — survives React unmount/remount (navigation).
 *
 * Load order:
 *   1. Memory cache  → instant, survives navigation within the session
 *   2. IndexedDB     → fast, survives PWA restart / page refresh
 *   3. API full      → cold start only, no local data exists yet
 *
 * After initial render a background incremental sync runs:
 *   GET /api/pos/sync?storeId=X&since=TIMESTAMP
 *   Only changed/deleted products come back.
 *   IDB + memory cache are updated in place, subscribers notified.
 */

import { getDB } from "@/lib/offline/db"
import { getStoreId } from "@/lib/store-id"
import type { Product } from "@/lib/firebase/types"

// ── Types ─────────────────────────────────────────────────────────────────────

export type PosProduct = Pick<
  Product,
  "id" | "name" | "barcode" | "category" | "price" | "cost" |
  "stock" | "imageUrl" | "unit" | "onSale" | "salePrice" | "variants"
>

// ── Module-level state (survives React unmount) ───────────────────────────────

let memCache: PosProduct[] = []
let memCacheStoreId = ""
let loadPromise: Promise<PosProduct[]> | null = null
let syncInFlight = false
const subscribers = new Set<() => void>()

const SYNC_KEY = "pos_last_product_sync"
// Tracks whether we've done a full reconcile this browser session
const sessionFullSyncDone = new Set<string>()

function getSyncTimestamp(storeId: string): number {
  try { return parseInt(localStorage.getItem(`${SYNC_KEY}_${storeId}`) || "0") } catch { return 0 }
}

function setSyncTimestamp(storeId: string, ts: number) {
  try { localStorage.setItem(`${SYNC_KEY}_${storeId}`, String(ts)) } catch {}
}

// ── Subscribers ───────────────────────────────────────────────────────────────

export function subscribeProducts(fn: () => void): () => void {
  subscribers.add(fn)
  return () => subscribers.delete(fn)
}

function notify() {
  subscribers.forEach(fn => fn())
}

// ── IDB helpers — use storeId index, no full table scan ──────────────────────

async function idbGetProducts(storeId: string): Promise<PosProduct[]> {
  try {
    const db = await getDB()
    return db.getAllFromIndex("products", "storeId", storeId) as Promise<PosProduct[]>
  } catch {
    return []
  }
}

async function idbPutProducts(products: PosProduct[]): Promise<void> {
  if (!products.length) return
  try {
    const db = await getDB()
    const tx = db.transaction("products", "readwrite")
    for (const p of products) tx.store.put(p)
    await tx.done
  } catch {}
}

async function idbDeleteProducts(ids: string[]): Promise<void> {
  if (!ids.length) return
  try {
    const db = await getDB()
    const tx = db.transaction("products", "readwrite")
    for (const id of ids) tx.store.delete(id)
    await tx.done
  } catch {}
}

// ── Primary load (cache-first, deduplicated) ──────────────────────────────────

export async function loadProducts(storeId: string): Promise<PosProduct[]> {
  // 1. Memory hit — instant, no async needed
  if (memCache.length > 0 && memCacheStoreId === storeId) {
    // Still kick off a background sync if we haven't recently
    syncProducts(storeId).catch(() => {})
    return memCache
  }

  // 2. Deduplicate concurrent calls — return the same promise
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    try {
      // 3. IDB hit — fast, survives PWA restart
      const idbProducts = await idbGetProducts(storeId)
      if (idbProducts.length > 0) {
        memCache = idbProducts
        memCacheStoreId = storeId
        notify()
        // Background incremental sync — don't block
        syncProducts(storeId).catch(() => {})
        return memCache
      }

      // 4. Cold start — full API fetch
      const data = await fetchFull(storeId)
      if (data.length > 0) {
        memCache = data
        memCacheStoreId = storeId
        await idbPutProducts(data)
        setSyncTimestamp(storeId, Date.now())
        notify()
      }
      return memCache
    } finally {
      loadPromise = null
    }
  })()

  return loadPromise
}

// ── Incremental background sync ───────────────────────────────────────────────

export async function syncProducts(storeId: string): Promise<void> {
  if (syncInFlight || typeof window === "undefined") return
  if (!navigator.onLine) return

  syncInFlight = true

  try {
    // Once per session: full reconcile to purge any stale IDB products
    const needsFullReconcile = !sessionFullSyncDone.has(storeId)
    const since = needsFullReconcile ? 0 : getSyncTimestamp(storeId)

    const res = await fetch(`/api/pos/sync?storeId=${encodeURIComponent(storeId)}&since=${since}`)
    if (!res.ok) return

    const { updated, deleted, syncTimestamp }: {
      updated: PosProduct[]
      deleted: string[]
      syncTimestamp: number
    } = await res.json()

    if (needsFullReconcile && updated.length > 0) {
      // Full reconcile: replace IDB entirely with the live server set
      const liveIds = new Set(updated.map(p => p.id!))
      const idbProducts = await idbGetProducts(storeId)
      const orphanIds = idbProducts.map(p => p.id!).filter(id => !liveIds.has(id))

      memCache = updated
      memCacheStoreId = storeId

      await idbPutProducts(updated)
      await idbDeleteProducts(orphanIds)

      sessionFullSyncDone.add(storeId)
      notify()
    } else if (!needsFullReconcile && (updated.length > 0 || deleted.length > 0)) {
      // Incremental merge
      const byId = new Map(memCache.map(p => [p.id, p]))
      for (const p of updated) byId.set(p.id!, p)
      for (const id of deleted) byId.delete(id)
      memCache = Array.from(byId.values())
      memCacheStoreId = storeId

      await idbPutProducts(updated)
      await idbDeleteProducts(deleted)

      notify()
    } else if (needsFullReconcile) {
      // Server returned empty — mark done anyway
      sessionFullSyncDone.add(storeId)
    }

    setSyncTimestamp(storeId, syncTimestamp)
  } catch {
    // silent — background sync failure must never affect POS usability
  } finally {
    syncInFlight = false
  }
}

// ── Full fetch (cold start only) ──────────────────────────────────────────────

async function fetchFull(storeId: string): Promise<PosProduct[]> {
  try {
    const res = await fetch(`/api/products?storeId=${encodeURIComponent(storeId)}&pos=1`)
    if (!res.ok) return []
    const { data } = await res.json()
    return data ?? []
  } catch {
    return []
  }
}

// ── Barcode lookup (memory → IDB → API) ──────────────────────────────────────

export function findByBarcodeSync(barcode: string): PosProduct | undefined {
  return memCache.find(p => p.barcode === barcode)
}

export async function lookupBarcode(storeId: string, barcode: string): Promise<PosProduct | null> {
  const local = findByBarcodeSync(barcode)
  if (local) return local

  try {
    const db = await getDB()
    const all = await db.getAllFromIndex("products", "storeId", storeId) as PosProduct[]
    const found = all.find(p => p.barcode === barcode)
    if (found) return found
  } catch {}

  try {
    const res = await fetch(`/api/products?storeId=${encodeURIComponent(storeId)}&barcode=${encodeURIComponent(barcode)}`)
    if (!res.ok) return null
    const { data } = await res.json()
    return data ?? null
  } catch {
    return null
  }
}

// ── Local search (memory only, no API round-trip) ─────────────────────────────

export function searchProducts(query: string, limit = 20): PosProduct[] {
  if (!query.trim()) return []
  const q = query.trim().toLowerCase()
  const words = q.split(/\s+/).filter(Boolean)

  return memCache
    .map(p => {
      const name = (p.name || "").toLowerCase()
      const barcode = (p.barcode || "").toLowerCase()
      const hay = `${name} ${barcode} ${(p.category || "").toLowerCase()}`

      if (barcode === q)                     return { p, s: 100 }
      if (name === q)                        return { p, s: 90 }
      if (name.startsWith(q))               return { p, s: 80 }
      if (barcode.startsWith(q))            return { p, s: 75 }
      if (hay.includes(q))                  return { p, s: 60 }
      if (words.every(w => hay.includes(w))) return { p, s: 50 }
      const hits = words.filter(w => hay.includes(w)).length
      if (hits > 0)                          return { p, s: hits * 10 }
      return null
    })
    .filter((x): x is { p: PosProduct; s: number } => x !== null)
    .sort((a, b) => b.s - a.s || a.p.name.localeCompare(b.p.name))
    .slice(0, limit)
    .map(x => x.p)
}

// ── Expose current cache synchronously (for React useState init) ──────────────

export function getMemCache(): PosProduct[] {
  return memCache
}

// ── Invalidate after product write ───────────────────────────────────────────

export function invalidateProductStore() {
  memCache = []
  memCacheStoreId = ""
  loadPromise = null
  sessionFullSyncDone.clear()
}
