/**
 * Reports Store
 *
 * Same architecture as the POS product store.
 * Module-level cache survives React unmount/remount (navigation).
 *
 * Load order:
 *   1. Memory cache  → instant, survives navigation
 *   2. IDB           → fast, survives PWA restart / page refresh
 *   3. API           → background refresh, never blocks UI
 *
 * Reports data is date-range dependent.
 * The "default" cache (no date range) is what gets persisted to IDB.
 * Date-range queries always go to the API but show stale data first.
 */

import { getDB } from "@/lib/offline/db"
import { getStoreId } from "@/lib/store-id"
import type { Sale, EWalletTransaction } from "@/lib/firebase/types"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReportsData {
  sales: Sale[]
  ewallet: EWalletTransaction[]
  bills: any[]
  fetchedAt: number
  storeId: string
}

// ── Module-level state ────────────────────────────────────────────────────────

let memCache: ReportsData | null = null
let fetchPromise: Promise<ReportsData> | null = null
const subscribers = new Set<() => void>()

const IDB_KEY = "reports_cache"
const STALE_MS = 2 * 60 * 1000 // 2 minutes — refresh in background after this

// ── Subscribers ───────────────────────────────────────────────────────────────

export function subscribeReports(fn: () => void): () => void {
  subscribers.add(fn)
  return () => subscribers.delete(fn)
}

function notify() {
  subscribers.forEach(fn => fn())
}

// ── IDB helpers ───────────────────────────────────────────────────────────────

async function idbGet(storeId: string): Promise<ReportsData | null> {
  try {
    const db = await getDB()
    // Use syncMeta store to persist the reports cache blob
    const entry = await (db as any).get("syncMeta", `${IDB_KEY}_${storeId}`)
    if (!entry?.data) return null
    return entry.data as ReportsData
  } catch {
    return null
  }
}

async function idbSet(data: ReportsData): Promise<void> {
  try {
    const db = await getDB()
    await (db as any).put("syncMeta", {
      collection: `${IDB_KEY}_${data.storeId}`,
      data,
      lastSyncedAt: data.fetchedAt,
    })
  } catch {}
}

// ── Primary load (cache-first, deduplicated) ──────────────────────────────────

export async function loadReports(
  storeId: string,
  dateRange?: { from: Date; to: Date }
): Promise<ReportsData> {
  const isDefaultRange = !dateRange

  // 1. Memory hit for default range — instant
  if (isDefaultRange && memCache && memCache.storeId === storeId) {
    const isStale = Date.now() - memCache.fetchedAt > STALE_MS
    if (isStale) {
      fetchReports(storeId, undefined).catch(() => {})
    }
    return memCache
  }

  // 2. Deduplicate concurrent calls for default range
  if (isDefaultRange && fetchPromise) return fetchPromise

  const doLoad = async (): Promise<ReportsData> => {
    // 3. IDB hit for default range
    if (isDefaultRange) {
      const cached = await idbGet(storeId)
      if (cached && cached.storeId === storeId) {
        memCache = cached
        notify()
        // Background refresh
        fetchReports(storeId, undefined).catch(() => {})
        return cached
      }
    }

    // 4. Fetch from API
    return fetchReports(storeId, dateRange)
  }

  if (isDefaultRange) {
    fetchPromise = doLoad().finally(() => { fetchPromise = null })
    return fetchPromise
  }

  return doLoad()
}

// ── Preload IDB into memCache synchronously (call before component mounts) ────
// Allows the reports page to render instantly from IDB without waiting for API.

export async function preloadFromIDB(storeId: string): Promise<void> {
  if (memCache && memCache.storeId === storeId) return // already warm
  const cached = await idbGet(storeId)
  if (cached && cached.storeId === storeId) {
    memCache = cached
    notify()
  }
}

// ── Fetch from API (parallel, non-blocking) ───────────────────────────────────

async function fetchReports(
  storeId: string,
  dateRange?: { from: Date; to: Date }
): Promise<ReportsData> {
  const params = new URLSearchParams({ storeId })
  if (dateRange?.from) params.set("from", dateRange.from.toLocaleDateString("en-CA"))
  if (dateRange?.to) params.set("to", dateRange.to.toLocaleDateString("en-CA"))

  // Fire all 3 fetches in parallel — don't wait for the slowest one
  const [salesRes, ewalletRes, billsRes] = await Promise.allSettled([
    fetch(`/api/sales?${params}`).then(r => r.json()),
    fetch(`/api/ewallet-transactions?${params}`).then(r => r.json()),
    fetch(`/api/bill-payments?${params}`).then(r => r.json()),
  ])

  const data: ReportsData = {
    sales: salesRes.status === "fulfilled" ? (salesRes.value.data ?? []) : (memCache?.sales ?? []),
    ewallet: ewalletRes.status === "fulfilled" ? (ewalletRes.value.data ?? []) : (memCache?.ewallet ?? []),
    bills: billsRes.status === "fulfilled" ? (billsRes.value.data ?? []) : (memCache?.bills ?? []),
    fetchedAt: Date.now(),
    storeId,
  }

  // Only persist default-range data to IDB
  if (!dateRange) {
    memCache = data
    await idbSet(data)
    notify()
  }

  return data
}

// ── Expose current cache synchronously ───────────────────────────────────────

export function getMemReports(): ReportsData | null {
  return memCache
}

// ── Invalidate (called after a sale completes) ────────────────────────────────

export function invalidateReports() {
  memCache = null
  fetchPromise = null
  // Trigger a fresh background fetch if there are subscribers
  if (subscribers.size > 0) {
    const storeId = getStoreId()
    if (storeId) fetchReports(storeId, undefined).catch(() => {})
  }
}
