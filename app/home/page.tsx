"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Store, Package, TrendingUp, Smartphone, HandCoins,
  Brain, BarChart2, Users, Settings, Receipt, FileText,
  ListChecks, Truck, Star, Bell, ChevronRight, Zap,
  ArrowUpRight, ShoppingCart,
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useSubscription } from "@/hooks/use-subscription"
import { getSession } from "@/lib/pos-session"
import { getStoreId } from "@/lib/store-id"

interface QuickStat {
  label: string
  value: string
  sub: string
  color: string
  bg: string
}

interface NavTile {
  href: string
  label: string
  icon: React.ElementType
  color: string
  bg: string
  desc: string
}

const PRIMARY_TILES: NavTile[] = [
  { href: "/pos",       label: "POS",        icon: Store,       color: "text-yellow-700",  bg: "bg-yellow-100",  desc: "Scan & sell" },
  { href: "/inventory", label: "Inventory",  icon: Package,     color: "text-yellow-700",  bg: "bg-yellow-100",  desc: "Stock & products" },
  { href: "/reports",   label: "Reports",    icon: TrendingUp,  color: "text-yellow-700",  bg: "bg-yellow-100",  desc: "Sales & profit" },
  { href: "/ewallet",   label: "E-Wallet",   icon: Smartphone,  color: "text-yellow-700",  bg: "bg-yellow-100",  desc: "GCash & Maya" },
]

const MORE_TILES: NavTile[] = [
  { href: "/utang",           label: "Utang",       icon: HandCoins,  color: "text-yellow-700", bg: "bg-yellow-100", desc: "Credit tracking" },
  { href: "/loyalty",         label: "Loyalty",     icon: Star,       color: "text-yellow-700", bg: "bg-yellow-100", desc: "Reward customers" },
  { href: "/restock",         label: "AI Restock",  icon: Brain,      color: "text-yellow-700", bg: "bg-yellow-100", desc: "Smart ordering" },
  { href: "/elista",          label: "e-Lista",     icon: FileText,   color: "text-yellow-700", bg: "bg-yellow-100", desc: "Customer list" },
  { href: "/checklist",       label: "Checklist",   icon: ListChecks, color: "text-yellow-700", bg: "bg-yellow-100", desc: "Daily tasks" },
  { href: "/delivery-manage", label: "Delivery",    icon: Truck,      color: "text-yellow-700", bg: "bg-yellow-100", desc: "Online orders" },
  { href: "/bills",           label: "Pay Bills",   icon: Receipt,    color: "text-yellow-700", bg: "bg-yellow-100", desc: "Bill payments" },
  { href: "/market-intelligence", label: "Market Intel", icon: BarChart2, color: "text-yellow-700", bg: "bg-yellow-100", desc: "Trends & insights" },
  { href: "/users",           label: "Users",       icon: Users,      color: "text-yellow-700", bg: "bg-yellow-100", desc: "Staff & roles" },
  { href: "/settings",        label: "Settings",    icon: Settings,   color: "text-yellow-700", bg: "bg-yellow-100", desc: "Store config" },
]

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 18) return "Good afternoon"
  return "Good evening"
}

