"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Smartphone,
  Settings,
  TrendingUp,
  History,
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Signal,
  Calendar,
  Plus,
  Zap,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TransactionForm } from "@/components/ewallet/transaction-form"
import { TransactionHistory } from "@/components/ewallet/transaction-history"
import { CommissionSettingsDialog } from "@/components/ewallet/commission-settings-dialog"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { FloatingActionButton } from "@/components/ui/floating-action-button"
import { MobileAppShell, MobileCard, MobileSectionHeader } from "@/components/mobile-app-shell"
import { getStoreId } from "@/lib/store-id"
import type { EWalletTransaction, CommissionSettings } from "@/lib/firebase/types"

type Period = "today" | "week" | "month" | "all"

function getPeriodRange(period: Period): { start?: Date; end?: Date; max?: number } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  if (period === "today") return { start, end }
  if (period === "week") {
    start.setDate(start.getDate() - 6)
    return { start, end }
  }
  if (period === "month") {
    start.setDate(1)
    return { start, end }
  }
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
  const [showNewTransaction, setShowNewTransaction] = useState(false)
  const allLimitRef = useRef(50)

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

  // Single load on mount + whenever period changes
  useEffect(() => {
    hasLoaded.current = false
    allLimitRef.current = 50
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period])

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

    return {
      totalProfit,
      todayProfit,
      totalTransactions: transactions.length,
      todayTransactionsCount: todayTransactions.length,
      grossCashin,
      grossCashout,
      grossLoad,
    }
  }

  const stats = calculateStats()

  const periodLabel =
    period === "today"
      ? "Today"
      : period === "week"
        ? "This Week"
        : period === "month"
          ? "This Month"
          : "All Time"

  const historyTitle =
    period === "today" ? "Today's Transactions" : `Transactions · ${periodLabel}`

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

  return (
    <MobileAppShell
      title="E-Wallet"
      subtitle="GCash & Maya services"
      headerAction={
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowSettings(true)} variant="outline" size="sm" className="h-9 gap-1.5">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Settings</span>
          </Button>
          <Button
            onClick={() => router.push("/ewallet/load")}
            size="sm"
            className="h-9 gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold"
          >
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Load</span>
          </Button>
          <Button onClick={() => router.push("/ewallet/cashin")} size="sm" className="h-9 gap-1.5">
            <Wallet className="h-4 w-4" />
            <span className="hidden sm:inline">Kiosk</span>
          </Button>
        </div>
      }
    >
      {/* Mobile View */}
      <div className="md:hidden space-y-4">
        {PeriodSelect}

        <div className="grid grid-cols-2 gap-3">
          <MobileCard className="p-3 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="p-1.5 bg-green-500 rounded-md">
                <TrendingUp className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-[11px] text-muted-foreground">{periodLabel} Profit</span>
            </div>
            <div className="text-[15px] font-bold text-green-600 truncate">
              ₱{stats.totalProfit.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </MobileCard>

          <MobileCard className="p-3 bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="p-1.5 bg-blue-500 rounded-md">
                <ArrowDownToLine className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-[11px] text-muted-foreground">Cash-In</span>
            </div>
            <div className="text-[15px] font-bold text-blue-600 truncate">
              ₱{stats.grossCashin.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </MobileCard>

          <MobileCard className="p-3 bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="p-1.5 bg-orange-500 rounded-md">
                <ArrowUpFromLine className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-[11px] text-muted-foreground">Cash-Out</span>
            </div>
            <div className="text-[15px] font-bold text-orange-600 truncate">
              ₱{stats.grossCashout.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </MobileCard>

          <MobileCard className="p-3 bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="p-1.5 bg-purple-500 rounded-md">
                <Signal className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-[11px] text-muted-foreground">Load</span>
            </div>
            <div className="text-[15px] font-bold text-purple-600 truncate">
              ₱{stats.grossLoad.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </MobileCard>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {period !== "today" && (
            <MobileCard className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">Today's Profit</span>
              </div>
              <div className="text-[15px] font-bold text-green-600 truncate">
                ₱{stats.todayProfit.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </MobileCard>
          )}
          <MobileCard className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <History className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">{periodLabel} Transactions</span>
            </div>
            <div className="text-[15px] font-bold truncate">{stats.totalTransactions.toLocaleString()}</div>
          </MobileCard>
          {period !== "today" && (
            <MobileCard className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <History className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">Today's Count</span>
              </div>
              <div className="text-[15px] font-bold truncate">{stats.todayTransactionsCount.toLocaleString()}</div>
            </MobileCard>
          )}
        </div>

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
                emptyHint={
                  period === "today"
                    ? "No transactions today"
                    : `No transactions for ${periodLabel.toLowerCase()}`
                }
              />
            </div>
          </MobileCard>
        </div>
      </div>

      {/* Desktop View */}
      <div className="hidden md:block">
        <div className="mb-6">
          <div className="flex items-center gap-2 flex-wrap">{PeriodSelect}</div>
        </div>

        <div className="mb-4 grid gap-2 grid-cols-2 md:grid-cols-3 lg:grid-cols-7">
          <Card>
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {periodLabel} Profit
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
                  <TrendingUp className="h-3 w-3" />
                  Today's Profit
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
                <ArrowDownToLine className="h-3 w-3" />
                Cash-In
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-lg font-bold text-blue-600">₱{stats.grossCashin.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <ArrowUpFromLine className="h-3 w-3" />
                Cash-Out
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-lg font-bold text-orange-600">₱{stats.grossCashout.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Signal className="h-3 w-3" />
                Load
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-lg font-bold text-purple-600">₱{stats.grossLoad.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <History className="h-3 w-3" />
                Transactions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-lg font-bold">{stats.totalTransactions}</div>
            </CardContent>
          </Card>

          {period !== "today" && (
            <Card>
              <CardHeader className="p-3 pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <History className="h-3 w-3" />
                  Today's Count
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="text-lg font-bold">{stats.todayTransactionsCount}</div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="p-3 pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Smartphone className="h-4 w-4" />
                  New Transaction
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                {commissionSettings ? (
                  <TransactionForm commissionSettings={commissionSettings} onSuccess={() => { hasLoaded.current = false; loadData() }} />
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
                  emptyHint={
                    period === "today"
                      ? "No transactions today"
                      : `No transactions for ${periodLabel.toLowerCase()}`
                  }
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

      {/* Smaller FAB on mobile */}
      <FloatingActionButton
        size="sm"
        icon={<Plus className="h-5 w-5" />}
        label="New"
        onClick={() => setShowNewTransaction(true)}
      />

      <BottomSheet
        open={showNewTransaction}
        onClose={() => setShowNewTransaction(false)}
        title="New Transaction"
        description="Record a new e-wallet transaction"
      >
        <div className="pb-24 md:pb-0">
          {commissionSettings ? (
            <TransactionForm
              commissionSettings={commissionSettings}
              onSuccess={() => {
                hasLoaded.current = false
                loadData()
                setShowNewTransaction(false)
              }}
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
