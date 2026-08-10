"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

const SESSION_KEY = "visitor_tracked"
const TRACK_INTERVAL_MS = 30 * 60 * 1000

function isPWAInstalled(): boolean {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  )
}

export function VisitorTracker() {
  const pathname = usePathname()

  useEffect(() => {
    if (pathname?.startsWith("/management")) return

    const isPWA = isPWAInstalled()
    const trackKey = `${SESSION_KEY}_${pathname}_${isPWA ? "pwa" : "web"}`
    const lastTracked = sessionStorage.getItem(trackKey)
    if (lastTracked && Date.now() - Number(lastTracked) < TRACK_INTERVAL_MS) return

    const track = async () => {
      try {
        const res = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(5000) })
        if (!res.ok) return
        const geo = await res.json()

        await fetch("/api/visitor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ip: geo.ip || "unknown",
            country: geo.country_name || "Unknown",
            countryCode: geo.country_code || "XX",
            city: geo.city || "Unknown",
            region: geo.region || "Unknown",
            page: pathname || "/",
            referrer: document.referrer || "",
            userAgent: navigator.userAgent || "",
            isPWA,
          }),
        })

        sessionStorage.setItem(trackKey, String(Date.now()))
      } catch {}
    }

    track()
  }, [pathname])

  return null
}