export default function HomePage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const { tier, isActive, features } = useSubscription()
  const [session, setSession] = useState<ReturnType<typeof getSession>>(null)
  const [todaySales, setTodaySales] = useState<{ gross: number; txCount: number } | null>(null)

  useEffect(() => {
    if (!loading && !user) router.push("/login")
  }, [user, loading, router])

  useEffect(() => {
    setSession(getSession())
  }, [])

  useEffect(() => {
    const storeId = getStoreId()
    if (!storeId) return
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    fetch(`/api/sales?storeId=${storeId}&from=${today.toISOString()}`)
      .then(r => r.json())
      .then(({ data }) => {
        if (!data) return
        const gross = data.filter((s: any) => s.status !== "voided").reduce((sum: number, s: any) => sum + s.total, 0)
        setTodaySales({ gross, txCount: data.filter((s: any) => s.status !== "voided").length })
      })
      .catch(() => {})
  }, [])

  if (loading || !user) return null

  const storeName = session?.storeName || "My Store"
  const ownerName = session?.ownerName || user?.name || "there"
  const isOwner = user?.role === "owner"
  const tierLabel = tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : "Basic"

  const stats: QuickStat[] = [
    {
      label: "Today's Sales",
      value: todaySales ? `₱${todaySales.gross.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—",
      sub: todaySales ? `${todaySales.txCount} transaction${todaySales.txCount !== 1 ? "s" : ""}` : "Loading...",
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Plan",
      value: tierLabel,
      sub: isActive ? "Active" : "Expired",
      color: "text-white",
      bg: "bg-white/10",
    },
  ]

  const visibleMore = MORE_TILES.filter(t => {
    if (!isOwner) return false
    if (t.href === "/loyalty" && !features.loyalty) return false
    if (t.href === "/restock" && !features.aiRestock) return false
    if (t.href === "/market-intelligence" && !features.marketIntelligence) return false
    if (t.href === "/delivery-manage" && !features.delivery) return false
    if (t.href === "/utang" && !features.utang) return false
    if (t.href === "/users" && !features.multiUser) return false
    return true
  })

  return (
    <div className="min-h-screen bg-[oklch(0.97_0.008_90)] pb-28">

      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden">
        {/* Golden yellow gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary/80" />
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "24px 24px" }}
        />

        <div className="relative px-5 pt-14 pb-8">
          {/* Top row */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                <img src="/logo.svg" alt="Payroo" className="h-7 w-7 rounded-xl" />
              </div>
              <div>
                <p className="text-white/70 text-[11px] font-medium tracking-wide uppercase">{getGreeting()}</p>
                <p className="text-white font-bold text-[15px] leading-tight">{ownerName.split(" ")[0]} 👋</p>
              </div>
            </div>
            <Link href="/settings">
              <div className="h-10 w-10 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20 active:scale-90 transition-transform">
                <Bell className="h-4.5 w-4.5 text-white" />
              </div>
            </Link>
          </div>

          {/* Store name */}
          <div className="mb-5">
            <h1 className="text-white text-2xl font-black tracking-tight leading-tight">{storeName}</h1>
            <p className="text-white/60 text-[12px] mt-0.5">
              {session?.externalId ? `ID: ${session.externalId}` : "Payroo POS"}
              {session?.branchName ? ` · ${session.branchName}` : ""}
            </p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3">
            {stats.map((s, i) => (
              <div key={i} className="bg-white/15 backdrop-blur-sm rounded-2xl p-3.5 border border-white/20">
                <p className="text-white/60 text-[10px] font-semibold uppercase tracking-widest mb-1">{s.label}</p>
                <p className="text-white text-[20px] font-black leading-none">{s.value}</p>
                <p className="text-white/60 text-[11px] mt-1">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom curve */}
        <div className="h-6 bg-[oklch(0.97_0.008_90)] rounded-t-[28px] -mt-1" />
      </div>

      <div className="px-4 -mt-2 space-y-6">

        {/* ── Quick Action — Go to POS ── */}
        <Link href="/pos">
          <div className="flex items-center justify-between bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-[0_2px_16px_rgba(0,0,0,0.06)] border border-white/60 active:scale-[0.98] transition-all">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-primary flex items-center justify-center shadow-md">
                <ShoppingCart className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <p className="font-bold text-[14px] text-foreground">Open POS</p>
                <p className="text-[11px] text-muted-foreground">Start selling now</p>
              </div>
            </div>
            <div className="flex items-center gap-1 bg-primary/10 px-3 py-1.5 rounded-full">
              <Zap className="h-3 w-3 text-primary" />
              <span className="text-[11px] font-bold text-primary">Quick Start</span>
            </div>
          </div>
        </Link>

        {/* ── Primary Features ── */}
        <div>
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3 px-1">Main Features</p>
          <div className="grid grid-cols-2 gap-3">
            {PRIMARY_TILES.map((tile) => {
              const Icon = tile.icon
              return (
                <Link key={tile.href} href={tile.href}>
                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-[0_2px_16px_rgba(0,0,0,0.06)] border border-white/60 active:scale-[0.97] transition-all duration-150">
                    <div className={`h-10 w-10 rounded-xl ${tile.bg} flex items-center justify-center mb-3`}>
                      <Icon className={`h-5 w-5 ${tile.color}`} />
                    </div>
                    <p className="font-bold text-[14px] text-foreground leading-tight">{tile.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{tile.desc}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* ── More Features ── */}
        {visibleMore.length > 0 && (
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3 px-1">More Tools</p>
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.06)] border border-white/60 overflow-hidden divide-y divide-border/30">
              {visibleMore.map((tile) => {
                const Icon = tile.icon
                return (
                  <Link key={tile.href} href={tile.href}>
                    <div className="flex items-center gap-3 px-4 py-3.5 active:bg-muted/40 transition-colors">
                      <div className={`h-9 w-9 rounded-xl ${tile.bg} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`h-4.5 w-4.5 ${tile.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[13px] text-foreground">{tile.label}</p>
                        <p className="text-[11px] text-muted-foreground">{tile.desc}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Subscription banner if expired ── */}
        {!isActive && (
          <Link href="/subscription">
            <div className="bg-gradient-to-r from-red-500 to-rose-600 rounded-2xl p-4 flex items-center justify-between shadow-lg active:scale-[0.98] transition-all">
              <div>
                <p className="text-white font-bold text-[14px]">Subscription Expired</p>
                <p className="text-white/80 text-[11px] mt-0.5">Renew to unlock all features</p>
              </div>
              <div className="flex items-center gap-1 bg-white/20 px-3 py-1.5 rounded-full">
                <ArrowUpRight className="h-3.5 w-3.5 text-white" />
                <span className="text-[11px] font-bold text-white">Renew</span>
              </div>
            </div>
          </Link>
        )}

        {/* ── Footer ── */}
        <p className="text-center text-[10px] text-muted-foreground/50 pb-2">
          Payroo POS · {tierLabel} Plan · v2.0
        </p>
      </div>
    </div>
  )
}
