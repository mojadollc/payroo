"use client"

import { useState, useEffect, useCallback } from "react"
import { Wifi, WifiOff, CloudUpload, CheckCircle2, XCircle, RefreshCw } from "lucide-react"
import { getOfflineQueue, syncOfflineQueue, isOnline as checkOnline } from "@/lib/offline-sync"
import { getPendingWriteCount, pushPendingWrites } from "@/lib/offline/sync-engine"

type SyncState = "idle" | "syncing" | "success" | "failed"

export function OfflineIndicator() {
  const [online, setOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncState, setSyncState] = useState<SyncState>("idle")
  const [syncedCount, setSyncedCount] = useState(0)
  const [failedCount, setFailedCount] = useState(0)

  const updatePendingCount = useCallback(async () => {
    const legacyCount = getOfflineQueue().length
    const idbCount = await getPendingWriteCount().catch(() => 0)
    setPendingCount(legacyCount + idbCount)
  }, [])

  const triggerSync = useCallback(async () => {
    if (!checkOnline()) return
    setSyncState("syncing")
    try {
      await syncOfflineQueue()
      const result = await pushPendingWrites()
      await updatePendingCount()
      if (result.failed > 0) {
        setFailedCount(result.failed)
        setSyncedCount(result.synced)
        setSyncState("failed")
      } else if (result.synced > 0) {
        setSyncedCount(result.synced)
        setSyncState("success")
      } else {
        setSyncState("idle")
      }
    } catch {
      setSyncState("failed")
      setFailedCount(1)
    }
    setTimeout(() => setSyncState("idle"), 4000)
  }, [updatePendingCount])

  useEffect(() => {
    setOnline(checkOnline())
    updatePendingCount()

    const goOnline = () => {
      setOnline(true)
      updatePendingCount()
      // Trigger sync immediately when back online
      setTimeout(triggerSync, 800)
    }
    const goOffline = () => {
      setOnline(false)
      updatePendingCount()
    }

    const onSyncComplete = (e: Event) => {
      const { synced, failed } = (e as CustomEvent).detail ?? {}
      updatePendingCount()
      if (failed > 0) {
        setFailedCount(failed)
        setSyncedCount(synced ?? 0)
        setSyncState("failed")
        setTimeout(() => setSyncState("idle"), 5000)
      } else if (synced > 0) {
        setSyncedCount(synced)
        setSyncState("success")
        setTimeout(() => setSyncState("idle"), 3500)
      }
      // Notify e-lista page to refresh
      window.dispatchEvent(new CustomEvent("elista-sync-complete"))
    }

    // Poll every 2s (was 5s) to catch pending writes faster
    const interval = setInterval(updatePendingCount, 2000)

    window.addEventListener("online", goOnline)
    window.addEventListener("offline", goOffline)
    window.addEventListener("offline-sync-complete", onSyncComplete)

    return () => {
      window.removeEventListener("online", goOnline)
      window.removeEventListener("offline", goOffline)
      window.removeEventListener("offline-sync-complete", onSyncComplete)
      clearInterval(interval)
    }
  }, [updatePendingCount, triggerSync])

  // ── Success banner ──
  if (syncState === "success") {
    return (
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-green-600 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-xl animate-in fade-in slide-in-from-top-3 duration-300">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        {syncedCount} item{syncedCount !== 1 ? "s" : ""} synced successfully ✓
      </div>
    )
  }

  // ── Failed banner ──
  if (syncState === "failed") {
    return (
      <div
        className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-red-600 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-xl animate-in fade-in slide-in-from-top-3 duration-300 cursor-pointer"
        onClick={triggerSync}
        title="Tap to retry"
      >
        <XCircle className="h-3.5 w-3.5 shrink-0" />
        {failedCount} sync failed — tap to retry
        {syncedCount > 0 && <span className="opacity-75">({syncedCount} ok)</span>}
      </div>
    )
  }

  // ── Offline banner ──
  if (!online) {
    return (
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-yellow-500 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-xl">
        <WifiOff className="h-3.5 w-3.5 shrink-0" />
        Offline{pendingCount > 0 ? ` · ${pendingCount} pending` : ""}
      </div>
    )
  }

  // ── Syncing banner ──
  if (syncState === "syncing" || pendingCount > 0) {
    const label = pendingCount === 1 ? "1 change" : `${pendingCount} changes`
    return (
      <div
        className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-xl cursor-pointer hover:bg-blue-600 transition-colors"
        onClick={triggerSync}
        title="Tap to sync now"
      >
        <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${syncState === "syncing" ? "animate-spin" : "animate-pulse"}`} />
        {syncState === "syncing" ? `Syncing…` : `${label} pending — tap to sync`}
      </div>
    )
  }

  return null
}
