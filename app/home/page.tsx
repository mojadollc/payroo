"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Store, Package, TrendingUp, Smartphone, HandCoins,
  Brain, BarChart2, Users, Settings, Receipt, FileText,
  ListChecks, Truck, Star, Bell, ChevronRight, Zap,
  ArrowUpRight, ShoppingCart, LogOut, X,
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useSubscription } from "@/hooks/use-subscription"
import { getSession, clearSession } from "@/lib/pos-session"
import { getStoreId } from "@/lib/store-id"

interface TodayData {
  gross: number
  txCount: number
  pctChange: number | null
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
  { href: "/pos",       label: "POS",       icon: Store,      color: "text-yellow-700", bg: "bg-yellow-100", desc: "Scan & sell" },
  { href: "/inventory", label: "Inventory", icon: Package,    color: "text-yellow-700", bg: "bg-yellow-100", desc: "Stock & products" },
  { href: "/reports",   label: "Reports",   icon: TrendingUp, color: "text-yellow-700", bg: "bg-yellow-100", desc: "Sales & profit" },
  { href: "/ewallet",   label: "E-Wallet",  icon: Smartphone, color: "text-yellow-700", bg: "bg-yellow-100", desc: "GCash & Maya" },
]

const MORE_TILES: NavTile[] = [
  { href: "/utang",               label: "Utang",        icon: HandCoins,  color: "text-yellow-700", bg: "bg-yellow-100", desc: "Credit tracking" },
  { href: "/loyalty",             label: "Loyalty",      icon: Star,       color: "text-yellow-700", bg: "bg-yellow-100", desc: "Reward customers" },
  { href: "/restock",             label: "AI Restock",   icon: Brain,      color: "text-yellow-700", bg: "bg-yellow-100", desc: "Smart ordering" },
  { href: "/elista",              label: "e-Lista",      icon: FileText,   color: "text-yellow-700", bg: "bg-yellow-100", desc: "Customer list" },
  { href: "/checklist",           label: "Checklist",    icon: ListChecks, color: "text-yellow-700", bg: "bg-yellow-100", desc: "Daily tasks" },
  { href: "/delivery-manage",     label: "Delivery",     icon: Truck,      color: "text-yellow-700", bg: "bg-yellow-100", desc: "Online orders" },
  { href: "/bills",               label: "Pay Bills",    icon: Receipt,    color: "text-yellow-700", bg: "bg-yellow-100", desc: "Bill payments" },
  { href: "/market-intelligence", label: "Market Intel", icon: BarChart2,  color: "text-yellow-700", bg: "bg-yellow-100", desc: "Trends & insights" },
  { href: "/users",               label: "Users",        icon: Users,      color: "text-yellow-700", bg: "bg-yellow-100", desc: "Staff & roles" },
  { href: "/settings",            label: "Settings",     icon: Settings,   color: "text-yellow-700", bg: "bg-yellow-100", desc: "Store config" },
]

function getPHTime() {
  return new Date().toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", hour12: true })
}

function getGreeting() {
  const h = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" })).getHours()
  if (h < 12) return "Good morning"
  if (h < 18) return "Good afternoon"
  return "Good evening"
}

function wmoToWeather(code: number): { emoji: string; label: string } {
  if (code === 0) return { emoji: "☀️", label: "Sunny" }
  if (code <= 2) return { emoji: "⛅", label: "Partly cloudy" }
  if (code === 3) return { emoji: "☁️", label: "Overcast" }
  if (code <= 49) return { emoji: "🌫️", label: "Foggy" }
  if (code <= 59) return { emoji: "🌦️", label: "Drizzle" }
  if (code <= 69) return { emoji: "🌧️", label: "Rain" }
  if (code <= 79) return { emoji: "❄️", label: "Snow" }
  if (code <= 84) return { emoji: "🌧️", label: "Showers" }
  if (code <= 99) return { emoji: "⛈️", label: "Thunderstorm" }
  return { emoji: "🌡️", label: "" }
}

