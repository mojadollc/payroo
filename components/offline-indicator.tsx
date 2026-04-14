"use client"

import { useState, useEffect } from "react"
import { Wifi, WifiOff, CloudUpload } from "lucide-react"
import { getOfflineQueue, syncOfflineQueue, isOnline as checkOnline } from "@/lib/offline-sync"

export function OfflineIndicator() {
  const [online, setOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [justSynced, setJustSynced] = useState(0)

  useEffect(() => {
    setOnline(checkOnline())
    setPendingCount(getOfflineQueue().length)

    const goOnline = () => {
      setOnline(true)
      setPendingCount(getOfflineQueue().length)
    }
    const goOffline = () => {
      setOnline(false)
      setPendingCount(getOfflineQueue().length)
    }
    const onSyncComplete = (e: Event) => {
      const { synced } = (e as CustomEvent).detail
      setPendingCount(getOfflineQueue().length)
      if (synced > 0) {
        setJustSynced(synced)
        setTimeout(() => setJustSynced(0), 4000)
      }
    }
    // Refresh pending count periodically
    const interval = setInterval(() => setPendingCount(getOfflineQueue().length), 5000)

    window.addEventListener("online", goOnline)
    window.addEventListener("offline", goOffline)
    window.addEventListener("offline-sync-complete", onSyncComplete)
    return () => {
      window.removeEventListener("online", goOnline)
      window.removeEventListener("offline", goOffline)
      window.removeEventListener("offline-sync-complete", onSyncComplete)
      clearInterval(interval)
    }
  }, [])

  // Show sync success toast
  if (justSynced > 0) {
    return (
      <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-green-600 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
        <CloudUpload className="h-3.5 w-3.5" />
        {justSynced} offline sale{justSynced > 1 ? "s" : ""} synced ✓
      </div>
    )
  }

  if (!online) {
    return (
      <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-yellow-500 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg">
        <WifiOff className="h-3.5 w-3.5" />
        Offline Mode{pendingCount > 0 ? ` · ${pendingCount} pending` : ""}
      </div>
    )
  }

  if (pendingCount > 0) {
    return (
      <div
        className="fixed top-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-blue-500 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg cursor-pointer"
        onClick={() => syncOfflineQueue()}
      >
        <CloudUpload className="h-3.5 w-3.5 animate-pulse" />
        Syncing {pendingCount} sale{pendingCount > 1 ? "s" : ""}...
      </div>
    )
  }

  return null
}
