"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Store, Package, Smartphone, TrendingUp, Menu, Settings, Download,
  HandCoins, Star, Brain, Users, LogOut, BarChart2, RefreshCw, Truck, FileText,
  ChevronDown, ListChecks,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getStoreSettings } from "@/lib/firebase/services"
import { useAuth } from "@/hooks/use-auth"
import { useSubscription } from "@/hooks/use-subscription"
import { useAppRefresh } from "@/components/pwa-update-manager"
import type { SubscriptionFeatures, SubadminPermissions } from "@/lib/firebase/types"

export const STORE_NAME_KEY = "storeName"
export const DEFAULT_STORE_NAME = "POS Inventory"
export const STORE_ADDRESS_KEY = "storeAddress"

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  feature?: keyof SubscriptionFeatures
  permission?: keyof SubadminPermissions
  ownerOnly?: boolean
}

interface NavGroup {
  label: string
  items: NavItem[]
}

// Primary nav items (always visible in main bar)
const PRIMARY_NAV: NavItem[] = [
  { href: "/pos", label: "POS", icon: Store, feature: "pos" },
  { href: "/inventory", label: "Inventory", icon: Package, feature: "inventory", ownerOnly: true },
  { href: "/reports", label: "Reports", icon: TrendingUp, feature: "reports" },
]

