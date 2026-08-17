"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  Store, Package, TrendingUp, HandCoins, Star,
  Brain, BarChart2, Users, Settings, MoreHorizontal, X, Truck, FileText, Smartphone, ListChecks, Receipt,
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

interface NavGroup {
  label: string
  items: NavItem[]
}

// Primary tabs (always in bottom bar)
const PRIMARY_TABS: NavItem[] = [
  { href: "/pos", label: "POS", icon: Store, feature: "pos" },
  { href: "/ewallet", label: "E-Wallet", icon: Smartphone, feature: "ewallet", ownerOnly: true },
  { href: "/inventory", label: "Inventory", icon: Package, feature: "inventory", ownerOnly: true },
  { href: "/bills", label: "Pay Bills", icon: Receipt, ownerOnly: true },
  { href: "/reports", label: "Reports", icon: TrendingUp, feature: "reports" },
]

// Grouped items (in "More" sheet)
const MORE_GROUPS: NavGroup[] = [
  {
    label: "Finance",
    items: [
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
  {
    label: "Management",
    items: [
      { href: "/users", label: "Users", icon: Users, feature: "multiUser", permission: "manageUsers", ownerOnly: true },
      { href: "/settings", label: "Settings", icon: Settings, permission: "manageSettings", ownerOnly: true },
    ],
  },
]

export function MobileBottomNav() {
  const pathname = usePathname()
  const { user, isCashier, hasFeature, hasPermission, loading: authLoading } = useAuth()
  const { features, isActive } = useSubscription()
  const [moreOpen, setMoreOpen] = useState(false)

  if (!user || authLoading) return null

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

  const visiblePrimary = filterItems(PRIMARY_TABS)
  const visibleGroups = MORE_GROUPS.map(group => ({
    ...group,
    items: filterItems(group.items),
  })).filter(group => group.items.length > 0)

  const hasMoreItems = visibleGroups.some(g => g.items.length > 0)

  return (
    <>
      {/* Floating pill bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden safe-area-bottom">
        <div className="mx-3 mb-3 rounded-[22px] bg-white/90 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-white/70 overflow-hidden">
          <div className="flex items-stretch justify-around">
            {visiblePrimary.map(item => {
              const Icon = item.icon
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center justify-center flex-1 py-2.5 gap-1 min-h-[54px] active:scale-90 transition-all duration-150 ${
                    active ? "text-primary" : "text-muted-foreground/70"
                  }`}
                >
                  <div className={`p-1.5 rounded-xl transition-all duration-150 ${
                    active ? "bg-primary/15" : ""
                  }`}>
                    <Icon className={`h-[18px] w-[18px] ${ active ? "stroke-[2.5]" : "stroke-[1.8]" }`} />
                  </div>
                  <span className={`text-[9px] font-semibold leading-none ${ active ? "text-primary" : "" }`}>{item.label}</span>
                </Link>
              )
            })}
            {hasMoreItems && (
              <button
                onClick={() => setMoreOpen(true)}
                className={`flex flex-col items-center justify-center flex-1 py-2.5 gap-1 min-h-[54px] active:scale-90 transition-all duration-150 ${
                  visibleGroups.some(g => g.items.some(i => pathname === i.href)) ? "text-primary" : "text-muted-foreground/70"
                }`}
              >
                <div className={`p-1.5 rounded-xl transition-all duration-150 ${
                  visibleGroups.some(g => g.items.some(i => pathname === i.href)) ? "bg-primary/15" : ""
                }`}>
                  <MoreHorizontal className="h-[18px] w-[18px] stroke-[1.8]" />
                </div>
                <span className="text-[9px] font-semibold leading-none">More</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* "More" bottom sheet */}
      {moreOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMoreOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl rounded-t-3xl safe-area-bottom animate-in slide-in-from-bottom duration-200 max-h-[80vh] overflow-y-auto border-t border-white/60 shadow-[0_-8px_40px_rgba(0,0,0,0.12)]">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-border/60" />
            </div>
            <div className="flex items-center justify-between px-5 pt-2 pb-3">
              <span className="font-bold text-[15px] tracking-tight">More Features</span>
              <button onClick={() => setMoreOpen(false)} className="p-1.5 rounded-full bg-muted/60 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-4 pb-6">
              {visibleGroups.map((group, idx) => (
                <div key={group.label} className={idx > 0 ? "mt-5" : "mt-1"}>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1 mb-3">{group.label}</p>
                  <div className="grid grid-cols-4 gap-2">
                    {group.items.map(item => {
                      const Icon = item.icon
                      const active = pathname === item.href
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMoreOpen(false)}
                          className={`flex flex-col items-center justify-center py-3.5 rounded-2xl active:scale-90 transition-all duration-150 gap-1.5 ${
                            active
                              ? "bg-primary/15 text-primary"
                              : "bg-muted/40 text-muted-foreground hover:bg-muted/70"
                          }`}
                        >
                          <Icon className={`h-5 w-5 ${ active ? "stroke-[2.5]" : "stroke-[1.8]" }`} />
                          <span className="text-[10px] font-semibold text-center leading-tight">{item.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