const THEMES = [
  { id: "amber",   from: "#f59e0b", via: "#fbbf24", to: "#f97316", orb1: "#fde68a", orb2: "#fed7aa", dark: "#78350f", mid: "#92400e" },
  { id: "violet",  from: "#7c3aed", via: "#8b5cf6", to: "#6366f1", orb1: "#ddd6fe", orb2: "#c7d2fe", dark: "#1e1b4b", mid: "#2e1065" },
  { id: "rose",    from: "#e11d48", via: "#f43f5e", to: "#ec4899", orb1: "#fecdd3", orb2: "#fbcfe8", dark: "#4c0519", mid: "#500724" },
  { id: "emerald", from: "#059669", via: "#10b981", to: "#0d9488", orb1: "#a7f3d0", orb2: "#99f6e4", dark: "#022c22", mid: "#064e3b" },
  { id: "sky",     from: "#0284c7", via: "#0ea5e9", to: "#6366f1", orb1: "#bae6fd", orb2: "#c7d2fe", dark: "#0c1a2e", mid: "#0c4a6e" },
  { id: "fuchsia", from: "#a21caf", via: "#c026d3", to: "#7c3aed", orb1: "#f5d0fe", orb2: "#ddd6fe", dark: "#2e1065", mid: "#4a044e" },
  { id: "orange",  from: "#ea580c", via: "#f97316", to: "#eab308", orb1: "#fed7aa", orb2: "#fef08a", dark: "#431407", mid: "#7c2d12" },
  { id: "teal",    from: "#0f766e", via: "#14b8a6", to: "#0284c7", orb1: "#99f6e4", orb2: "#bae6fd", dark: "#042f2e", mid: "#134e4a" },
]

// Shimmer block
function Shimmer({ className }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-black/10 rounded-xl ${className ?? ""}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/30 to-transparent" />
    </div>
  )
}

