"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Smartphone, Settings, TrendingUp, History, Wallet, ArrowDownToLine, ArrowUpFromLine, Signal, Calendar } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TransactionForm } from "@/components/ewallet/transaction-form"
import { TransactionHistory } from "@/components/ewallet/transaction-history"
import { CommissionSettingsDialog } from "@/components/ewallet/commission-settings-dialog"
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
    <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold">E-Wallet</h1>
                <p className="text-sm text-muted-foreground mt-0.5">GCash & Maya services</p>
              </div>
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
                <Button onClick={() => setShowSettings(true)} variant="outline" size="sm" className="gap-1.5">
                  <Settings className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Settings</span>
                </Button>
                <Button onClick={() => router.push("/ewallet/cashin")} size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                  <Wallet className="h-3.5 w-3.5" />
                  Kiosk
                </Button>
              </div>
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
    )
}
