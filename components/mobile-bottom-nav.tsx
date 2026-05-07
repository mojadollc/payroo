"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  Store, Package, Smartphone, TrendingUp, HandCoins, Star,
  Brain, BarChart2, Users, Settings, MoreHorizontal, X, Truck, FileText,
} from "lucide-react"
import { useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useSubscription } from "@/hooks/use-subscription"
import type { SubscriptionFeatures, SubadminPermissions } from "@/lib/firebase/types"

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  feature?: keyof SubscriptionFeatures
  permission?: keyof SubadminPermissions
  ownerOnly?: boolean
}

const ALL_ITEMS: NavItem[] = [
  { href: "/pos",                 label: "POS",          icon: Store,      feature: "pos" },
  { href: "/inventory",           label: "Inventory",    icon: Package,    feature: "inventory",          ownerOnly: true },
  { href: "/ewallet",             label: "E-Wallet",     icon: Smartphone, feature: "ewallet",            ownerOnly: true },
  { href: "/utang",               label: "Utang",        icon: HandCoins,  feature: "utang",              ownerOnly: true },
  { href: "/elista",              label: "e-Lista",      icon: FileText,                                  ownerOnly: true },
  { href: "/loyalty",             label: "Loyalty",      icon: Star,       feature: "loyalty",            ownerOnly: true },
  { href: "/restock",             label: "AI Restock",   icon: Brain,      feature: "aiRestock",          ownerOnly: true },
  { href: "/reports",             label: "Reports",      icon: TrendingUp, feature: "reports" },
  { href: "/market-intelligence", label: "Market",       icon: BarChart2,  feature: "marketIntelligence", ownerOnly: true },
  { href: "/delivery-manage",     label: "Delivery",     icon: Truck,      feature: "delivery",           ownerOnly: true },
  { href: "/users",               label: "Users",        icon: Users,      feature: "multiUser", permission: "manageUsers",     ownerOnly: true },
  { href: "/settings",            label: "Settings",     icon: Settings,   permission: "manageSettings",  ownerOnly: true },
]

// Max tabs shown in bottom bar (rest go into "More" sheet)
const MAX_TABS = 4

export function MobileBottomNav() {
  const pathname = usePathname()
  const { user, isCashier, hasFeature, hasPermission, loading: authLoading } = useAuth()
  const { features, isActive } = useSubscription()
  const [moreOpen, setMoreOpen] = useState(false)

  if (!user || authLoading) return null

  const isOwner = user?.role === "owner"
  const visibleItems = ALL_ITEMS.filter(item => {
    if (!user) return false
    if (isCashier && item.ownerOnly) return false
    // Owner bypasses ALL subscription feature checks
    if (isOwner) return true
    if (item.feature) {
      if (item.feature === "pos") return true
      if (!isActive || !features[item.feature] || !hasFeature(item.feature)) return false
    }
    if (item.permission && !hasPermission(item.permission)) return false
    return true
  })

  const primaryTabs = visibleItems.slice(0, MAX_TABS)
  const overflowTabs = visibleItems.slice(MAX_TABS)
  const hasMore = overflowTabs.length > 0

  return (
    <>
      {/* Bottom nav bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card border-t safe-area-bottom">
        <div className="flex items-stretch justify-around">
          {primaryTabs.map(item => {
            const Icon = item.icon
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center flex-1 py-2 gap-0.5 min-h-[56px] active:scale-95 transition-transform ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium leading-tight">{item.label}</span>
              </Link>
            )
          })}
          {hasMore && (
            <button
              onClick={() => setMoreOpen(true)}
              className={`flex flex-col items-center justify-center flex-1 py-2 gap-0.5 min-h-[56px] active:scale-95 transition-transform ${
                overflowTabs.some(i => pathname === i.href) ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <MoreHorizontal className="h-5 w-5" />
              <span className="text-[10px] font-medium leading-tight">More</span>
            </button>
          )}
        </div>
      </nav>

      {/* "More" bottom sheet */}
      {moreOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMoreOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-background rounded-t-2xl safe-area-bottom animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <span className="font-semibold text-sm">More</span>
              <button onClick={() => setMoreOpen(false)} className="p-1 rounded-full hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1 px-3 pb-4">
              {overflowTabs.map(item => {
                const Icon = item.icon
                const active = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex flex-col items-center justify-center py-3 rounded-xl active:scale-95 transition-transform ${
                      active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className="h-6 w-6 mb-1" />
                    <span className="text-[11px] font-medium">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
