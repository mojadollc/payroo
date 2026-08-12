"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { TrendingUp, ShoppingCart, Wallet, Download, CalendarDays, Receipt, BadgeDollarSign, CircleDollarSign, ChevronDown, ArrowUpRight, Activity, Cigarette } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DateRangePicker } from "@/components/reports/date-range-picker"
import { SalesReport } from "@/components/reports/sales-report"
import { EWalletReport } from "@/components/reports/ewallet-report"
import { TobaccoReport } from "@/components/reports/tobacco-report"
import dynamic from "next/dynamic"
// recharts pulls in a sizeable chunk of its own — split it out of the main
// reports bundle so tapping into Reports doesn't wait on chart code to parse.
const ProfitChart = dynamic(
  () => import("@/components/reports/profit-chart").then(m => m.ProfitChart),
  { ssr: false, loading: () => <div className="h-[300px] w-full animate-pulse bg-muted/30 rounded-lg" /> }
)
import { MobileAppShell, MobileCard, MobileSectionHeader } from "@/components/mobile-app-shell"
import { useAuth } from "@/hooks/use-auth"
import { useSubscription } from "@/hooks/use-subscription"
import { getStoreId } from "@/lib/store-id"
import type { Sale, EWalletTransaction, Product } from "@/lib/firebase/types"

// ── CSV helpers ────────────────────────────────────────────────────────────────

function escapeCell(val: unknown): string {
  const s = val === null || val === undefined ? "" : String(val)
  return `"${s.replace(/"/g, '""')}"`
}

function buildCSV(headers: string[], rows: unknown[][]): string {
  return [headers.map(escapeCell).join(","), ...rows.map(r => r.map(escapeCell).join(","))].join("\n")
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob(["\uFEFF" + csv, ""], { type: "text/csv;charset=utf-8;" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

function fmtDate(ts: any): string {
  if (!ts) return ""
  const d: Date = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleString("en-PH", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: true })
}

function fmtDateOnly(ts: any): string {
  if (!ts) return ""
  const d: Date = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "2-digit", day: "2-digit" })
}

// ── Export functions ───────────────────────────────────────────────────────────

function exportSalesSummary(sales: Sale[], label: string) {
  const headers = [
    "Sale ID", "Date & Time", "Payment Method", "Status",
    "# Items", "Total Items Qty", "Gross Sales (₱)", "Cost of Goods (₱)", "Net Profit (₱)",
  ]
  const rows = sales.map(s => {
    const cog = s.items.reduce((sum, i) => sum + i.cost * i.quantity, 0)
    const profit = s.items.reduce((sum, i) => sum + (i.price - i.cost) * i.quantity, 0)
    const totalQty = s.items.reduce((sum, i) => sum + i.quantity, 0)
    return [
      s.id ?? "", fmtDate(s.createdAt), s.paymentMethod.toUpperCase(), s.status,
      s.items.length, totalQty, s.total.toFixed(2), cog.toFixed(2), profit.toFixed(2),
    ]
  })
  // Summary footer
  const totalGross = sales.reduce((sum, s) => sum + s.total, 0)
  const totalCOG = sales.reduce((sum, s) => sum + s.items.reduce((p, i) => p + i.cost * i.quantity, 0), 0)
  const totalProfit = sales.reduce((sum, s) => sum + s.items.reduce((p, i) => p + (i.price - i.cost) * i.quantity, 0), 0)
  rows.push(["", "", "", "TOTAL", "", "", totalGross.toFixed(2), totalCOG.toFixed(2), totalProfit.toFixed(2)])
  downloadCSV(buildCSV(headers, rows), `sales-summary_${label}.csv`)
}

function exportSalesLineItems(sales: Sale[], label: string) {
  const headers = [
    "Sale ID", "Date", "Payment Method",
    "Product Name", "Qty", "Unit Price (₱)", "Unit Cost (₱)", "Subtotal (₱)", "Item Profit (₱)",
  ]
  const rows: unknown[][] = []
  for (const s of sales) {
    for (const item of s.items) {
      rows.push([
        s.id ?? "", fmtDate(s.createdAt), s.paymentMethod.toUpperCase(),
        item.productName, item.quantity,
        item.price.toFixed(2), item.cost.toFixed(2),
        item.subtotal.toFixed(2),
        ((item.price - item.cost) * item.quantity).toFixed(2),
      ])
    }
  }
  downloadCSV(buildCSV(headers, rows), `sales-line-items_${label}.csv`)
}

