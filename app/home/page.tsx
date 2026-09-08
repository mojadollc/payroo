"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Store, Package, TrendingUp, Smartphone,
  ShoppingCart, LogOut, X, ChevronRight,
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useSubscription } from "@/hooks/use-subscription"
import { getSession, clearSession } from "@/lib/pos-session"
import { getStoreId } from "@/lib/store-id"

const QUICK_ACTIONS = [
  { href: "/pos",       label: "POS",        icon: Store,      color: "#f59e0b", desc: "Start selling" },
  { href: "/inventory", label: "Inventory",  icon: Package,    color: "#10b981", desc: "Manage stock" },
  { href: "/reports",   label: "Reports",    icon: TrendingUp, color: "#6366f1", desc: "View analytics" },
  { href: "/ewallet",   label: "E-Wallet",   icon: Smartphone, color: "#ec4899", desc: "GCash & Maya" },
]

function fmt(n: number) {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export default function HomePage() {
  const router = useRouter()
  const { user, loading, logout } = useAuth()
  const { tier, isActive } = useSubscription()
  const [session] = useState(() => typeof window !== "undefined" ? getSession() : null)
  const [todaySales, setTodaySales] = useState<number | null>(null)
  const [showLogout, setShowLogout] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.push("/login")
  }, [user, loading, router])

  useEffect(() => {
    const storeId = getStoreId()
    if (!storeId) return
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    fetch(`/api/sales?storeId=${storeId}&from=${todayStart.toISOString()}&to=${todayEnd.toISOString()}&summary=1`)
      .then(r => r.json())
      .then(res => {
        const active = (res.data ?? []).filter((s: any) => s.status !== "voided")
        setTodaySales(active.reduce((sum: number, s: any) => sum + s.total, 0))
      })
      .catch(() => {})
  }, [])

  const handleLogout = async () => {
    setLoggingOut(true)
    await new Promise(r => setTimeout(r, 300))
    clearSession()
    logout()
    router.push("/login")
  }

  if (!user) return null

  const storeName = session?.storeName || "My Store"
  const ownerName = session?.ownerName || user?.name || "there"
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening"

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      {/* Clean Header */}
      <div className="bg-primary px-5 pt-14 pb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowLogout(true)}
              className="h-11 w-11 rounded-2xl bg-white/20 flex items-center justify-center active:scale-95 transition-transform"
            >
              <img src="/logo.svg" alt="Payroo" className="h-7 w-7" />
            </button>
            <div>
              <p className="text-xs font-medium text-amber-900/70">{greeting}</p>
              <p className="font-bold text-base text-amber-950">{ownerName.split(" ")[0]}</p>
            </div>
          </div>
          <Link href="/settings" className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
            <LogOut className="h-5 w-5 text-amber-950" />
          </Link>
        </div>

        <h1 className="text-xl font-bold text-amber-950 mb-1">{storeName}</h1>
        <p className="text-sm text-amber-900/60">
          {session?.externalId ? `Store #${session.externalId}` : "Payroo POS"}
          {tier ? ` · ${tier.charAt(0).toUpperCase() + tier.slice(1)}` : ""}
        </p>

        {/* Today's Sales Card */}
        <div className="mt-5 bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-medium text-neutral-500 mb-1">Today's Sales</p>
          {todaySales !== null ? (
            <p className="text-3xl font-bold text-neutral-900">{fmt(todaySales)}</p>
          ) : (
            <div className="h-9 w-28 bg-neutral-100 rounded animate-pulse" />
          )}
        </div>
      </div>

      {/* Quick POS Button */}
      <div className="px-5 -mt-4">
        <Link href="/pos">
          <div className="bg-amber-950 text-white rounded-2xl p-4 flex items-center justify-between shadow-lg active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-white/15 flex items-center justify-center">
                <ShoppingCart className="h-6 w-6" />
              </div>
              <div>
                <p className="font-bold text-base">Open POS</p>
                <p className="text-sm text-white/70">Start selling now</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-white/50" />
          </div>
        </Link>
      </div>

      {/* Quick Actions Grid */}
      <div className="px-5 mt-6">
        <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-3">Quick Actions</p>
        <div className="grid grid-cols-2 gap-3">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon
            return (
              <Link key={action.href} href={action.href}>
                <div className="bg-white rounded-2xl p-4 shadow-sm active:scale-[0.97] transition-transform">
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center mb-3"
                    style={{ backgroundColor: action.color + "15" }}
                  >
                    <Icon className="h-5 w-5" style={{ color: action.color }} />
                  </div>
                  <p className="font-semibold text-sm text-neutral-900">{action.label}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">{action.desc}</p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Subscription Warning */}
      {!isActive && (
        <div className="px-5 mt-6">
          <Link href="/subscription">
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm text-red-700">Subscription expired</p>
                <p className="text-xs text-red-600/70 mt-0.5">Tap to renew</p>
              </div>
              <ChevronRight className="h-5 w-5 text-red-400" />
            </div>
          </Link>
        </div>
      )}

      {/* Logout Sheet */}
      {showLogout && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !loggingOut && setShowLogout(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl pb-8">
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-neutral-200" />
            </div>
            <div className="px-6 pb-6">
              <div className="flex items-center gap-4 mb-5">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xl">{user?.role === "owner" ? "👑" : "👤"}</span>
                </div>
                <div>
                  <p className="font-semibold text-neutral-900">{user?.name || ownerName}</p>
                  <p className="text-sm text-neutral-500 capitalize">{user?.role}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full h-12 bg-red-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" />
                {loggingOut ? "Signing out..." : "Sign Out"}
              </button>
              <button
                onClick={() => setShowLogout(false)}
                disabled={loggingOut}
                className="w-full h-12 mt-2 border border-neutral-200 rounded-xl font-medium text-neutral-600 active:scale-[0.98] transition-transform"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
