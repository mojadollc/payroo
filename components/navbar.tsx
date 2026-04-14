"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Store, Package, Smartphone, TrendingUp, Menu, Settings, Download,
  HandCoins, Star, Brain, Users, LogOut, BarChart2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { getStoreSettings } from "@/lib/firebase/services"
import { useAuth } from "@/hooks/use-auth"
import { useSubscription } from "@/hooks/use-subscription"
import type { SubscriptionFeatures, SubadminPermissions } from "@/lib/firebase/types"

export const STORE_NAME_KEY = "storeName"
export const DEFAULT_STORE_NAME = "POS Inventory"
export const STORE_ADDRESS_KEY = "storeAddress"

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  feature?: keyof SubscriptionFeatures
  permission?: keyof SubadminPermissions  // For management pages (Users, Settings)
  ownerOnly?: boolean // true = only owner/subadmin can see, cashier cannot
}

// All store nav items — visibility controlled by role + subscription plan
const NAV_ITEMS: NavItem[] = [
  { href: "/pos",                 label: "POS",           icon: Store,      feature: "pos" },
  { href: "/inventory",           label: "Inventory",     icon: Package,    feature: "inventory",          ownerOnly: true },
  { href: "/ewallet",             label: "E-Wallet",      icon: Smartphone, feature: "ewallet",            ownerOnly: true },
  { href: "/utang",               label: "Utang",         icon: HandCoins,  feature: "utang",              ownerOnly: true },
  { href: "/loyalty",             label: "Loyalty",       icon: Star,       feature: "loyalty",            ownerOnly: true },
  { href: "/restock",             label: "AI Restock",    icon: Brain,      feature: "aiRestock",          ownerOnly: true },
  { href: "/reports",             label: "Reports",       icon: TrendingUp, feature: "reports" },
  { href: "/market-intelligence", label: "Market Intel",  icon: BarChart2,  feature: "marketIntelligence", ownerOnly: true },
  { href: "/users",               label: "Users",         icon: Users,      feature: "multiUser", permission: "manageUsers",     ownerOnly: true },
  { href: "/settings",            label: "Settings",      icon: Settings,   permission: "manageSettings",  ownerOnly: true },
]

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout, isCashier, hasFeature, hasPermission, loading: authLoading } = useAuth()
  const { features, isActive, tier } = useSubscription()
  const [storeName, setStoreName] = useState(DEFAULT_STORE_NAME)
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    // Always fetch fresh from Firestore — never trust localStorage as source of truth
    const fetchStoreName = async () => {
      // Show cached value instantly while Firestore loads
      const cached = localStorage.getItem(STORE_NAME_KEY)
      if (cached) setStoreName(cached)
      try {
        const s = await getStoreSettings()
        if (s?.name) {
          setStoreName(s.name)
          localStorage.setItem(STORE_NAME_KEY, s.name)
        }
      } catch {}
    }
    fetchStoreName()

    // Re-fetch from Firestore whenever the store name is updated anywhere in the app
    const onStoreName = () => fetchStoreName()
    window.addEventListener("storename", onStoreName)
    // Also re-fetch on subscription refresh (in case superadmin changed the name)
    const onSubRefresh = () => fetchStoreName()
    window.addEventListener("subscription-refreshed", onSubRefresh)
    const beforeInstall = (e: any) => { e.preventDefault(); setInstallPrompt(e) }
    window.addEventListener("beforeinstallprompt", beforeInstall)
    return () => {
      window.removeEventListener("storename", onStoreName)
      window.removeEventListener("subscription-refreshed", onSubRefresh)
      window.removeEventListener("beforeinstallprompt", beforeInstall)
    }
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  const handleLogout = () => {
    logout()
    localStorage.removeItem("pos_ext_id")
    localStorage.removeItem("pos_subscription")
    localStorage.removeItem("customer_subscription")
    router.push("/")
  }

  // Build visible nav items based on role + subscription + user-level feature/permission access
  const visibleItems = NAV_ITEMS.filter(item => {
    if (!user) return false
    // Cashier can ONLY see POS and Reports
    if (isCashier && item.ownerOnly) return false
    // Check subscription feature AND user-level feature access (subadmin restrictions)
    if (item.feature) {
      if (item.feature === "pos") return true // POS always visible
      if (!isActive || !features[item.feature] || !hasFeature(item.feature)) return false
    }
    // Check management permissions (Users, Settings)
    if (item.permission && !hasPermission(item.permission)) return false
    return true
  })

  const TIER_BADGE: Record<string, string> = {
    basic:      "bg-slate-100 text-slate-600",
    gold:       "bg-yellow-100 text-yellow-700",
    enterprise: "bg-purple-100 text-purple-700",
  }

  const ROLE_BADGE: Record<string, string> = {
    owner:    "bg-purple-100 text-purple-700",
    subadmin: "bg-blue-100 text-blue-700",
    cashier:  "bg-green-100 text-green-700",
  }

  // Don't render navbar if not logged in
  if (!user && !authLoading) return null

  const NavLinks = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {visibleItems.map((item) => {
        const Icon = item.icon
        const active = pathname === item.href
        return (
          <Link key={item.href} href={item.href} onClick={() => mobile && setMobileOpen(false)}>
            <Button variant={active ? "default" : "ghost"} className={mobile ? "w-full justify-start gap-2" : "gap-2"}>
              <Icon className="h-4 w-4" /> {item.label}
            </Button>
          </Link>
        )
      })}
    </>
  )

  return (
    <nav className="border-b bg-card sticky top-0 z-50 hidden md:block">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/pos" className="flex items-center gap-2 shrink-0">
            <img src="/logo.svg" alt="Logo" className="h-8 w-8 rounded" />
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-base md:text-xl">{storeName}</span>
              <span className="text-[10px] text-muted-foreground tracking-wide hidden md:block">
                Store ID: {typeof window !== "undefined" ? localStorage.getItem("pos_ext_id") ?? "" : ""}
              </span>
            </div>
          </Link>

          {/* Desktop */}
          <div className="hidden items-center gap-1 md:flex flex-1 justify-end flex-wrap">
            <NavLinks />
            {installPrompt && (
              <Button variant="outline" className="gap-2 border-primary text-primary" onClick={handleInstall}>
                <Download className="h-4 w-4" /> Install
              </Button>
            )}
            {!authLoading && user && (
              <div className="flex items-center gap-2 ml-2 pl-2 border-l">
                <div className="text-right hidden lg:block">
                  <p className="text-xs font-semibold leading-none">{user.name}</p>
                  <div className="flex items-center gap-1 justify-end mt-0.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${ROLE_BADGE[user.role]}`}>
                      {user.role}
                    </span>
                    {tier && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium uppercase ${TIER_BADGE[tier] || TIER_BADGE.basic}`}>
                        {tier}
                      </span>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={handleLogout} title="Logout">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Mobile */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="outline" size="icon"><Menu className="h-5 w-5" /></Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle className="text-left">{storeName}</SheetTitle>
                {user && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${ROLE_BADGE[user.role]}`}>{user.role}</span>
                    {tier && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium uppercase ${TIER_BADGE[tier] || TIER_BADGE.basic}`}>{tier}</span>
                    )}
                    <span className="text-sm font-medium">{user.name}</span>
                  </div>
                )}
              </SheetHeader>
              <div className="mt-6 flex flex-col gap-2">
                <NavLinks mobile />
                {installPrompt && (
                  <Button variant="outline" className="w-full justify-start gap-2 border-primary text-primary" onClick={handleInstall}>
                    <Download className="h-4 w-4" /> Install App
                  </Button>
                )}
                <div className="border-t pt-2 mt-2">
                  <Button variant="ghost" className="w-full justify-start gap-2 text-destructive" onClick={() => { handleLogout(); setMobileOpen(false) }}>
                    <LogOut className="h-4 w-4" /> Logout
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  )
}
