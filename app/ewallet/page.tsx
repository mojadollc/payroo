"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Smartphone, Settings, TrendingUp, History, Wallet, ArrowDownToLine, ArrowUpFromLine, Signal, Calendar, Plus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TransactionForm } from "@/components/ewallet/transaction-form"
import { TransactionHistory } from "@/components/ewallet/transaction-history"
import { CommissionSettingsDialog } from "@/components/ewallet/commission-settings-dialog"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { FloatingActionButton } from "@/components/ui/floating-action-button"
import { MobileAppShell, MobileCard, MobileSectionHeader } from "@/components/mobile-app-shell"
import { getEWalletTransactions, getCommissionSettings, getCashinTransactions } from "@/lib/firebase/services"
import type { EWalletTransaction, CommissionSettings } from "@/lib/firebase/types"
import { isFirebaseConfigured } from "@/lib/firebase/config"
import { getStoreId } from "@/lib/store-id"

export default function EWalletPage() {
  const router = useRouter()
  const [transactions, setTransactions] = useState<EWalletTransaction[]>([])
  const [cashinTransactions, setCashinTransactions] = useState<any[]>([])
  const [commissionSettings, setCommissionSettings] = useState<CommissionSettings | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState<string>("all")
  const [showNewTransaction, setShowNewTransaction] = useState(false)

  // Check Firebase configuration synchronously on mount
  if (!isFirebaseConfigured) {
    router.push("/setup")
    return null
  }

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const storeId = getStoreId()
      const [transactionsData, settingsData, cashinData] = await Promise.all([
        getEWalletTransactions(),
        getCommissionSettings(),
        getCashinTransactions(storeId),
      ])
      setTransactions(transactionsData || [])
      setCommissionSettings(settingsData || null)
      setCashinTransactions(cashinData || [])
    } catch (error) {
      console.error("[v0] Error loading e-wallet data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const calculateStats = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Filter transactions based on selected month
    let filteredTransactions = transactions
    if (selectedMonth !== "all") {
      const [year, month] = selectedMonth.split("-")
      filteredTransactions = transactions.filter((t) => {
        const transDate = t.createdAt.toDate()
        return transDate.getFullYear() === parseInt(year) && transDate.getMonth() === parseInt(month)
      })
    }

    const todayTransactions = transactions.filter((t) => {
      const transDate = t.createdAt.toDate()
      return transDate >= today
    })

    const totalProfit = filteredTransactions.reduce((sum, t) => sum + Math.abs(t.profit), 0)
    const todayProfit = todayTransactions.reduce((sum, t) => sum + Math.abs(t.profit), 0)
    const totalTransactions = filteredTransactions.length
    const todayTransactionsCount = todayTransactions.length

    const grossCashin = filteredTransactions.filter(t => t.type === "cashin").reduce((sum, t) => sum + t.amount, 0)
    const grossCashout = filteredTransactions.filter(t => t.type === "cashout").reduce((sum, t) => sum + t.amount, 0)
    const grossLoad = filteredTransactions.filter(t => t.type === "load").reduce((sum, t) => sum + t.amount, 0)

    return {
      totalProfit,
      todayProfit,
      totalTransactions,
      todayTransactionsCount,
      grossCashin,
      grossCashout,
      grossLoad,
    }
  }

  const stats = calculateStats()

  // Generate month options from transactions
  const getMonthOptions = () => {
    const months = new Set<string>()
    transactions.forEach((t) => {
      const date = t.createdAt.toDate()
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`
      months.add(monthKey)
    })
    return Array.from(months).sort().reverse().map((key) => {
      const [year, month] = key.split("-")
      const date = new Date(parseInt(year), parseInt(month))
      return {
        value: key,
        label: date.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      }
    })
  }

  const monthOptions = getMonthOptions()

  return (
    <MobileAppShell
      title="E-Wallet"
      subtitle="GCash & Maya services"
      headerAction={
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowSettings(true)}
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Settings</span>
          </Button>
          <Button
            onClick={() => router.push("/ewallet/cashin")}
            size="sm"
            className="h-9 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
          >
            <Wallet className="h-4 w-4" />
            <span className="hidden sm:inline">Kiosk</span>
          </Button>
        </div>
      }
    >
      {/* Mobile View */}
      <div className="md:hidden space-y-4">
        {/* Month Filter */}
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-full h-12 rounded-xl border-2">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by month" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            {monthOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <MobileCard className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-green-500 rounded-lg">
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                {selectedMonth === "all" ? "Total Profit" : "Monthly Profit"}
              </span>
            </div>
            <div className="text-2xl font-bold text-green-600">₱{stats.totalProfit.toFixed(2)}</div>
          </MobileCard>

          <MobileCard className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-blue-500 rounded-lg">
                <ArrowDownToLine className="h-4 w-4 text-white" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                {selectedMonth === "all" ? "Cash-In" : "Monthly Cash-In"}
              </span>
            </div>
            <div className="text-2xl font-bold text-blue-600">₱{stats.grossCashin.toFixed(2)}</div>
          </MobileCard>

          <MobileCard className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-orange-500 rounded-lg">
                <ArrowUpFromLine className="h-4 w-4 text-white" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                {selectedMonth === "all" ? "Cash-Out" : "Monthly Cash-Out"}
              </span>
            </div>
            <div className="text-2xl font-bold text-orange-600">₱{stats.grossCashout.toFixed(2)}</div>
          </MobileCard>

          <MobileCard className="p-4 bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-purple-500 rounded-lg">
                <Signal className="h-4 w-4 text-white" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                {selectedMonth === "all" ? "Load" : "Monthly Load"}
              </span>
            </div>
            <div className="text-2xl font-bold text-purple-600">₱{stats.grossLoad.toFixed(2)}</div>
          </MobileCard>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <MobileCard className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <History className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Today's Profit</span>
            </div>
            <div className="text-xl font-bold text-green-600">₱{stats.todayProfit.toFixed(2)}</div>
          </MobileCard>

          <MobileCard className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <History className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Transactions</span>
            </div>
            <div className="text-xl font-bold">{stats.totalTransactions}</div>
          </MobileCard>
        </div>

        {/* Transaction History */}
        <div>
          <MobileSectionHeader title="Recent Transactions" />
          <MobileCard>
            <div className="p-3">
              <TransactionHistory
                transactions={transactions}
                cashinTransactions={cashinTransactions}
                isLoading={isLoading}
                onRefresh={loadData}
              />
            </div>
          </MobileCard>
        </div>
      </div>

      {/* Desktop View */}
      <div className="hidden md:block">
        <div className="mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[180px] h-9">
                <Calendar className="h-3.5 w-3.5 mr-2" />
                <SelectValue placeholder="Filter by month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                {monthOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mb-4 grid gap-2 grid-cols-2 md:grid-cols-3 lg:grid-cols-7">
          <Card>
              <CardHeader className="p-3 pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {selectedMonth === "all" ? "Total Profit" : "Monthly Profit"}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="text-lg font-bold text-secondary">₱{stats.totalProfit.toFixed(2)}</div>
              </CardContent>
            </Card>

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

            <Card>
              <CardHeader className="p-3 pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <ArrowDownToLine className="h-3 w-3" />
                  {selectedMonth === "all" ? "Gross Cash-In" : "Monthly Cash-In"}
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
                  {selectedMonth === "all" ? "Gross Cash-Out" : "Monthly Cash-Out"}
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
                  {selectedMonth === "all" ? "Gross Load" : "Monthly Load"}
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
                  {selectedMonth === "all" ? "Total Transactions" : "Monthly Transactions"}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="text-lg font-bold">{stats.totalTransactions}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-3 pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <History className="h-3 w-3" />
                  Today's Transactions
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="text-lg font-bold">{stats.todayTransactionsCount}</div>
              </CardContent>
            </Card>
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
                  <TransactionForm commissionSettings={commissionSettings} onSuccess={loadData} />
                ) : (
                  <div className="py-8 text-center text-sm text-muted-foreground">Loading settings...</div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-sm">Transaction History</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <TransactionHistory transactions={transactions} cashinTransactions={cashinTransactions} isLoading={isLoading} onRefresh={loadData} />
              </CardContent>
            </Card>
          </div>
        </div>

        {commissionSettings && (
          <CommissionSettingsDialog
            settings={commissionSettings}
            open={showSettings}
            onOpenChange={setShowSettings}
            onSuccess={loadData}
          />
        )}
      </div>

      {/* Floating Action Button (Mobile) */}
      <FloatingActionButton
        icon={<Plus className="h-7 w-7" />}
        label="New Transaction"
        onClick={() => setShowNewTransaction(true)}
      />

      {/* New Transaction Bottom Sheet (Mobile) */}
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
                loadData()
                setShowNewTransaction(false)
              }}
            />
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading settings...</div>
          )}
        </div>
      </BottomSheet>

      {/* Settings Dialog */}
      {commissionSettings && (
        <CommissionSettingsDialog
          settings={commissionSettings}
          open={showSettings}
          onOpenChange={setShowSettings}
          onSuccess={loadData}
        />
      )}
    </MobileAppShell>
  )
}
