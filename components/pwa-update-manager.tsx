"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw, Download } from "lucide-react"

export function PWAUpdateManager() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return

    const checkForUpdate = async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration()
        if (!reg) return

        // Listen for new SW installing
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing
          if (!newWorker) return
          newWorker.addEventListener("statechange", () => {
            // New SW is ready and waiting — show update banner
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateAvailable(true)
            }
          })
        })

        // Also check if there's already a waiting worker (e.g. from a previous visit)
        if (reg.waiting && navigator.serviceWorker.controller) {
          setUpdateAvailable(true)
        }
      } catch {}
    }

    checkForUpdate()
  }, [])

  const handleUpdate = () => {
    setIsUpdating(true)

    navigator.serviceWorker.getRegistration().then(reg => {
      if (!reg) { window.location.reload(); return }

      // Guard: if we already reloaded for this update, don't reload again
      if (sessionStorage.getItem("sw_reloading")) {
        sessionStorage.removeItem("sw_reloading")
        setIsUpdating(false)
        setUpdateAvailable(false)
        return
      }

      const doReload = () => {
        if (sessionStorage.getItem("sw_reloading")) return
        sessionStorage.setItem("sw_reloading", "1")
        window.location.reload()
      }

      if (reg.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" })
      }

      navigator.serviceWorker.addEventListener("controllerchange", doReload, { once: true })

      // Fallback: reload after 3s if controllerchange never fires
      setTimeout(doReload, 3000)
    })
  }

  if (!updateAvailable) return null

  return (
    <div className="fixed top-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-80">
      <div className="rounded-lg border border-green-200 bg-green-50 shadow-lg p-4">
        <div className="flex items-start gap-3">
          <Download className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-800">
              New version available!
            </p>
            <p className="text-xs text-green-700 mt-1">
              Tap update to get the latest features.
            </p>
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                onClick={handleUpdate}
                disabled={isUpdating}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isUpdating ? (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Now"
                )}
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
