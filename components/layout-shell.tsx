"use client"

import type React from "react"
import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from "@/hooks/use-auth"
import { SubscriptionProvider } from "@/hooks/use-subscription"
import { AuthGuard } from "@/components/auth-guard"
import { OfflineIndicator } from "@/components/offline-indicator"
import { initOfflineSync } from "@/lib/offline-sync"
import { initOfflineDB } from "@/lib/offline/sync-engine"

const PUBLIC_ROUTES = ["/", "/dashboard", "/login", "/subscription", "/payment/success", "/payment/failed", "/management", "/setup", "/affiliate", "/delivery"]

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isPublic = PUBLIC_ROUTES.includes(pathname) || pathname.startsWith("/delivery")

  useEffect(() => { initOfflineSync(); initOfflineDB() }, [])

  return (
    <AuthProvider>
      <SubscriptionProvider>
        <AuthGuard>
          {!isPublic && <Navbar />}
          {!isPublic && <OfflineIndicator />}
          <div className={!isPublic ? "pb-[72px] md:pb-0" : ""}>
            {children}
          </div>
          {!isPublic && <MobileBottomNav />}
          {!isPublic && (
            <footer className="border-t py-4 mt-8 hidden md:block">
              <p className="text-center text-xs text-muted-foreground">
                Built by: <span className="font-semibold">MOJADOO</span>
              </p>
            </footer>
          )}
        </AuthGuard>
      </SubscriptionProvider>
      <Toaster />
    </AuthProvider>
  )
}
