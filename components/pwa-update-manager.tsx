"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw, Download } from "lucide-react"

export function PWAUpdateManager() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return

    // Clear any stale reload guard from a previous session
    sessionStorage.removeItem("sw_reloading")

    navigator.serviceWorker.getRegistration().then(reg => {
      if (!reg) return

      const onNewWorkerReady = (worker: ServiceWorker) => {
        worker.addEventListener("statechange", () => {
          // Only show banner when new SW is waiting AND there is an active controller
          // (i.e. this is an update, not a first install)
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            setUpdateAvailable(true)
          }
        })
      }

      // New SW found during this session
      reg.addEventListener("updatefound", () => {
        if (reg.installing) onNewWorkerReady(reg.installing)
      })

      // SW was already waiting before this page loaded
      if (reg.waiting && navigator.serviceWorker.controller) {
        setUpdateAvailable(true)
      }
    }).catch(() => {})
  }, [])

  const handleUpdate = () => {
    if (isUpdating) return
    setIsUpdating(true)

    navigator.serviceWorker.getRegistration().then(reg => {
      if (!reg?.waiting) {
        // No waiting worker — just reload to get fresh content
        window.location.reload()
        return
      }

      // Listen for controller change ONCE, then reload exactly once
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.location.reload()
      }, { once: true })

      // Tell the waiting SW to activate
      reg.waiting.postMessage({ type: "SKIP_WAITING" })

      // Safety fallback: if controllerchange never fires within 4s, reload anyway
      setTimeout(() => window.location.reload(), 4000)
    }).catch(() => window.location.reload())
  }

  if (!updateAvailable) return null

  return (
    <div className="fixed top-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-80">
      <div className="rounded-xl border border-green-200 bg-green-50 shadow-lg p-4">
        <div className="flex items-start gap-3">
          <Download className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-green-800">Update available!</p>
            <p className="text-xs text-green-700 mt-0.5">Tap update to get the latest version.</p>
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                onClick={handleUpdate}
                disabled={isUpdating}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isUpdating
                  ? <><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Updating...</>
                  : "Update Now"
                }
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setUpdateAvailable(false)}
                className="border-green-300 text-green-700 hover:bg-green-100"
              >
                Later
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function useAppRefresh() {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const refresh = async () => {
    setIsRefreshing(true)
    try {
      if ("caches" in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map(k => caches.delete(k)))
      }
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration()
        if (reg) await reg.update()
      }
      window.location.reload()
    } catch {
      setIsRefreshing(false)
    }
  }

  return { refresh, isRefreshing }
}
