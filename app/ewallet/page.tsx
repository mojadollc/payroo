"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Settings,
  TrendingUp,
  History,
  ArrowDownToLine,
  ArrowUpFromLine,
  Signal,
  Calendar,
  Zap,
  Wallet,
  ChevronRight,
  Smartphone,
  Send,
  RefreshCw,
  AlertCircle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TransactionForm } from "@/components/ewallet/transaction-form"
import { TransactionHistory } from "@/components/ewallet/transaction-history"
import { CommissionSettingsDialog } from "@/components/ewallet/commission-settings-dialog"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { MobileAppShell, MobileCard, MobileSectionHeader } from "@/components/mobile-app-shell"
import { getStoreId } from "@/lib/store-id"
import type { EWalletTransaction, CommissionSettings } from "@/lib/types"

const ELOAD_STORE_ID = "8807" // kept for reference, no longer used as gate

type Period = "today" | "week" | "month" | "all"
type ActiveSheet = "none" | "cashin" | "cashout" | "hitpay"

const HITPAY_CHANNELS = [
  { value: "gcash",     label: "GCash",      emoji: "📱" },
  { value: "paymaya",   label: "Maya",       emoji: "💳" },
  { value: "shopeepay", label: "ShopeePay",  emoji: "🛍️" },
  { value: "grabpay",   label: "GrabPay",    emoji: "🚗" },
  { value: "bpi",       label: "BPI",        emoji: "🏦" },
  { value: "unionbank", label: "UnionBank",  emoji: "🏦" },
  { value: "bdo",       label: "BDO",        emoji: "🏦" },
  { value: "metrobank", label: "Metrobank",  emoji: "🏦" },
  { value: "chinabank", label: "China Bank", emoji: "🏦" },
  { value: "rcbc",      label: "RCBC",       emoji: "🏦" },
  { value: "landbank",  label: "Landbank",   emoji: "🏦" },
  { value: "pnb",       label: "PNB",        emoji: "🏦" },
  { value: "instapay",  label: "InstaPay",   emoji: "⚡" },
  { value: "pesonet",   label: "PESONet",    emoji: "⚡" },
]

function getPeriodRange(period: Period): { start?: Date; end?: Date; max?: number } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  if (period === "today") return { start, end }
  if (period === "week") { start.setDate(start.getDate() - 6); return { start, end } }
  if (period === "month") { start.setDate(1); return { start, end } }
  return { max: 50 }
}