function exportDailySummary(sales: Sale[], label: string) {
  // Group by date
  const map = new Map<string, { gross: number; cog: number; profit: number; txCount: number; itemsSold: number }>()
  for (const s of sales) {
    const date = fmtDateOnly(s.createdAt)
    const cog = s.items.reduce((sum, i) => sum + i.cost * i.quantity, 0)
    const profit = s.items.reduce((sum, i) => sum + (i.price - i.cost) * i.quantity, 0)
    const qty = s.items.reduce((sum, i) => sum + i.quantity, 0)
    const ex = map.get(date)
    if (ex) { ex.gross += s.total; ex.cog += cog; ex.profit += profit; ex.txCount++; ex.itemsSold += qty }
    else map.set(date, { gross: s.total, cog, profit, txCount: 1, itemsSold: qty })
  }
  const headers = ["Date", "Transactions", "Items Sold", "Gross Sales (₱)", "Cost of Goods (₱)", "Net Profit (₱)", "Profit Margin (%)"]
  const rows = Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => [
      date, d.txCount, d.itemsSold,
      d.gross.toFixed(2), d.cog.toFixed(2), d.profit.toFixed(2),
      d.gross > 0 ? ((d.profit / d.gross) * 100).toFixed(1) : "0.0",
    ])
  downloadCSV(buildCSV(headers, rows), `daily-summary_${label}.csv`)
}

function exportProductPerformance(sales: Sale[], label: string) {
  const map = new Map<string, { name: string; qty: number; revenue: number; cog: number; profit: number; txCount: number }>()
  for (const s of sales) {
    for (const item of s.items) {
      const ex = map.get(item.productId)
      const itemProfit = (item.price - item.cost) * item.quantity
      if (ex) { ex.qty += item.quantity; ex.revenue += item.subtotal; ex.cog += item.cost * item.quantity; ex.profit += itemProfit; ex.txCount++ }
      else map.set(item.productId, { name: item.productName, qty: item.quantity, revenue: item.subtotal, cog: item.cost * item.quantity, profit: itemProfit, txCount: 1 })
    }
  }
  const headers = ["Product Name", "Times Sold", "Total Qty Sold", "Total Revenue (₱)", "Total Cost (₱)", "Total Profit (₱)", "Profit Margin (%)"]
  const rows = Array.from(map.values())
    .sort((a, b) => b.qty - a.qty)
    .map(p => [
      p.name, p.txCount, p.qty,
      p.revenue.toFixed(2), p.cog.toFixed(2), p.profit.toFixed(2),
      p.revenue > 0 ? ((p.profit / p.revenue) * 100).toFixed(1) : "0.0",
    ])
  downloadCSV(buildCSV(headers, rows), `product-performance_${label}.csv`)
}

function exportEWallet(txns: EWalletTransaction[], label: string) {
  const headers = [
    "Transaction ID", "Date & Time", "Type", "Provider",
    "Amount (₱)", "Commission Rate (%)", "Commission (₱)", "Profit (₱)",
    "Customer Name", "Customer Number", "Reference #", "Status",
  ]
  const rows = txns.map(t => [
    t.id ?? "", fmtDate(t.createdAt),
    t.type.toUpperCase(), t.provider.toUpperCase(),
    t.amount.toFixed(2), (t.commissionRate * 100).toFixed(2),
    t.commission.toFixed(2), Math.abs(t.profit).toFixed(2),
    t.customerName ?? "", t.customerNumber ?? "",
    t.referenceNumber, t.status,
  ])
  const totalAmt = txns.reduce((s, t) => s + t.amount, 0)
  const totalComm = txns.reduce((s, t) => s + t.commission, 0)
  const totalProfit = txns.reduce((s, t) => s + Math.abs(t.profit), 0)
  rows.push(["", "", "", "TOTAL", totalAmt.toFixed(2), "", totalComm.toFixed(2), totalProfit.toFixed(2), "", "", "", ""])
  downloadCSV(buildCSV(headers, rows), `ewallet-transactions_${label}.csv`)
}

