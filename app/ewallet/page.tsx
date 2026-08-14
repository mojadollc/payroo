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
type ActiveSheet = "none" | "cashin" | "cashout"

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

  useEffect(() => {
    // Read balance from localStorage (written by E-Load page after each successful buy)
    const saved = localStorage.getItem("gbits_balance")
    if (saved != null) {
      setGbitsBalance(parseFloat(saved))
      setGbitsBalanceError(false)
    } else {
      setGbitsBalanceError(true)
    }

    // Listen for updates from the E-Load page (same tab or other tabs)
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
      <SelectTrigger className="w-full md:w-[200px] h-11 md:h-9 rounded-xl border-2 md:rounded-md md:border">
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
    <div className={`grid gap-3 ${canUseELoad ? "grid-cols-3" : "grid-cols-2"}`}>

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
      {/* ── MOBILE ─────────────────────────────────────────────────────────── */}
      <div className="md:hidden space-y-4">

        {QuickActions}

        {/* GBits Wallet Card — GCash/GoTyme style */}
        {canUseELoad && (
          <button
            onClick={() => router.push("/ewallet/load")}
            className="w-full rounded-3xl overflow-hidden shadow-lg active:scale-[0.98] transition-all text-left"
            style={{ background: "linear-gradient(135deg, #6d28d9 0%, #7c3aed 50%, #4f46e5 100%)" }}
          >
            <div className="px-5 pt-5 pb-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                    <Zap className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-white font-bold text-sm tracking-wide">E-Load Wallet</span>
                </div>
                <span className="text-[10px] font-bold text-white/70 bg-white/15 px-2 py-0.5 rounded-full tracking-widest">LIVE</span>
              </div>
              <div className="mb-1">
                <p className="text-white/60 text-[11px] font-medium uppercase tracking-widest mb-0.5">Available Balance</p>
                {gbitsBalanceLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-32 bg-white/20 rounded-xl animate-pulse" />
                  </div>
                ) : gbitsBalanceError ? (
                  <p className="text-white/60 text-sm font-medium">Send a load to see balance</p>
                ) : (
                  <p className="text-white text-3xl font-black tracking-tight">
                    ₱{(gbitsBalance ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/20">
                <span className="text-white/60 text-[11px]">Tap to send load</span>
                <ChevronRight className="h-4 w-4 text-white/60" />
              </div>
            </div>
          </button>
        )}

        {/* Cash-Out shortcut row */}
        <button
          onClick={() => setActiveSheet("cashout")}
          className="w-full flex items-center justify-between bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-2xl px-4 py-3 active:scale-[0.98] transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500 rounded-xl">
              <ArrowUpFromLine className="h-4 w-4 text-white" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-orange-700">Cash-Out</p>
              <p className="text-[11px] text-orange-500">Record a cash-out transaction</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-orange-400" />
        </button>

        {PeriodSelect}

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <MobileCard className="p-3 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="p-1.5 bg-green-500 rounded-md"><TrendingUp className="h-3.5 w-3.5 text-white" /></div>
              <span className="text-[11px] text-muted-foreground">{periodLabel} Profit</span>
            </div>
            <div className="text-[15px] font-bold text-green-600 truncate">
              ₱{stats.totalProfit.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </MobileCard>

          <MobileCard className="p-3 bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="p-1.5 bg-blue-500 rounded-md"><ArrowDownToLine className="h-3.5 w-3.5 text-white" /></div>
              <span className="text-[11px] text-muted-foreground">Cash-In</span>
            </div>
            <div className="text-[15px] font-bold text-blue-600 truncate">
              ₱{stats.grossCashin.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </MobileCard>

          <MobileCard className="p-3 bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="p-1.5 bg-orange-500 rounded-md"><ArrowUpFromLine className="h-3.5 w-3.5 text-white" /></div>
              <span className="text-[11px] text-muted-foreground">Cash-Out</span>
            </div>
            <div className="text-[15px] font-bold text-orange-600 truncate">
              ₱{stats.grossCashout.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </MobileCard>

          {/* Load stat card — tappable only for store 8807, plain card for others */}
          {canUseELoad ? (
            <button
              onClick={() => router.push("/ewallet/load")}
              className="text-left p-3 bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-200 rounded-xl active:scale-[0.97] transition-all"
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="p-1.5 bg-purple-500 rounded-md"><Signal className="h-3.5 w-3.5 text-white" /></div>
                <span className="text-[11px] text-muted-foreground">Load</span>
                <ChevronRight className="h-3 w-3 text-purple-400 ml-auto" />
              </div>
              <div className="text-[15px] font-bold text-purple-600 truncate">
                ₱{stats.grossLoad.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </button>
          ) : (
            <MobileCard className="p-3 bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="p-1.5 bg-purple-500 rounded-md"><Signal className="h-3.5 w-3.5 text-white" /></div>
                <span className="text-[11px] text-muted-foreground">Load</span>
              </div>
              <div className="text-[15px] font-bold text-purple-600 truncate">
                ₱{stats.grossLoad.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </MobileCard>
          )}
        </div>

        {period !== "today" && (
          <div className="grid grid-cols-2 gap-3">
            <MobileCard className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">Today's Profit</span>
              </div>
              <div className="text-[15px] font-bold text-green-600 truncate">
                ₱{stats.todayProfit.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </MobileCard>
            <MobileCard className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <History className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">Today's Count</span>
              </div>
              <div className="text-[15px] font-bold truncate">{stats.todayTransactionsCount.toLocaleString()}</div>
            </MobileCard>
          </div>
        )}

        <div>
          <MobileSectionHeader title={historyTitle} />
          <MobileCard>
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
          </MobileCard>
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
                      {gbitsBalanceLoading ? "..." : gbitsBalanceError ? "N/A" : `₱${(gbitsBalance ?? 0).toFixed(2)}`}
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
