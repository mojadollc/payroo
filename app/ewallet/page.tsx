"use client"

import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react"
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

// ── Send Payout Sheet (isolated so typing never re-renders parent) ──────────
const DEFAULT_PAYOUT_CHANNELS = [
  { id: "gcash",     label: "GCash",      type: "wallet", logo: "/wallets/gcash.svg",     color: "#007DFF" },
  { id: "paymaya",   label: "Maya",       type: "wallet", logo: "/wallets/maya.svg",      color: "#00A651" },
  { id: "shopeepay", label: "ShopeePay",  type: "wallet", logo: "/wallets/shopeepay.svg", color: "#EE4D2D" },
  { id: "bpi",       label: "BPI",        type: "bank",   logo: "/wallets/bpi.svg",       color: "#C8102E" },
  { id: "unionbank", label: "UnionBank",  type: "bank",   logo: "/wallets/unionbank.svg", color: "#003087" },
  { id: "chinabank", label: "China Bank", type: "bank",   logo: "/wallets/chinabank.svg", color: "#C8102E" },
  { id: "rcbc",      label: "RCBC",       type: "bank",   logo: "/wallets/rcbc.svg",       color: "#003087" },
  { id: "bdo",       label: "BDO",        type: "bank",   logo: null,                      color: "#003087" },
  { id: "metrobank", label: "Metrobank",  type: "bank",   logo: null,                      color: "#003087" },
  { id: "landbank",  label: "Landbank",   type: "bank",   logo: null,                      color: "#006400" },
  { id: "pnb",       label: "PNB",        type: "bank",   logo: null,                      color: "#003087" },
]