function exportInventorySnapshot(products: Product[], label: string) {
  const headers = [
    "Product Name", "Barcode", "Category", "Unit",
    "Cost Price (₱)", "Selling Price (₱)", "Sale Price (₱)", "On Sale",
    "Stock", "Stock Value (₱)", "Status",
  ]
  const rows = products.map(p => [
    p.name, p.barcode, p.category, p.unit ?? "",
    p.cost.toFixed(2), p.price.toFixed(2),
    p.salePrice ? p.salePrice.toFixed(2) : "",
    p.onSale ? "YES" : "NO",
    p.stock,
    (p.cost * p.stock).toFixed(2),
    p.stock === 0 ? "Out of Stock" : p.stock <= 5 ? "Low Stock" : "In Stock",
  ])
  const totalValue = products.reduce((s, p) => s + p.cost * p.stock, 0)
  rows.push(["", "", "", "", "", "", "", "", "TOTAL VALUE", totalValue.toFixed(2), ""])
  downloadCSV(buildCSV(headers, rows), `inventory-snapshot_${label}.csv`)
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const router = useRouter()
  const { isCashier } = useAuth()
  const { features, tier } = useSubscription()
  const canExport = features.exportData && tier !== "basic"
  const [sales, setSales] = useState<Sale[]>([])
  const [ewalletTransactions, setEWalletTransactions] = useState<EWalletTransaction[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [tobaccoProductIds, setTobaccoProductIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const hasLoaded = useRef(false)
  const productsLoadedRef = useRef(false)
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | undefined>(() => {
    const today = new Date()
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    firstOfMonth.setHours(0, 0, 0, 0)
    const endOfToday = new Date(today)
    endOfToday.setHours(23, 59, 59, 999)
    return { from: firstOfMonth, to: endOfToday }
  })

  useEffect(() => { loadData() }, [dateRange])

  const loadData = async () => {
    if (!hasLoaded.current) setIsLoading(true)
    try {
      const storeId = getStoreId()
      if (!storeId) return

      const params = new URLSearchParams({ storeId })
      if (dateRange?.from) {
        const from = new Date(dateRange.from); from.setHours(0, 0, 0, 0)
        params.set("from", from.toISOString())
      }
      if (dateRange?.to) {
        const to = new Date(dateRange.to); to.setHours(23, 59, 59, 999)
        params.set("to", to.toISOString())
      }

      const [salesRes, ewalletRes] = await Promise.all([
        fetch(`/api/sales?${params}`),
        fetch(`/api/ewallet-transactions?${params}`),
      ])

      const [{ data: salesData }, { data: ewalletData }] = await Promise.all([
        salesRes.json(),
        ewalletRes.json(),
      ])

      setSales(salesData ?? [])
      setEWalletTransactions(ewalletData ?? [])

      if (!productsLoadedRef.current) {
        const prodRes = await fetch(`/api/products?storeId=${storeId}`)
        const { data: productsData } = await prodRes.json()
        setProducts(productsData ?? [])
        productsLoadedRef.current = true
        // Build tobacco product IDs set
        const tobaccoIds = new Set<string>(
          (productsData ?? []).filter((p: any) => {
            const c = (p.category || "").trim().toLowerCase()
            return c === "tobacco" || c === "cigarette" || c === "cigarettes" || c.includes("tobacco") || c.includes("cigarette")
          }).map((p: any) => p.id)
        )
        setTobaccoProductIds(tobaccoIds)
      }
    } catch (error) {
      console.error("[reports] Error loading data:", error)
    } finally {
      hasLoaded.current = true
      setIsLoading(false)
    }
  }

  const calculateStats = () => {
    const activeSales = sales.filter(s => s.status !== "voided")
    const salesGross = activeSales.reduce((sum, s) => sum + s.total, 0)
    const salesProfit = activeSales.reduce((sum, s) =>
      sum + s.items.reduce((p, i) => p + (i.price - i.cost) * i.quantity, 0), 0)
    const ewalletGross = ewalletTransactions.reduce((sum, t) => sum + t.amount, 0)
    const ewalletProfit = ewalletTransactions.reduce((sum, t) => sum + Math.abs(t.profit), 0)
    return {
      totalRevenue: salesGross + ewalletGross,
      totalProfit: salesProfit + ewalletProfit,
      salesRevenue: salesGross, salesProfit,
      ewalletRevenue: ewalletGross, ewalletProfit,
      totalSales: activeSales.length,
      totalEWalletTransactions: ewalletTransactions.length,
    }
  }

  const calculateToday = () => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const activeTodaySales = sales.filter(s => {
      if (s.status === "voided") return false
      const d = new Date(s.createdAt)
      return d >= todayStart
    })
    const todayEwallet = ewalletTransactions.filter(t => {
      const d = new Date(t.createdAt)
      return d >= todayStart
    })
    const gross = activeTodaySales.reduce((sum, s) => sum + s.total, 0)
    const profit = activeTodaySales.reduce((sum, s) =>
      sum + s.items.reduce((p, i) => p + (i.price - i.cost) * i.quantity, 0), 0)
    const txCount = activeTodaySales.length
    const itemsSold = activeTodaySales.reduce((sum, s) => sum + s.items.reduce((n, i) => n + i.quantity, 0), 0)
    const eGross = todayEwallet.reduce((sum, t) => sum + t.amount, 0)
    const eProfit = todayEwallet.reduce((sum, t) => sum + Math.abs(t.profit), 0)
    const topItems = Object.values(
      activeTodaySales.flatMap(s => s.items).reduce((acc, i) => {
        if (!acc[i.productId]) acc[i.productId] = { name: i.productName, qty: 0, revenue: 0 }
        acc[i.productId].qty += i.quantity
        acc[i.productId].revenue += i.subtotal
        return acc
      }, {} as Record<string, { name: string; qty: number; revenue: number }>)
    ).sort((a, b) => b.qty - a.qty).slice(0, 5)
    return { gross, profit, txCount, itemsSold, eGross, eProfit, topItems }
  }

  const stats = calculateStats()
  const today = calculateToday()
  const todayFormatted = new Date().toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })

  const rangeLabel = dateRange
    ? `${dateRange.from.toLocaleDateString("en-CA")}_to_${dateRange.to.toLocaleDateString("en-CA")}`
    : new Date().toLocaleDateString("en-CA")

  return (
    <MobileAppShell
      title="Reports"
      subtitle="Sales & analytics"
      headerAction={
        <div className="flex items-center gap-2">
          <DateRangePicker dateRange={dateRange} setDateRange={setDateRange} />
          {!isCashier && (
            canExport ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 h-9">
                    <Download className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Export</span>
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Sales Reports</div>
                  <DropdownMenuItem
                    disabled={sales.length === 0}
                    onClick={() => exportSalesSummary(sales, rangeLabel)}
                  >
                    <Download className="h-3.5 w-3.5 mr-2" />
                    Sales Summary
                    <span className="ml-auto text-xs text-muted-foreground">{sales.length} tx</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={sales.length === 0}
                    onClick={() => exportSalesLineItems(sales, rangeLabel)}
                  >
                    <Download className="h-3.5 w-3.5 mr-2" />
                    Sales Line Items
                    <span className="ml-auto text-xs text-muted-foreground">per product</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={sales.length === 0}
                    onClick={() => exportDailySummary(sales, rangeLabel)}
                  >
                    <Download className="h-3.5 w-3.5 mr-2" />
                    Daily Breakdown
                    <span className="ml-auto text-xs text-muted-foreground">by day</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={sales.length === 0}
                    onClick={() => exportProductPerformance(sales, rangeLabel)}
                  >
                    <Download className="h-3.5 w-3.5 mr-2" />
                    Product Performance
                    <span className="ml-auto text-xs text-muted-foreground">top sellers</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">E-Wallet & Inventory</div>
                  <DropdownMenuItem
                    disabled={ewalletTransactions.length === 0}
                    onClick={() => exportEWallet(ewalletTransactions, rangeLabel)}
                  >
                    <Download className="h-3.5 w-3.5 mr-2" />
                    E-Wallet Transactions
                    <span className="ml-auto text-xs text-muted-foreground">{ewalletTransactions.length} tx</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={products.length === 0}
                    onClick={() => exportInventorySnapshot(products, new Date().toLocaleDateString("en-CA"))}
                  >
                    <Download className="h-3.5 w-3.5 mr-2" />
                    Inventory Snapshot
                    <span className="ml-auto text-xs text-muted-foreground">{products.length} items</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="outline" size="sm" disabled className="gap-1.5 opacity-60 cursor-not-allowed h-9" title="Upgrade to Gold or Enterprise to export reports">
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Export</span>
                <span className="ml-1 text-[9px] bg-yellow-100 text-yellow-700 px-1 py-0.5 rounded-full font-semibold">PRO</span>
              </Button>
            )
          )}
        </div>
      }
    >
      {/* Mobile View */}
      <div className="md:hidden space-y-4">
        {/* Today's Performance Card */}
        <MobileCard className="p-4 bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-primary rounded-lg">
              <Activity className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-foreground">Today's Performance</div>
              <div className="text-xs text-muted-foreground">{todayFormatted}</div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-background rounded-xl p-3 border">
              <div className="flex items-center gap-1 mb-1">
                <Receipt className="h-3 w-3 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">Gross Sales</span>
              </div>
              <div className="text-[15px] font-bold text-primary truncate">₱{today.gross.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{today.txCount} txn{today.txCount !== 1 ? "s" : ""}</div>
            </div>
            
            <div className="bg-background rounded-xl p-3 border">
              <div className="flex items-center gap-1 mb-1">
                <TrendingUp className="h-3 w-3 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">Net Profit</span>
              </div>
              <div className="text-[15px] font-bold text-green-600 truncate">₱{today.profit.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{today.itemsSold} items sold</div>
            </div>
            
            <div className="bg-background rounded-xl p-3 border">
              <div className="flex items-center gap-1 mb-1">
                <Wallet className="h-3 w-3 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">E-Wallet</span>
              </div>
              <div className="text-[15px] font-bold text-blue-600 truncate">₱{today.eGross.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">₱{today.eProfit.toFixed(2)} comm.</div>
            </div>
            
            <div className="bg-background rounded-xl p-3 border">
              <div className="flex items-center gap-1 mb-1">
                <CircleDollarSign className="h-3 w-3 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">Total Earnings</span>
              </div>
              <div className="text-[15px] font-bold text-orange-600 truncate">₱{(today.profit + today.eProfit).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Sales + E-Wallet</div>
            </div>
          </div>

          {today.topItems.length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Top Selling Today</p>
              <div className="flex flex-wrap gap-2">
                {today.topItems.map((item, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {item.name} × {item.qty}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </MobileCard>

        {/* Period Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <MobileCard className="p-3 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="p-1.5 bg-green-500 rounded-md">
                <ArrowUpRight className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-[11px] text-muted-foreground">Total Revenue</span>
            </div>
            <div className="text-[15px] font-bold text-green-600 truncate">₱{stats.totalRevenue.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Sales + E-Wallet</div>
          </MobileCard>

          <MobileCard className="p-3 bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="p-1.5 bg-emerald-500 rounded-md">
                <TrendingUp className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-[11px] text-muted-foreground">Net Profit</span>
            </div>
            <div className="text-[15px] font-bold text-emerald-600 truncate">₱{stats.totalProfit.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">After cost of goods</div>
          </MobileCard>

          <MobileCard className="p-3 bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="p-1.5 bg-blue-500 rounded-md">
                <ShoppingCart className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-[11px] text-muted-foreground">Sales</span>
            </div>
            <div className="text-[15px] font-bold text-blue-600 truncate">₱{stats.salesRevenue.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="text-[11px] text-green-600 font-medium mt-0.5 truncate">Profit: ₱{stats.salesProfit.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </MobileCard>

          <MobileCard className="p-3 bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="p-1.5 bg-purple-500 rounded-md">
                <Wallet className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-[11px] text-muted-foreground">E-Wallet</span>
            </div>
            <div className="text-[15px] font-bold text-purple-600 truncate">₱{stats.ewalletRevenue.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="text-[11px] text-green-600 font-medium mt-0.5 truncate">Comm: ₱{stats.ewalletProfit.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </MobileCard>
        </div>

        {/* Profit Chart */}
        <div>
          <MobileSectionHeader title="Profit Tracker" />
          <MobileCard>
            <div className="p-4">
              <ProfitChart sales={sales} ewalletTransactions={ewalletTransactions} isLoading={isLoading} tobaccoProductIds={tobaccoProductIds} />
            </div>
          </MobileCard>
        </div>

        {/* Recent Transactions */}
        <div>
          <MobileSectionHeader title="Recent Transactions" />
          <Tabs defaultValue="sales" className="w-full">
            <div className="sticky top-[52px] z-30 bg-background pb-2">
              <TabsList className="w-full grid grid-cols-3 h-10">
                <TabsTrigger value="sales" className="gap-1.5 text-[13px] data-[state=active]:bg-green-500 data-[state=active]:text-white">
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Sales
                </TabsTrigger>
                <TabsTrigger value="ewallet" className="gap-1.5 text-[13px] data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                  <Wallet className="h-3.5 w-3.5" />
                  E-Wallet
                </TabsTrigger>
                <TabsTrigger value="tobacco" className="gap-1.5 text-[13px] data-[state=active]:bg-amber-500 data-[state=active]:text-white">
                  <Cigarette className="h-3.5 w-3.5" />
                  Tobacco
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="sales" className="mt-0">
              <SalesReport sales={sales} isLoading={isLoading} onRefresh={loadData} />
            </TabsContent>
            <TabsContent value="ewallet" className="mt-0">
              <EWalletReport transactions={ewalletTransactions} isLoading={isLoading} />
            </TabsContent>
            <TabsContent value="tobacco" className="mt-0">
              <TobaccoReport dateRange={dateRange} isLoading={isLoading} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Desktop View */}
      <div className="hidden md:block">
        {/* Today's Sales */}
        <Card className="mb-4 border-primary/30 bg-primary/5">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              Today's Sales
              <span className="ml-auto text-xs font-normal text-muted-foreground">{todayFormatted}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-background border p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Receipt className="h-3 w-3" /> Gross Sales</p>
                <p className="text-xl font-bold text-primary">₱{today.gross.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">{today.txCount} transaction{today.txCount !== 1 ? "s" : ""}</p>
              </div>
              <div className="rounded-lg bg-background border p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Net Profit</p>
                <p className="text-xl font-bold text-green-600">₱{today.profit.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">{today.itemsSold} item{today.itemsSold !== 1 ? "s" : ""} sold</p>
              </div>
              <div className="rounded-lg bg-background border p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="h-3 w-3" /> E-Wallet</p>
                <p className="text-xl font-bold text-blue-600">₱{today.eGross.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Commission: ₱{today.eProfit.toFixed(2)}</p>
              </div>
              <div className="rounded-lg bg-background border p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><CircleDollarSign className="h-3 w-3" /> Total Earnings</p>
                <p className="text-xl font-bold text-orange-600">₱{(today.profit + today.eProfit).toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Sales + E-Wallet profit</p>
              </div>
            </div>
            {today.topItems.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Top Selling Today</p>
                <div className="flex flex-wrap gap-2">
                  {today.topItems.map((item, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {item.name} × {item.qty}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {today.txCount === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">No sales recorded today yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="mb-4 grid gap-2 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <BadgeDollarSign className="h-3 w-3" /> Gross Revenue
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-lg font-bold">₱{stats.totalRevenue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Sales + E-Wallet</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Net Profit
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-lg font-bold text-green-600">₱{stats.totalProfit.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">After cost of goods</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <ShoppingCart className="h-3 w-3" /> Sales ({stats.totalSales})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-lg font-bold">₱{stats.salesRevenue.toFixed(2)}</div>
              <p className="text-xs text-green-600 font-semibold">Profit: ₱{stats.salesProfit.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Wallet className="h-3 w-3" /> E-Wallet ({stats.totalEWalletTransactions})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-lg font-bold">₱{stats.ewalletRevenue.toFixed(2)}</div>
              <p className="text-xs text-green-600 font-semibold">Commission: ₱{stats.ewalletProfit.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Profit Chart */}
        <Card className="mb-4">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-sm">Profit Tracker</CardTitle>
            <CardDescription className="text-xs">Daily profit breakdown from sales and e-wallet transactions</CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <ProfitChart sales={sales} ewalletTransactions={ewalletTransactions} isLoading={isLoading} tobaccoProductIds={tobaccoProductIds} />
          </CardContent>
        </Card>

        {/* Detailed Reports */}
        <Tabs defaultValue="sales" className="space-y-4">
          <TabsList>
            <TabsTrigger value="sales" className="gap-2 data-[state=active]:bg-green-500 data-[state=active]:text-white">
              <ShoppingCart className="h-4 w-4" /> Sales Report
            </TabsTrigger>
            <TabsTrigger value="ewallet" className="gap-2 data-[state=active]:bg-blue-500 data-[state=active]:text-white">
              <Wallet className="h-4 w-4" /> E-Wallet Report
            </TabsTrigger>
            <TabsTrigger value="tobacco" className="gap-2 data-[state=active]:bg-amber-500 data-[state=active]:text-white">
              <Cigarette className="h-4 w-4" /> Tobacco Report
            </TabsTrigger>
          </TabsList>
          <TabsContent value="sales">
            <SalesReport sales={sales} isLoading={isLoading} onRefresh={loadData} />
          </TabsContent>
          <TabsContent value="ewallet">
            <EWalletReport transactions={ewalletTransactions} isLoading={isLoading} />
          </TabsContent>
          <TabsContent value="tobacco">
            <TobaccoReport dateRange={dateRange} isLoading={isLoading} />
          </TabsContent>
        </Tabs>
      </div>
    </MobileAppShell>
  )
}