export default function EWalletPage() {
  const router = useRouter()
  const [transactions, setTransactions] = useState<EWalletTransaction[]>([])
  const [cashinTransactions, setCashinTransactions] = useState<any[]>([])
  const [commissionSettings, setCommissionSettings] = useState<CommissionSettings | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const hasLoaded = useRef(false)
  const settingsLoadedRef = useRef(false)
  const [period, setPeriod] = useState<Period>("month")
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>("none")
  const [gbitsBalance, setGbitsBalance] = useState<number | null>(null)
  const [gbitsBalanceError, setGbitsBalanceError] = useState(false)
  const [gbitsBalanceLoading, setGbitsBalanceLoading] = useState(false)
  const [hitpayBalance, setHitpayBalance] = useState<number | null>(null)
  const [hitpayBalanceLoading, setHitpayBalanceLoading] = useState(false)
  const [hitpayBalanceError, setHitpayBalanceError] = useState(false)
  // Payout form state
  const [payoutChannel, setPayoutChannel] = useState("gcash")
  const [payoutAccount, setPayoutAccount] = useState("")
  const [payoutName, setPayoutName] = useState("")
  const [payoutAmount, setPayoutAmount] = useState("")
  const [payoutPurpose, setPayoutPurpose] = useState("")
  const [payoutLoading, setPayoutLoading] = useState(false)
  const [payoutResult, setPayoutResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const allLimitRef = useRef(50)

  // Evaluated once on render — storeId is set at login and doesn't change mid-session
  const canUseELoad = true

  const loadData = useCallback(async (opts?: { append?: boolean; nextLimit?: number }) => {
    const isAppend = opts?.append === true
    if (!hasLoaded.current && !isAppend) setIsLoading(true)
    if (isAppend) setIsLoadingMore(true)
    try {
      const storeId = getStoreId()
      if (!storeId) return
      const range = getPeriodRange(period)
      const params = new URLSearchParams({ storeId })
      if (range.start) params.set("from", range.start.toISOString())
      if (range.end) params.set("to", range.end.toISOString())

      const [txRes, csRes] = await Promise.all([
        fetch(`/api/ewallet-transactions?${params}`),
        settingsLoadedRef.current ? Promise.resolve(null) : fetch(`/api/commission-settings?storeId=${storeId}`),
      ])
      const { data: transactionsData } = await txRes.json()
      if (csRes) {
        const { data: settingsData } = await csRes.json()
        if (settingsData) { setCommissionSettings(settingsData); settingsLoadedRef.current = true }
      }
      setTransactions(transactionsData ?? [])
      setCashinTransactions([])
      setHasMore(false)
    } catch (error) {
      console.error("[ewallet] Error loading data:", error)
    } finally {
      hasLoaded.current = true
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [period])

  useEffect(() => {
    hasLoaded.current = false
    allLimitRef.current = 50
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period])

  const fetchHitpayBalance = () => {
    setHitpayBalanceLoading(true)
    setHitpayBalanceError(false)
    fetch("/api/hitpay/balance")
      .then(r => r.json())
      .then(d => {
        if (d.balance != null) {
          setHitpayBalance(d.balance)
          localStorage.setItem("hitpay_balance", String(d.balance))
        } else {
          setHitpayBalanceError(true)
        }
      })
      .catch(() => setHitpayBalanceError(true))
      .finally(() => setHitpayBalanceLoading(false))
  }

  useEffect(() => {
    const cached = localStorage.getItem("hitpay_balance")
    if (cached != null) setHitpayBalance(parseFloat(cached))
    fetchHitpayBalance()
  }, [])

  const handlePayout = async () => {
    if (!payoutChannel || !payoutAccount || !payoutAmount) return
    setPayoutLoading(true)
    setPayoutResult(null)
    try {
      const res = await fetch("/api/hitpay/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: payoutChannel,
          accountNumber: payoutAccount,
          accountName: payoutName,
          amount: parseFloat(payoutAmount),
          purpose: payoutPurpose || "Cash-in payout",
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setPayoutResult({ ok: true, msg: "Payout sent successfully!" })
        setPayoutAccount("")
        setPayoutName("")
        setPayoutAmount("")
        setPayoutPurpose("")
        fetchHitpayBalance()
      } else {
        setPayoutResult({ ok: false, msg: data.error ?? "Payout failed" })
      }
    } catch {
      setPayoutResult({ ok: false, msg: "Network error. Please try again." })
    } finally {
      setPayoutLoading(false)
    }
  }

  useEffect(() => {
    // Read cached balance from localStorage immediately (no flicker)
    const saved = localStorage.getItem("gbits_balance")
    if (saved != null) setGbitsBalance(parseFloat(saved))

    // Fetch from DB — synced across all devices
    const storeId = getStoreId()
    if (storeId) {
      setGbitsBalanceLoading(true)
      fetch(`/api/eload?storeId=${storeId}&action=balance`)
        .then(r => r.json())
        .then(data => {
          if (data.balance != null) {
            setGbitsBalance(data.balance)
            setGbitsBalanceError(false)
            localStorage.setItem("gbits_balance", String(data.balance))
          }
        })
        .catch(() => {})
        .finally(() => setGbitsBalanceLoading(false))
    }

    // Listen for updates dispatched by the E-Load page after each successful buy
    const onStorage = (e: StorageEvent) => {
      if (e.key === "gbits_balance" && e.newValue != null) {
        setGbitsBalance(parseFloat(e.newValue))
        setGbitsBalanceError(false)
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const handleLoadMore = () => {
    const next = allLimitRef.current + 50
    loadData({ append: true, nextLimit: next })
  }

  const calculateStats = () => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    const todayTransactions = transactions.filter(t => {
      const d = new Date(t.createdAt as any)
      return d >= todayStart && d <= todayEnd
    })
    const totalProfit = transactions.reduce((sum, t) => sum + Math.abs(t.profit || 0), 0)
    const todayProfit = todayTransactions.reduce((sum, t) => sum + Math.abs(t.profit || 0), 0)
    const grossCashin = transactions.filter(t => t.type === "cashin").reduce((sum, t) => sum + t.amount, 0)
    const grossCashout = transactions.filter(t => t.type === "cashout").reduce((sum, t) => sum + t.amount, 0)
    const grossLoad = transactions.filter(t => t.type === "load").reduce((sum, t) => sum + t.amount, 0)
    return { totalProfit, todayProfit, totalTransactions: transactions.length, todayTransactionsCount: todayTransactions.length, grossCashin, grossCashout, grossLoad }
  }

  const stats = calculateStats()
  const periodLabel = period === "today" ? "Today" : period === "week" ? "This Week" : period === "month" ? "This Month" : "All Time"
  const historyTitle = period === "today" ? "Today's Transactions" : `Transactions · ${periodLabel}`

  const onTxSuccess = () => {
    hasLoaded.current = false
    loadData()
    setActiveSheet("none")
  }

  const PeriodSelect = (
    <Select value={period} onValueChange={v => setPeriod(v as Period)}>
      <SelectTrigger className="w-full md:w-[200px] h-11 md:h-9 rounded-xl border border-border/60 bg-white/80 md:rounded-md md:border">
        <Calendar className="h-4 w-4 mr-2 shrink-0" />
        <SelectValue placeholder="Period" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="today">Today</SelectItem>
        <SelectItem value="week">This Week</SelectItem>
        <SelectItem value="month">This Month</SelectItem>
        <SelectItem value="all">All Time (paginated)</SelectItem>
      </SelectContent>
    </Select>
  )

  // ── Quick Action Bar ────────────────────────────────────────────────────────
  const QuickActions = (
    <div className={`grid gap-3 ${canUseELoad ? "grid-cols-4" : "grid-cols-3"}`}>

      {/* E-Load — only visible to store 8807 */}
      {canUseELoad && (
        <button
          onClick={() => router.push("/ewallet/load")}
          className="relative flex flex-col items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-purple-600 to-violet-700 text-white py-4 px-2 shadow-lg shadow-purple-500/30 active:scale-[0.97] transition-all hover:from-purple-700 hover:to-violet-800"
        >
          <div className="p-2.5 bg-white/20 rounded-xl">
            <Zap className="h-6 w-6" />
          </div>
          <span className="text-[13px] font-bold">E-Load</span>
          {gbitsBalance != null ? (
            <span className="text-[10px] font-bold opacity-90">₱{gbitsBalance.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          ) : (
            <span className="text-[10px] opacity-75">GBits · All Networks</span>
          )}
          <div className="absolute top-2.5 right-2.5 bg-white/25 rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-wide">
            LIVE
          </div>
        </button>
      )}

      {/* Cash-In Cash-out Record */}
      <button
        onClick={() => setActiveSheet("cashin")}
        className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 text-white py-4 px-2 shadow-lg shadow-blue-500/25 active:scale-[0.97] transition-all hover:from-blue-600 hover:to-cyan-700"
      >
        <div className="p-2.5 bg-white/20 rounded-xl">
          <ArrowDownToLine className="h-6 w-6" />
        </div>
        <span className="text-[13px] font-bold">Cash-in/out</span>
        <span className="text-[10px] opacity-75">Record</span>
      </button>

      {/* Kiosk */}
      <button
        onClick={() => router.push("/ewallet/cashin")}
        className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white py-4 px-2 shadow-lg shadow-emerald-500/25 active:scale-[0.97] transition-all hover:from-emerald-600 hover:to-teal-700"
      >
        <div className="p-2.5 bg-white/20 rounded-xl">
          <Wallet className="h-6 w-6" />
        </div>
        <span className="text-[13px] font-bold">Kiosk</span>
        <span className="text-[10px] opacity-75">Self-service</span>
      </button>

      {/* HitPay Send Payout */}
      <button
        onClick={() => { setPayoutResult(null); setActiveSheet("hitpay") }}
        className="relative flex flex-col items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 text-white py-4 px-2 shadow-lg shadow-rose-500/25 active:scale-[0.97] transition-all hover:from-rose-600 hover:to-pink-700"
      >
        <div className="p-2.5 bg-white/20 rounded-xl">
          <Send className="h-6 w-6" />
        </div>
        <span className="text-[13px] font-bold">Send</span>
        <span className="text-[10px] opacity-75">HitPay</span>
      </button>
    </div>
  )

  return (
    <MobileAppShell
      title="E-Wallet"
      subtitle="GCash & Maya services"
      headerAction={
        <Button onClick={() => setShowSettings(true)} variant="outline" size="sm" className="h-9 gap-1.5">
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Settings</span>
        </Button>
      }
    >
      {/* ── MOBILE — GCash-style layout ─────────────────────────────────────── */}
      <div className="md:hidden -mx-4 -mt-4">

        {/* ── Hero: two wallet cards side by side ── */}
        <div className="px-4 pt-4 pb-0 space-y-3">

          {/* E-Load wallet card */}
          {canUseELoad && (
            <button
              onClick={() => router.push("/ewallet/load")}
              className="w-full rounded-3xl overflow-hidden active:scale-[0.98] transition-all text-left"
              style={{ background: "linear-gradient(135deg, #6d28d9 0%, #7c3aed 50%, #4f46e5 100%)", boxShadow: "0 8px 32px rgba(109,40,217,0.35)" }}
            >
              <div className="px-5 pt-5 pb-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center">
                      <Zap className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-bold text-[13px] leading-tight">E-Load Wallet</p>
                      <p className="text-white/50 text-[10px]">GBits · All Networks</p>
                    </div>
                  </div>
                  <span className="text-[9px] font-bold text-white/70 bg-white/15 px-2 py-0.5 rounded-full tracking-widest">LIVE</span>
                </div>
                <p className="text-white/60 text-[10px] font-semibold uppercase tracking-widest mb-0.5">Available Balance</p>
                {gbitsBalanceLoading ? (
                  <div className="h-9 w-36 bg-white/20 rounded-xl animate-pulse" />
                ) : gbitsBalance != null ? (
                  <p className="text-white text-[32px] font-black tracking-tight leading-none">
                    ₱{gbitsBalance.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                ) : (
                  <p className="text-white/50 text-sm">Tap to check balance</p>
                )}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/15">
                  <span className="text-white/50 text-[11px]">Tap to send load</span>
                  <ChevronRight className="h-4 w-4 text-white/40" />
                </div>
              </div>
            </button>
          )}

          {/* HitPay Cash-In wallet card */}
          <button
            onClick={() => { setPayoutResult(null); setActiveSheet("hitpay") }}
            className="w-full rounded-3xl overflow-hidden active:scale-[0.98] transition-all text-left"
            style={{ background: "linear-gradient(135deg, #be123c 0%, #f43f5e 50%, #fb7185 100%)", boxShadow: "0 8px 32px rgba(190,18,60,0.30)" }}
          >
            <div className="px-5 pt-5 pb-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center">
                    <Send className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-[13px] leading-tight">Cash-In Wallet</p>
                    <p className="text-white/50 text-[10px]">Powered by HitPay</p>
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); fetchHitpayBalance() }}
                  className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center active:scale-90 transition-transform"
                >
                  <RefreshCw className={`h-3.5 w-3.5 text-white ${hitpayBalanceLoading ? "animate-spin" : ""}`} />
                </button>
              </div>
              <p className="text-white/60 text-[10px] font-semibold uppercase tracking-widest mb-0.5">Available Balance</p>
              {hitpayBalanceLoading ? (
                <div className="h-9 w-36 bg-white/20 rounded-xl animate-pulse" />
              ) : hitpayBalanceError ? (
                <p className="text-white/50 text-sm flex items-center gap-1"><AlertCircle className="h-4 w-4" /> Not configured</p>
              ) : hitpayBalance != null ? (
                <p className="text-white text-[32px] font-black tracking-tight leading-none">
                  ₱{hitpayBalance.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              ) : (
                <p className="text-white/50 text-sm">Tap to check balance</p>
              )}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/15">
                <span className="text-white/50 text-[11px]">Tap to send payout</span>
                <ChevronRight className="h-4 w-4 text-white/40" />
              </div>
            </div>
          </button>
        </div>

        {/* ── Action buttons row — GCash style ── */}
        <div className="px-4 pt-5 pb-2">
          <div className="flex items-start justify-around">
            {/* Cash-in/out */}
            <button onClick={() => setActiveSheet("cashin")} className="flex flex-col items-center gap-2 active:scale-90 transition-transform">
              <div className="w-14 h-14 rounded-2xl bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <ArrowDownToLine className="h-6 w-6 text-white" />
              </div>
              <span className="text-[11px] font-semibold text-foreground text-center leading-tight">Cash-in<br/>/ Out</span>
            </button>

            {/* Send payout */}
            <button onClick={() => { setPayoutResult(null); setActiveSheet("hitpay") }} className="flex flex-col items-center gap-2 active:scale-90 transition-transform">
              <div className="w-14 h-14 rounded-2xl bg-rose-500 flex items-center justify-center shadow-lg shadow-rose-500/30">
                <Send className="h-6 w-6 text-white" />
              </div>
              <span className="text-[11px] font-semibold text-foreground text-center leading-tight">Send<br/>Payout</span>
            </button>

            {/* E-Load */}
            {canUseELoad && (
              <button onClick={() => router.push("/ewallet/load")} className="flex flex-col items-center gap-2 active:scale-90 transition-transform">
                <div className="w-14 h-14 rounded-2xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <span className="text-[11px] font-semibold text-foreground text-center leading-tight">E-Load</span>
              </button>
            )}

            {/* Kiosk */}
            <button onClick={() => router.push("/ewallet/cashin")} className="flex flex-col items-center gap-2 active:scale-90 transition-transform">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <Wallet className="h-6 w-6 text-white" />
              </div>
              <span className="text-[11px] font-semibold text-foreground text-center leading-tight">Kiosk</span>
            </button>

            {/* Settings */}
            <button onClick={() => setShowSettings(true)} className="flex flex-col items-center gap-2 active:scale-90 transition-transform">
              <div className="w-14 h-14 rounded-2xl bg-slate-500 flex items-center justify-center shadow-lg shadow-slate-500/20">
                <Settings className="h-6 w-6 text-white" />
              </div>
              <span className="text-[11px] font-semibold text-foreground text-center leading-tight">Settings</span>
            </button>
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="mx-4 my-3 border-t border-border/40" />

        {/* ── Period selector ── */}
        <div className="px-4 mb-3">{PeriodSelect}</div>

        {/* ── Stats row ── */}
        <div className="px-4 grid grid-cols-4 gap-2 mb-3">
          {[
            { label: "Profit",   value: `₱${stats.totalProfit.toLocaleString("en-PH", { minimumFractionDigits: 0 })}`,   color: "text-green-600" },
            { label: "Cash-In",  value: `₱${stats.grossCashin.toLocaleString("en-PH", { minimumFractionDigits: 0 })}`,  color: "text-blue-600" },
            { label: "Cash-Out", value: `₱${stats.grossCashout.toLocaleString("en-PH", { minimumFractionDigits: 0 })}`, color: "text-orange-600" },
            { label: "Load",     value: `₱${stats.grossLoad.toLocaleString("en-PH", { minimumFractionDigits: 0 })}`,    color: "text-violet-600" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl p-3 shadow-sm border border-border/30 text-center">
              <p className={`text-[13px] font-black truncate ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Transaction history ── */}
        <div className="px-4 pb-28">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">{historyTitle}</p>
          <div className="bg-white rounded-2xl shadow-sm border border-border/30 overflow-hidden">
            <div className="p-3">
              <TransactionHistory
                transactions={transactions}
                cashinTransactions={cashinTransactions}
                isLoading={isLoading}
                onRefresh={() => loadData()}
                hasMore={hasMore}
                onLoadMore={handleLoadMore}
                isLoadingMore={isLoadingMore}
                emptyHint={period === "today" ? "No transactions today" : `No transactions for ${periodLabel.toLowerCase()}`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── DESKTOP ────────────────────────────────────────────────────────── */}
      <div className="hidden md:block space-y-6">

        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Actions</p>
          {QuickActions}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-4">{PeriodSelect}</div>
          <div className="grid gap-2 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            <Card>
              <CardHeader className="p-3 pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />{periodLabel} Profit
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="text-lg font-bold text-secondary">₱{stats.totalProfit.toFixed(2)}</div>
              </CardContent>
            </Card>

            {period !== "today" && (
              <Card>
                <CardHeader className="p-3 pb-1">
                  <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />Today's Profit
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className="text-lg font-bold text-secondary">₱{stats.todayProfit.toFixed(2)}</div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="p-3 pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <ArrowDownToLine className="h-3 w-3" />Cash-In
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="text-lg font-bold text-blue-600">₱{stats.grossCashin.toFixed(2)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-3 pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <ArrowUpFromLine className="h-3 w-3" />Cash-Out
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="text-lg font-bold text-orange-600">₱{stats.grossCashout.toFixed(2)}</div>
              </CardContent>
            </Card>

            {/* Load stat — tappable only for store 8807 */}
            {canUseELoad ? (
              <button onClick={() => router.push("/ewallet/load")} className="text-left">
                <Card className="border-purple-200 hover:border-purple-400 hover:shadow-md transition-all cursor-pointer h-full">
                  <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Signal className="h-3 w-3" />Load
                      <ChevronRight className="h-3 w-3 ml-auto text-purple-400" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div className="text-lg font-bold text-purple-600">₱{stats.grossLoad.toFixed(2)}</div>
                  </CardContent>
                </Card>
              </button>
            ) : (
              <Card>
                <CardHeader className="p-3 pb-1">
                  <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Signal className="h-3 w-3" />Load
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className="text-lg font-bold text-purple-600">₱{stats.grossLoad.toFixed(2)}</div>
                </CardContent>
              </Card>
            )}

            {canUseELoad && (
              <button onClick={() => router.push("/ewallet/load")} className="text-left">
                <Card className="border-violet-200 hover:border-violet-400 hover:shadow-md transition-all cursor-pointer h-full">
                  <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Zap className="h-3 w-3 text-violet-500" />GBits Balance
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div className="text-lg font-bold text-violet-600">
                      {gbitsBalanceLoading ? "..." : gbitsBalance != null ? `₱${gbitsBalance.toFixed(2)}` : "N/A"}
                    </div>
                  </CardContent>
                </Card>
              </button>
            )}

            <Card>
              <CardHeader className="p-3 pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <History className="h-3 w-3" />Transactions
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="text-lg font-bold">{stats.totalTransactions}</div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="p-3 pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Smartphone className="h-4 w-4" />New Transaction
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                {commissionSettings ? (
                  <TransactionForm commissionSettings={commissionSettings} onSuccess={onTxSuccess} />
                ) : (
                  <div className="py-8 text-center text-sm text-muted-foreground">Loading settings...</div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-sm">{historyTitle}</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <TransactionHistory
                  transactions={transactions}
                  cashinTransactions={cashinTransactions}
                  isLoading={isLoading}
                  onRefresh={() => loadData()}
                  hasMore={hasMore}
                  onLoadMore={handleLoadMore}
                  isLoadingMore={isLoadingMore}
                  emptyHint={period === "today" ? "No transactions today" : `No transactions for ${periodLabel.toLowerCase()}`}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {commissionSettings && (
          <CommissionSettingsDialog
            settings={commissionSettings}
            open={showSettings}
            onOpenChange={setShowSettings}
            onSuccess={() => loadData()}
          />
        )}
      </div>

      {/* ── Bottom Sheets ──────────────────────────────────────────────────── */}
      <BottomSheet
        open={activeSheet === "cashin" || activeSheet === "cashout"}
        onClose={() => setActiveSheet("none")}
        title={activeSheet === "cashin" ? "Cash-In" : "Cash-Out"}
        description={activeSheet === "cashin" ? "Record a GCash or Maya cash-in" : "Record a GCash or Maya cash-out"}
      >
        <div className="pb-24">
          {commissionSettings ? (
            <TransactionForm
              commissionSettings={commissionSettings}
              onSuccess={onTxSuccess}
              defaultTab={activeSheet === "cashout" ? "cashout" : "cashin"}
            />
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading settings...</div>
          )}
        </div>
      </BottomSheet>

      {/* HitPay Send Payout Sheet */}
      <BottomSheet
        open={activeSheet === "hitpay"}
        onClose={() => { setActiveSheet("none"); setPayoutResult(null) }}
        title="Send Payout"
        description="Send money via HitPay to GCash, Maya, ShopeePay, or any bank"
      >
        <div className="pb-24 space-y-4 px-1">
          {/* Balance display */}
          <div className="flex items-center justify-between bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3">
            <div>
              <p className="text-[11px] text-rose-600 font-semibold uppercase tracking-widest">HitPay Balance</p>
              <p className="text-xl font-black text-rose-700">
                {hitpayBalanceLoading ? "..." : hitpayBalance != null ? `₱${hitpayBalance.toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : "N/A"}
              </p>
            </div>
            <button onClick={fetchHitpayBalance} className="p-2 rounded-xl bg-rose-100 active:scale-90 transition-transform">
              <RefreshCw className={`h-4 w-4 text-rose-600 ${hitpayBalanceLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Channel picker */}
          <div>
            <label className="text-[12px] font-semibold text-foreground mb-1.5 block">Channel</label>
            <div className="grid grid-cols-3 gap-2">
              {HITPAY_CHANNELS.map(ch => (
                <button
                  key={ch.value}
                  onClick={() => setPayoutChannel(ch.value)}
                  className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border text-[11px] font-semibold transition-all ${
                    payoutChannel === ch.value
                      ? "bg-rose-500 border-rose-500 text-white shadow-md"
                      : "bg-white border-border text-foreground active:scale-95"
                  }`}
                >
                  <span className="text-base">{ch.emoji}</span>
                  {ch.label}
                </button>
              ))}
            </div>
          </div>

          {/* Account number */}
          <div>
            <label className="text-[12px] font-semibold text-foreground mb-1.5 block">Account / Phone Number</label>
            <input
              type="tel"
              value={payoutAccount}
              onChange={e => setPayoutAccount(e.target.value)}
              placeholder="e.g. 09171234567"
              className="w-full h-11 rounded-xl border border-border bg-white px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-rose-400"
            />
          </div>

          {/* Account name */}
          <div>
            <label className="text-[12px] font-semibold text-foreground mb-1.5 block">Account Name <span className="text-muted-foreground font-normal">(optional)</span></label>
            <input
              type="text"
              value={payoutName}
              onChange={e => setPayoutName(e.target.value)}
              placeholder="Customer name"
              className="w-full h-11 rounded-xl border border-border bg-white px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-rose-400"
            />
          </div>

          {/* Amount */}
          <div>
            <label className="text-[12px] font-semibold text-foreground mb-1.5 block">Amount (₱)</label>
            <input
              type="number"
              value={payoutAmount}
              onChange={e => setPayoutAmount(e.target.value)}
              placeholder="0.00"
              min="1"
              className="w-full h-11 rounded-xl border border-border bg-white px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-rose-400"
            />
          </div>

          {/* Purpose */}
          <div>
            <label className="text-[12px] font-semibold text-foreground mb-1.5 block">Purpose <span className="text-muted-foreground font-normal">(optional)</span></label>
            <input
              type="text"
              value={payoutPurpose}
              onChange={e => setPayoutPurpose(e.target.value)}
              placeholder="Cash-in payout"
              className="w-full h-11 rounded-xl border border-border bg-white px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-rose-400"
            />
          </div>

          {/* Result */}
          {payoutResult && (
            <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-[13px] font-semibold ${
              payoutResult.ok ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"
            }`}>
              {payoutResult.ok ? "✅" : <AlertCircle className="h-4 w-4 flex-shrink-0" />}
              {payoutResult.msg}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handlePayout}
            disabled={payoutLoading || !payoutAccount || !payoutAmount}
            className="w-full h-12 rounded-xl bg-rose-500 text-white font-bold text-[14px] flex items-center justify-center gap-2 active:scale-[0.97] transition-all disabled:opacity-50 shadow-md shadow-rose-500/30"
          >
            {payoutLoading ? (
              <span className="animate-pulse">Sending...</span>
            ) : (
              <><Send className="h-4 w-4" /> Send Payout</>
            )}
          </button>
        </div>
      </BottomSheet>

      {commissionSettings && (
        <CommissionSettingsDialog
          settings={commissionSettings}
          open={showSettings}
          onOpenChange={setShowSettings}
          onSuccess={() => loadData()}
        />
      )}
    </MobileAppShell>
  )
}