const SendPayoutSheet = memo(function SendPayoutSheet({
  open, onClose, onPayoutSuccess,
}: { open: boolean; onClose: () => void; onPayoutSuccess: () => void }) {
  const [channel, setChannel] = useState("gcash")
  const [account, setAccount] = useState("")
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [purpose, setPurpose] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [channels, setChannels] = useState(DEFAULT_PAYOUT_CHANNELS)

  useEffect(() => {
    fetch("/api/hitpay/channels")
      .then(r => r.json())
      .then(d => { if (d.channels?.length) setChannels(d.channels) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!open) { setAccount(""); setName(""); setAmount(""); setPurpose(""); setResult(null) }
  }, [open])

  const selectedType = channels.find(c => c.id === channel)?.type ?? "wallet"

  const handleSend = async () => {
    if (!channel || !account || !amount) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch("/api/hitpay/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, accountNumber: account, accountName: name, amount: parseFloat(amount), purpose: purpose || "Cash-in payout" }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult({ ok: true, msg: "Payout sent successfully!" })
        setAccount(""); setName(""); setAmount(""); setPurpose("")
        onPayoutSuccess()
      } else {
        setResult({ ok: false, msg: data.error ?? data.raw ?? "Payout failed" })
      }
    } catch {
      setResult({ ok: false, msg: "Network error. Please try again." })
    } finally {
      setLoading(false)
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Send Payout" description="Select a channel and fill in the details">
      <div className="space-y-5 pt-2">
        <div>
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Select Channel</p>
          <div className="grid grid-cols-4 gap-2">
            {channels.map(ch => (
              <button key={ch.id} onPointerDown={() => setChannel(ch.id)}
                className={`flex flex-col items-center justify-center gap-1.5 py-3 px-1 rounded-2xl border-2 transition-colors ${
                  channel === ch.id ? "border-rose-500 bg-rose-50 shadow-md" : "border-transparent bg-muted/40"
                }`}>
                {ch.logo ? (
                  <img src={ch.logo} alt={ch.label} className="w-8 h-8 rounded-xl object-contain"
                    onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />
                ) : (
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-[11px] font-black" style={{ background: ch.color }}>
                    {ch.label.slice(0, 2)}
                  </div>
                )}
                <span className={`text-[10px] font-semibold text-center leading-tight ${
                  channel === ch.id ? "text-rose-600" : "text-foreground"
                }`}>{ch.label}</span>
              </button>
            ))}
          </div>
        </div>

        {selectedType === "bank" && (
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Payment Rail</p>
            <div className="grid grid-cols-2 gap-2">
              {["instapay", "pesonet"].map(rail => (
                <button key={rail} onPointerDown={() => setPurpose(rail)}
                  className={`py-3 rounded-2xl border-2 text-[13px] font-bold transition-colors ${
                    purpose === rail ? "border-rose-500 bg-rose-50 text-rose-600" : "border-transparent bg-muted/40 text-foreground"
                  }`}>
                  {rail === "instapay" ? "⚡ InstaPay" : "🏦 PESONet"}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="text-[12px] font-bold text-foreground mb-1.5 block">
            {selectedType === "wallet" ? "Mobile Number" : "Account Number"}
          </label>
          <input type="tel" inputMode="numeric" value={account} onChange={e => setAccount(e.target.value)}
            placeholder={selectedType === "wallet" ? "09171234567" : "Account number"}
            className="w-full h-12 rounded-2xl border border-border bg-muted/30 px-4 text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-rose-400 focus:bg-white" />
        </div>

        <div>
          <label className="text-[12px] font-bold text-foreground mb-1.5 block">Account Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Customer name"
            className="w-full h-12 rounded-2xl border border-border bg-muted/30 px-4 text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-rose-400 focus:bg-white" />
        </div>

        <div>
          <label className="text-[12px] font-bold text-foreground mb-1.5 block">Amount</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[18px] font-black text-muted-foreground">₱</span>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" min="1"
              className="w-full h-14 rounded-2xl border border-border bg-muted/30 pl-9 pr-4 text-[22px] font-black focus:outline-none focus:ring-2 focus:ring-rose-400 focus:bg-white" />
          </div>
        </div>

        {result && (
          <div className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 text-[13px] font-semibold ${
            result.ok ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"
          }`}>
            <span className="text-xl">{result.ok ? "✅" : "❌"}</span>
            {result.msg}
          </div>
        )}

        <button onClick={handleSend} disabled={loading || !account || !amount || !channel}
          className="w-full h-14 rounded-2xl bg-rose-500 text-white font-black text-[16px] flex items-center justify-center gap-2 disabled:opacity-40 shadow-lg shadow-rose-500/30">
          {loading ? <span className="animate-pulse">Sending...</span> : <><Send className="h-5 w-5" /> Send ₱{amount || "0"}</>}
        </button>
        <div className="h-4" />
      </div>
    </BottomSheet>
  )
})

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
  const allLimitRef = useRef(50)

  // E-Load and HitPay Payout exclusive to store 8807
  const storeId = getStoreId()
  const canUseELoad = storeId === "8807"
  const canUseHitpay = storeId === "8807"

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

  const stats = useMemo(() => calculateStats(), [transactions]) // eslint-disable-line react-hooks/exhaustive-deps
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
        onClick={() => setActiveSheet("hitpay")}
        className="relative flex flex-col items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 text-white py-4 px-2 shadow-lg shadow-rose-500/25 active:scale-[0.97] transition-all hover:from-rose-600 hover:to-pink-700"
      >
        <div className="p-2.5 bg-white/20 rounded-xl">
          <Send className="h-6 w-6" />
        </div>
        <span className="text-[13px] font-bold">Send</span>
        <span className="text-[10px] opacity-75">Xendit</span>
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

        {/* ── Hero: 2-column wallet cards ── */}
        <div className="px-4 pt-4 pb-0 grid grid-cols-2 gap-3">

          {/* E-Load wallet card — exclusive to store 8807 */}
          {canUseELoad ? (
            <button
              onClick={() => router.push("/ewallet/load")}
              className="rounded-2xl overflow-hidden active:scale-[0.97] transition-all text-left"
              style={{ background: "linear-gradient(135deg, #6d28d9 0%, #7c3aed 50%, #4f46e5 100%)", boxShadow: "0 6px 20px rgba(109,40,217,0.35)" }}
            >
              <div className="px-4 pt-4 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                    <Zap className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-[9px] font-bold text-white/70 bg-white/15 px-1.5 py-0.5 rounded-full tracking-widest">LIVE</span>
                </div>
                <p className="text-white/60 text-[9px] font-semibold uppercase tracking-widest mb-0.5">E-Load Wallet</p>
                {gbitsBalanceLoading ? (
                  <div className="h-7 w-24 bg-white/20 rounded-lg animate-pulse" />
                ) : gbitsBalance != null ? (
                  <p className="text-white text-[20px] font-black tracking-tight leading-none">
                    ₱{gbitsBalance.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                ) : (
                  <p className="text-white/50 text-[12px]">Tap to check</p>
                )}
                <p className="text-white/40 text-[10px] mt-2">GBits · All Networks</p>
              </div>
            </button>
          ) : (
            <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 text-white px-4 pt-4 pb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                  <ArrowDownToLine className="h-4 w-4 text-white" />
                </div>
              </div>
              <p className="text-white/60 text-[9px] font-semibold uppercase tracking-widest mb-0.5">Quick Record</p>
              <p className="text-white text-[16px] font-black">Cash-in/out</p>
              <p className="text-white/40 text-[10px] mt-2">GCash · Maya</p>
            </div>
          )}

          {/* HitPay Payout wallet card — exclusive to store 8807 */}
          {canUseHitpay ? (
            <button
              onClick={() => setActiveSheet("hitpay")}
              className="rounded-2xl overflow-hidden active:scale-[0.97] transition-all text-left"
              style={{ background: "linear-gradient(135deg, #be123c 0%, #f43f5e 50%, #fb7185 100%)", boxShadow: "0 6px 20px rgba(190,18,60,0.30)" }}
            >
              <div className="px-4 pt-4 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                    <Send className="h-4 w-4 text-white" />
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); fetchHitpayBalance() }}
                    className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center active:scale-90 transition-transform"
                  >
                    <RefreshCw className={`h-3 w-3 text-white ${hitpayBalanceLoading ? "animate-spin" : ""}`} />
                  </button>
                </div>
                <p className="text-white/60 text-[9px] font-semibold uppercase tracking-widest mb-0.5">Payout Wallet</p>
                {hitpayBalanceLoading ? (
                  <div className="h-7 w-24 bg-white/20 rounded-lg animate-pulse" />
                ) : hitpayBalanceError ? (
                  <p className="text-white/50 text-[12px]">Not configured</p>
                ) : hitpayBalance != null ? (
                  <p className="text-white text-[20px] font-black tracking-tight leading-none">
                    ₱{hitpayBalance.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                ) : (
                  <p className="text-white/50 text-[12px]">Tap to check</p>
                )}
                <p className="text-white/40 text-[10px] mt-2">Powered by Xendit</p>
              </div>
            </button>
          ) : (
            <button onClick={() => setActiveSheet("cashin")} className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white px-4 pt-4 pb-4 text-left">
              <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                  <Wallet className="h-4 w-4 text-white" />
                </div>
              </div>
              <p className="text-white/60 text-[9px] font-semibold uppercase tracking-widest mb-0.5">Self-Service</p>
              <p className="text-white text-[16px] font-black">Kiosk</p>
              <p className="text-white/40 text-[10px] mt-2">Tap to open</p>
            </button>
          )}
        </div>

        {/* ── Action buttons row — visible to all stores ── */}
        <div className="px-4 pt-5 pb-2">
          <div className="flex items-start justify-between gap-2">
            <button onClick={() => setActiveSheet("cashin")} className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform">
              <div className="w-12 h-12 rounded-2xl bg-blue-500 flex items-center justify-center shadow-md shadow-blue-500/30">
                <ArrowDownToLine className="h-5 w-5 text-white" />
              </div>
              <span className="text-[10px] font-semibold text-foreground text-center">Cash In/Out</span>
            </button>

            {canUseHitpay && (
              <button onClick={() => setActiveSheet("hitpay")} className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform">
                <div className="w-12 h-12 rounded-2xl bg-rose-500 flex items-center justify-center shadow-md shadow-rose-500/30">
                  <Send className="h-5 w-5 text-white" />
                </div>
                <span className="text-[10px] font-semibold text-foreground text-center">Send</span>
              </button>
            )}

            {canUseELoad && (
              <button onClick={() => router.push("/ewallet/load")} className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform">
                <div className="w-12 h-12 rounded-2xl bg-violet-600 flex items-center justify-center shadow-md shadow-violet-500/30">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <span className="text-[10px] font-semibold text-foreground text-center">Load</span>
              </button>
            )}

            <button onClick={() => router.push("/ewallet/cashin")} className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-md shadow-emerald-500/30">
                <Wallet className="h-5 w-5 text-white" />
              </div>
              <span className="text-[10px] font-semibold text-foreground text-center">Kiosk</span>
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

            <button onClick={fetchHitpayBalance} className="text-left">
              <Card className="border-rose-200 hover:border-rose-400 hover:shadow-md transition-all cursor-pointer h-full">
                <CardHeader className="p-3 pb-1">
                  <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Send className="h-3 w-3 text-rose-500" />Xendit Balance
                    <RefreshCw className={`h-3 w-3 ml-auto text-rose-400 ${hitpayBalanceLoading ? "animate-spin" : ""}`} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className="text-lg font-bold text-rose-600">
                    {hitpayBalanceLoading ? "..." : hitpayBalanceError ? "N/A" : hitpayBalance != null ? `₱${hitpayBalance.toFixed(2)}` : "N/A"}
                  </div>
                </CardContent>
              </Card>
            </button>

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
      <SendPayoutSheet
        open={activeSheet === "hitpay"}
        onClose={() => setActiveSheet("none")}
        onPayoutSuccess={fetchHitpayBalance}
      />

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
