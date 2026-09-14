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
let memCacheKey = "" // tracks which range is cached
let fetchPromise: Promise<ReportsData> | null = null
const subscribers = new Set<() => void>()

const IDB_KEY = "reports_cache"
const STALE_MS = 2 * 60 * 1000

function rangeKey(dateRange?: { from: Date; to: Date }): string {
  if (!dateRange) return "default"
  return `${dateRange.from.toLocaleDateString("en-CA")}_${dateRange.to.toLocaleDateString("en-CA")}`
}

// ── Subscribers ───────────────────────────────────────────────────────────────

export function subscribeReports(fn: () => void): () => void {
  subscribers.add(fn)
  return () => subscribers.delete(fn)
}

function notify() {
  subscribers.forEach(fn => fn())
}

// ── IDB helpers ───────────────────────────────────────────────────────────────

async function idbGet(storeId: string, key: string): Promise<ReportsData | null> {
  try {
    const db = await getDB()
    const entry = await (db as any).get("syncMeta", `${IDB_KEY}_${storeId}_${key}`)
    if (!entry?.data) return null
    return entry.data as ReportsData
  } catch {
    return null
  }
}

async function idbSet(data: ReportsData, key: string): Promise<void> {
  try {
    const db = await getDB()
    await (db as any).put("syncMeta", {
      collection: `${IDB_KEY}_${data.storeId}_${key}`,
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
  const key = rangeKey(dateRange)

  // 1. Memory hit — instant
  if (memCache && memCache.storeId === storeId && memCacheKey === key) {
    if (Date.now() - memCache.fetchedAt > STALE_MS) {
      fetchReports(storeId, dateRange).catch(() => {})
    }
    return memCache
  }

  // 2. Deduplicate concurrent calls for same key
  if (fetchPromise && memCacheKey === key) return fetchPromise

  const doLoad = async (): Promise<ReportsData> => {
    // 3. IDB hit
    const cached = await idbGet(storeId, key)
    if (cached && cached.storeId === storeId) {
      memCache = cached
      memCacheKey = key
      notify()
      fetchReports(storeId, dateRange).catch(() => {})
      return cached
    }
    // 4. Fetch from API
    return fetchReports(storeId, dateRange)
  }

  fetchPromise = doLoad().finally(() => { fetchPromise = null })
  return fetchPromise
}

// ── Preload IDB into memCache (now called internally by loadReports) ──────────
// Kept for backward compatibility but loadReports handles this automatically.
export async function preloadFromIDB(storeId: string): Promise<void> {
  if (memCache && memCache.storeId === storeId) return
  const cached = await idbGet(storeId, memCacheKey || "default")
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
  const key = rangeKey(dateRange)
  const params = new URLSearchParams({ storeId })
  if (dateRange?.from) params.set("from", dateRange.from.toLocaleDateString("en-CA"))
  if (dateRange?.to) params.set("to", dateRange.to.toLocaleDateString("en-CA"))

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

  memCache = data
  memCacheKey = key
  await idbSet(data, key)
  notify()

  return data
}

// ── Expose current cache synchronously ───────────────────────────────────────

export function getMemReports(): ReportsData | null {
  return memCache
}

// ── Invalidate (called after a sale completes) ────────────────────────────────

export function invalidateReports() {
  memCache = null
  memCacheKey = ""
  fetchPromise = null
  if (subscribers.size > 0) {
    const storeId = getStoreId()
    if (storeId) fetchReports(storeId, undefined).catch(() => {})
  }
}
