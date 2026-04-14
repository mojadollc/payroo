"use client"

import type React from "react"
import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from "@/hooks/use-auth"
import { AuthGuard } from "@/components/auth-guard"
import { OfflineIndicator } from "@/components/offline-indicator"
import { initOfflineSync } from "@/lib/offline-sync"

const PUBLIC_ROUTES = ["/", "/dashboard", "/login", "/subscription", "/payment/success", "/payment/failed", "/management", "/setup", "/affiliate"]

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isPublic = PUBLIC_ROUTES.includes(pathname)

  useEffect(() => { initOfflineSync() }, [])

  return (
    <AuthProvider>
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
      <Toaster />
    </AuthProvider>
  )
}