export default function HomePage() {
  const router = useRouter()
  const { user, loading, logout } = useAuth()
  const { tier, isActive, features } = useSubscription()
  const [session] = useState<ReturnType<typeof getSession>>(() =>
    typeof window !== "undefined" ? getSession() : null
  )
  const [today, setToday] = useState<TodayData | null>(null)
  const [showLogout, setShowLogout] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [phTime, setPhTime] = useState(getPHTime)
  const [weather, setWeather] = useState<{ emoji: string; label: string; temp: number } | null>(null)
  const [themeIdx, setThemeIdx] = useState(() => Math.floor(Math.random() * THEMES.length))
  const theme = THEMES[themeIdx]

  useEffect(() => {
    const t = setInterval(() => setPhTime(getPHTime()), 60000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current_weather=true`)
        .then(r => r.json())
        .then(d => {
          const w = wmoToWeather(d.current_weather.weathercode)
          setWeather({ ...w, temp: Math.round(d.current_weather.temperature) })
        })
        .catch(() => {})
    }, () => {
      // fallback: Manila coords
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=14.5995&longitude=120.9842&current_weather=true`)
        .then(r => r.json())
        .then(d => {
          const w = wmoToWeather(d.current_weather.weathercode)
          setWeather({ ...w, temp: Math.round(d.current_weather.temperature) })
        })
        .catch(() => {})
    })
  }, [])

  useEffect(() => {
    const t = setInterval(() => setThemeIdx(i => {
      let next = i
      while (next === i) next = Math.floor(Math.random() * THEMES.length)
      return next
    }), 8000)
    return () => clearInterval(t)
  }, [])

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
    const yesterdayStart = new Date(todayStart)
    yesterdayStart.setDate(yesterdayStart.getDate() - 1)
    const yesterdayEnd = new Date(todayStart)
    yesterdayEnd.setMilliseconds(yesterdayEnd.getMilliseconds() - 1)

    Promise.all([
      fetch(`/api/sales?storeId=${storeId}&from=${todayStart.toISOString()}&to=${todayEnd.toISOString()}&summary=1`).then(r => r.json()),
      fetch(`/api/sales?storeId=${storeId}&from=${yesterdayStart.toISOString()}&to=${yesterdayEnd.toISOString()}&summary=1`).then(r => r.json()),
    ]).then(([todayRes, yestRes]) => {
      const todayActive = (todayRes.data ?? []).filter((s: any) => s.status !== "voided")
      const yestActive = (yestRes.data ?? []).filter((s: any) => s.status !== "voided")
      const gross = todayActive.reduce((sum: number, s: any) => sum + s.total, 0)
      const yestGross = yestActive.reduce((sum: number, s: any) => sum + s.total, 0)
      const pctChange = yestGross > 0 ? Math.round(((gross - yestGross) / yestGross) * 100) : null
      setToday({ gross, txCount: todayActive.length, pctChange })
    }).catch(() => {})
  }, [])

  const handleLogout = async () => {
    setLoggingOut(true)
    await new Promise(r => setTimeout(r, 500))
    clearSession()
    logout()
    router.push("/login")
  }

  if (!user) return null

  const storeName = session?.storeName || "My Store"
  const ownerName = session?.ownerName || user?.name || "there"
  const isOwner = user?.role === "owner"
  const tierLabel = tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : "Basic"
  const fmt = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  const dataLoaded = today !== null

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
    <>
      {/* ── Shimmer keyframe ── */}
      <style>{`
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes orbFloat {
          0%, 100% { transform: translateY(0px) scale(1); }
          33%       { transform: translateY(-18px) scale(1.08); }
          66%       { transform: translateY(10px) scale(0.95); }
        }
      `}</style>

      <div className="min-h-screen bg-[oklch(0.97_0.008_90)] pb-28">

        {/* ── Hero Header ── */}
        <div className="relative overflow-hidden">
          {/* Animated gradient */}
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${theme.from}, ${theme.via}, ${theme.to})`,
              transition: "background 1.2s ease",
            }}
          />
          {/* Floating orbs */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div
              className="absolute -top-10 -right-10 w-52 h-52 rounded-full opacity-30 blur-2xl animate-[orbFloat_6s_ease-in-out_infinite]"
              style={{ background: theme.orb1, transition: "background 1.2s ease" }}
            />
            <div
              className="absolute -bottom-8 -left-8 w-44 h-44 rounded-full opacity-25 blur-2xl animate-[orbFloat_8s_ease-in-out_infinite_2s]"
              style={{ background: theme.orb2, transition: "background 1.2s ease" }}
            />
            <div
              className="absolute top-1/2 left-1/3 w-36 h-36 rounded-full opacity-20 blur-3xl animate-[orbFloat_10s_ease-in-out_infinite_1s]"
              style={{ background: theme.orb1, transition: "background 1.2s ease" }}
            />
          </div>
          {/* Dot grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{ backgroundImage: "radial-gradient(circle at 2px 2px, #fff 1px, transparent 0)", backgroundSize: "24px 24px" }}
          />

          <div className="relative px-5 pt-14 pb-8">
            {/* Top row */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                {/* Logo — tap to open logout */}
                <button
                  onClick={() => setShowLogout(true)}
                  className="h-11 w-11 rounded-2xl bg-black/10 backdrop-blur-sm flex items-center justify-center border border-black/10 active:scale-90 transition-transform"
                >
                  <img src="/logo.svg" alt="Payroo" className="h-7 w-7 rounded-xl" />
                </button>
                <div>
                  <p className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: theme.dark + "cc" }}>{getGreeting()}</p>
                  <p className="font-bold text-[15px] leading-tight" style={{ color: theme.dark }}>{ownerName.split(" ")[0]} 👋</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Weather + Time pill */}
                <div className="flex flex-col items-end gap-0.5">
                  <div className="flex items-center gap-1 bg-black/10 backdrop-blur-sm rounded-full px-2.5 py-1 border border-black/10">
                    <span className="text-[11px]">🕐</span>
                    <span className="text-[11px] font-bold" style={{ color: theme.dark }}>{phTime}</span>
                  </div>
                  {weather && (
                    <div className="flex items-center gap-1 bg-black/10 backdrop-blur-sm rounded-full px-2.5 py-1 border border-black/10">
                      <span className="text-[11px]">{weather.emoji}</span>
                      <span className="text-[11px] font-bold" style={{ color: theme.dark }}>{weather.temp}°C</span>
                    </div>
                  )}
                </div>
                <Link href="/settings">
                  <div className="h-10 w-10 rounded-2xl bg-black/10 backdrop-blur-sm flex items-center justify-center border border-black/10 active:scale-90 transition-transform">
                    <Bell className="h-4.5 w-4.5" style={{ color: theme.dark }} />
                  </div>
                </Link>
              </div>
            </div>

            {/* Store name */}
            <div className="mb-5">
              <h1 className="text-2xl font-black tracking-tight leading-tight" style={{ color: theme.dark }}>{storeName}</h1>
              <p className="text-[12px] mt-0.5" style={{ color: theme.mid + "99" }}>
                {session?.externalId ? `ID: ${session.externalId}` : "Payroo POS"}
                {session?.branchName ? ` · ${session.branchName}` : ""}
                {" · "}
                <span className={isActive ? "font-semibold" : "font-semibold text-red-300"} style={isActive ? { color: theme.dark } : {}}>
                  {tierLabel} {isActive ? "✓" : "⚠"}
                </span>
              </p>
            </div>

            {/* Today's Sales — single clean number */}
            <div className="bg-black/10 backdrop-blur-sm rounded-2xl p-4 border border-black/10">
              <p className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: theme.dark + "cc" }}>Benta ngayong araw</p>
              {dataLoaded ? (
                <>
                  <p className="text-[36px] font-black leading-none" style={{ color: theme.dark }}>{fmt(today!.gross)}</p>
                  <p className="text-[12px] mt-1.5" style={{ color: theme.mid + "99" }}>
                    {today!.pctChange !== null && (
                      <span className="font-bold mr-1" style={{ color: theme.dark }}>
                        {today!.pctChange >= 0 ? "+" : ""}{today!.pctChange}% vs. kahapon ·
                      </span>
                    )}
                    {today!.txCount} transactions
                  </p>
                </>
              ) : (
                <>
                  <Shimmer className="h-9 w-36 mb-2" />
                  <Shimmer className="h-3 w-40" />
                </>
              )}
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

          {/* ── Primary Features — always visible ── */}
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

          {/* ── More Features — always visible ── */}
          {isOwner && visibleMore.length > 0 && (
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

      {/* ── Logout bottom sheet ── */}
      {showLogout && (
        <div className="fixed inset-0 z-[70] md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => !loggingOut && setShowLogout(false)}
          />
          {/* Sheet */}
          <div className="absolute bottom-0 left-0 right-0 bg-background rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom duration-300 pb-10">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1.5 rounded-full bg-muted-foreground/25" />
            </div>

            {/* Close button */}
            <div className="flex justify-end px-5 pt-1 pb-2">
              <button
                onClick={() => setShowLogout(false)}
                disabled={loggingOut}
                className="h-8 w-8 rounded-full bg-muted/60 flex items-center justify-center active:scale-90 transition-transform"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* User info */}
            <div className="px-6 pb-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="h-14 w-14 rounded-2xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">
                    {user?.role === "owner" ? "👑" : user?.role === "subadmin" ? "🛡️" : "👤"}
                  </span>
                </div>
                <div>
                  <p className="font-bold text-[16px] text-foreground leading-tight">{user?.name || ownerName}</p>
                  <p className="text-[12px] text-muted-foreground capitalize mt-0.5">{user?.role} · {storeName}</p>
                  {session?.externalId && (
                    <p className="text-[11px] text-muted-foreground/60 font-mono">Store #{session.externalId}</p>
                  )}
                </div>
              </div>

              {/* Friendly message */}
              <div className="bg-amber-50 border border-amber-200/60 rounded-2xl p-4 mb-5">
                <p className="text-[13px] font-semibold text-amber-900">End your shift?</p>
                <p className="text-[12px] text-amber-800/70 mt-0.5">
                  You'll be signed out and need your Store ID + PIN to sign back in.
                </p>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLogout(false)}
                  disabled={loggingOut}
                  className="flex-1 h-12 rounded-xl border border-border text-[14px] font-semibold text-foreground bg-background active:scale-[0.97] transition-all disabled:opacity-50"
                >
                  Stay signed in
                </button>
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="flex-1 h-12 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[14px] font-bold flex items-center justify-center gap-2 active:scale-[0.97] transition-all disabled:opacity-70 shadow-md"
                >
                  {loggingOut ? (
                    <span className="animate-pulse">Signing out…</span>
                  ) : (
                    <>
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