// Grouped nav items (in dropdown menus)
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Finance",
    items: [
      { href: "/ewallet", label: "E-Wallet", icon: Smartphone, feature: "ewallet", ownerOnly: true },
      { href: "/utang", label: "Utang", icon: HandCoins, feature: "utang", ownerOnly: true },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/elista", label: "e-Lista", icon: FileText, ownerOnly: true },
      { href: "/checklist", label: "Checklist", icon: ListChecks },
      { href: "/restock", label: "AI Restock", icon: Brain, feature: "aiRestock", ownerOnly: true },
      { href: "/delivery-manage", label: "Delivery", icon: Truck, feature: "delivery", ownerOnly: true },
    ],
  },
  {
    label: "Marketing",
    items: [
      { href: "/loyalty", label: "Loyalty", icon: Star, feature: "loyalty", ownerOnly: true },
      { href: "/market-intelligence", label: "Market Intel", icon: BarChart2, feature: "marketIntelligence", ownerOnly: true },
    ],
  },
]

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout, isCashier, hasFeature, hasPermission, loading: authLoading } = useAuth()
  const { features, isActive, tier } = useSubscription()
  const { refresh, isRefreshing } = useAppRefresh()
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

  const isOwner = user?.role === "owner"

  const filterItems = (items: NavItem[]) => items.filter(item => {
    if (!user) return false
    if (isCashier && item.ownerOnly) return false
    if (isOwner) return true
    if (item.feature) {
      if (item.feature === "pos") return true
      if (!isActive || !features[item.feature] || !hasFeature(item.feature)) return false
    }
    if (item.permission && !hasPermission(item.permission)) return false
    return true
  })

  const visiblePrimary = filterItems(PRIMARY_NAV)
  const visibleGroups = NAV_GROUPS.map(group => ({
    ...group,
    items: filterItems(group.items),
  })).filter(group => group.items.length > 0)

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

  return (
    <nav className="border-b bg-card sticky top-0 z-50 hidden md:block">
      <div className="container mx-auto px-4">
        <div className="flex h-14 items-center gap-3">
          {/* Logo */}
          <Link href="/pos" className="flex items-center gap-2 shrink-0">
            <img src="/logo.svg" alt="Logo" className="h-7 w-7 rounded" />
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-sm">{storeName}</span>
              <span className="text-[9px] text-muted-foreground tracking-wide">
                ID: {typeof window !== "undefined" ? localStorage.getItem("pos_ext_id") ?? "" : ""}
              </span>
            </div>
          </Link>

          {/* Primary nav items */}
          <div className="flex items-center gap-0.5">
            {visiblePrimary.map((item) => {
              const Icon = item.icon
              const active = pathname === item.href
              return (
                <Link key={item.href} href={item.href}>
                  <Button variant={active ? "default" : "ghost"} size="sm" className="gap-1.5 h-8 px-2.5 text-xs shrink-0">
                    <Icon className="h-3.5 w-3.5" /> {item.label}
                  </Button>
                </Link>
              )
            })}

            {/* Grouped nav dropdowns */}
            {visibleGroups.map((group) => {
              const hasActive = group.items.some(item => pathname === item.href)
              return (
                <DropdownMenu key={group.label}>
                  <DropdownMenuTrigger asChild>
                    <Button variant={hasActive ? "default" : "ghost"} size="sm" className="gap-1 h-8 px-2.5 text-xs shrink-0">
                      {group.label} <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {group.items.map((item) => {
                      const Icon = item.icon
                      const active = pathname === item.href
                      return (
                        <DropdownMenuItem key={item.href} asChild>
                          <Link href={item.href} className={`flex items-center gap-2 cursor-pointer ${active ? 'bg-accent' : ''}`}>
                            <Icon className="h-4 w-4" /> {item.label}
                          </Link>
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )
            })}
          </div>

          <div className="flex-1" />

          {/* Management & Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Settings & Users dropdown */}
            {(hasPermission("manageSettings") || hasPermission("manageUsers")) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1 h-8 px-2.5 text-xs shrink-0">
                    <Settings className="h-3.5 w-3.5" /> Manage
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Management</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {hasPermission("manageUsers") && (
                    <DropdownMenuItem asChild>
                      <Link href="/users" className="flex items-center gap-2 cursor-pointer">
                        <Users className="h-4 w-4" /> Users
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {hasPermission("manageSettings") && (
                    <DropdownMenuItem asChild>
                      <Link href="/settings" className="flex items-center gap-2 cursor-pointer">
                        <Settings className="h-4 w-4" /> Settings
                      </Link>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <Button
              variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary"
              onClick={refresh} disabled={isRefreshing} title="Refresh app"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            {installPrompt && (
              <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs border-primary text-primary" onClick={handleInstall}>
                <Download className="h-3.5 w-3.5" /> Install
              </Button>
            )}
            {!authLoading && user && (
              <div className="flex items-center gap-1.5 ml-1 pl-1.5 border-l">
                <div className="text-right hidden lg:block">
                  <p className="text-[11px] font-semibold leading-none">{user.name}</p>
                  <div className="flex items-center gap-1 justify-end mt-0.5">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium capitalize ${ROLE_BADGE[user.role]}`}>{user.role}</span>
                    {tier && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium uppercase ${TIER_BADGE[tier] || TIER_BADGE.basic}`}>{tier}</span>}
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={handleLogout} title="Logout">
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile sheet — unchanged */}
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
                {tier && <span className={`text-xs px-2 py-0.5 rounded-full font-medium uppercase ${TIER_BADGE[tier] || TIER_BADGE.basic}`}>{tier}</span>}
                <span className="text-sm font-medium">{user.name}</span>
              </div>
            )}
          </SheetHeader>
          <div className="mt-6 flex flex-col gap-2">
            {/* Primary items */}
            {visiblePrimary.map((item) => {
              const Icon = item.icon
              const active = pathname === item.href
              return (
                <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}>
                  <Button variant={active ? "default" : "ghost"} className="w-full justify-start gap-2">
                    <Icon className="h-4 w-4" /> {item.label}
                  </Button>
                </Link>
              )
            })}
            
            {/* Grouped items */}
            {visibleGroups.map((group) => (
              <div key={group.label} className="mt-2">
                <p className="text-xs font-semibold text-muted-foreground px-2 mb-1">{group.label}</p>
                {group.items.map((item) => {
                  const Icon = item.icon
                  const active = pathname === item.href
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}>
                      <Button variant={active ? "default" : "ghost"} className="w-full justify-start gap-2">
                        <Icon className="h-4 w-4" /> {item.label}
                      </Button>
                    </Link>
                  )
                })}
              </div>
            ))}
            
            {/* Management */}
            {(hasPermission("manageSettings") || hasPermission("manageUsers")) && (
              <div className="mt-2">
                <p className="text-xs font-semibold text-muted-foreground px-2 mb-1">Management</p>
                {hasPermission("manageUsers") && (
                  <Link href="/users" onClick={() => setMobileOpen(false)}>
                    <Button variant={pathname === "/users" ? "default" : "ghost"} className="w-full justify-start gap-2">
                      <Users className="h-4 w-4" /> Users
                    </Button>
                  </Link>
                )}
                {hasPermission("manageSettings") && (
                  <Link href="/settings" onClick={() => setMobileOpen(false)}>
                    <Button variant={pathname === "/settings" ? "default" : "ghost"} className="w-full justify-start gap-2">
                      <Settings className="h-4 w-4" /> Settings
                    </Button>
                  </Link>
                )}
              </div>
            )}
            <Button variant="ghost" className="w-full justify-start gap-2" onClick={refresh} disabled={isRefreshing}>
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh App'}
            </Button>
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
    </nav>
  )
}
