"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { RefreshCw, Download } from "lucide-react"

export function PWAUpdateManager() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return

    let refreshing = false

    const registerSW = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js")
        setRegistration(reg)

        // Check for updates every 30 seconds
        const checkForUpdates = () => {
          reg.update().catch(() => {}) // Silent fail
        }
        
        const updateInterval = setInterval(checkForUpdates, 30000)

        // Listen for new service worker
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing
          if (!newWorker) return

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // New version available
              setUpdateAvailable(true)
            }
          })
        })

        // Listen for controlling service worker change
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (refreshing) return
          refreshing = true
          window.location.reload()
        })

        // Check for update immediately
        checkForUpdates()

        return () => clearInterval(updateInterval)
      } catch (error) {
        console.error("SW registration failed:", error)
      }
    }

    registerSW()
  }, [])

  const handleUpdate = async () => {
    if (!registration) return

    setIsUpdating(true)
    
    try {
      // Tell the waiting service worker to skip waiting
      if (registration.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" })
      }
      
      // Force update
      await registration.update()
      
      // Clear all caches to prevent stale content
      if ("caches" in window) {
        const cacheNames = await caches.keys()
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        )
      }

      // Reload the page
      setTimeout(() => {
        window.location.reload()
      }, 500)
    } catch (error) {
      console.error("Update failed:", error)
      setIsUpdating(false)
    }
  }

  const handleRefresh = async () => {
    setIsUpdating(true)
    
    try {
      // Clear all caches
      if ("caches" in window) {
        const cacheNames = await caches.keys()
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        )
      }

      // Force reload from network
      window.location.reload()
    } catch (error) {
      console.error("Refresh failed:", error)
      setIsUpdating(false)
    }
  }

  // Auto-update notification
  if (updateAvailable) {
    return (
      <div className="fixed top-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-80">
        <Card className="border-green-200 bg-green-50 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Download className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-green-800">
                  New version available!
                </p>
                <p className="text-xs text-green-700 mt-1">
                  Update now to get the latest features and fixes.
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
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
}

// Hook for manual refresh functionality
export function useAppRefresh() {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const refresh = async () => {
    setIsRefreshing(true)
    
    try {
      // Clear all caches
      if ("caches" in window) {
        const cacheNames = await caches.keys()
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        )
      }

      // Update service worker
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration()
        if (registration) {
          await registration.update()
        }
      }

      // Force reload from network
      window.location.reload()
    } catch (error) {
      console.error("Refresh failed:", error)
      setIsRefreshing(false)
    }
  }

  return { refresh, isRefreshing }
}