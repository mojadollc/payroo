"use client"

import { useState, useEffect } from "react"
import { Cigarette, TrendingUp, Package, DollarSign, Loader2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getStoreId } from "@/lib/store-id"

interface TobaccoRow {
  productId: string
  productName: string
  category: string
  value: number
}

interface CostRow extends TobaccoRow {
  stock: number
  cost: number
}

interface TobaccoData {
  grossIncome: TobaccoRow[]
  netIncome: TobaccoRow[]
  quantitiesSold: TobaccoRow[]
  costCapital: CostRow[]
  totals: { gross: number; net: number; qtySold: number; stockValue: number }
  today: { gross: number; net: number; qtySold: number }
}

interface Props {
  dateRange?: { from: Date; to: Date }
  isLoading?: boolean
}

function fmt(n: number) {
  return n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function ReportTable({ rows, valueLabel, valuePrefix = "₱", emptyMsg }: {
  rows: { productName: string; category: string; value: number }[]
  valueLabel: string
  valuePrefix?: string
  emptyMsg: string
}) {
  if (rows.length === 0) return (
    <div className="flex flex-col items-center justify-center py-10">
      <Cigarette className="h-8 w-8 text-muted-foreground/30 mb-2" />
      <p className="text-sm text-muted-foreground">{emptyMsg}</p>
    </div>
  )
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th className="text-left py-2 pr-3 font-medium">Product</th>
            <th className="text-left py-2 pr-3 font-medium hidden sm:table-cell">Category</th>
            <th className="text-right py-2 font-medium">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
              <td className="py-2 pr-3 font-medium text-[13px]">{r.productName}</td>
              <td className="py-2 pr-3 text-[12px] text-muted-foreground hidden sm:table-cell">{r.category || "—"}</td>
              <td className="py-2 text-right font-semibold text-[13px]">
                {valuePrefix}{valuePrefix === "₱" ? fmt(r.value) : r.value.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CostCapitalTable({ rows }: { rows: CostRow[] }) {
  if (rows.length === 0) return (
    <div className="flex flex-col items-center justify-center py-10">
      <Cigarette className="h-8 w-8 text-muted-foreground/30 mb-2" />
      <p className="text-sm text-muted-foreground">No tobacco products found</p>
    </div>
  )
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th className="text-left py-2 pr-3 font-medium">Product</th>
            <th className="text-right py-2 pr-3 font-medium">Stock</th>
            <th className="text-right py-2 pr-3 font-medium hidden sm:table-cell">Unit Cost</th>
            <th className="text-right py-2 font-medium">Capital Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
              <td className="py-2 pr-3 font-medium text-[13px]">{r.productName}</td>
              <td className="py-2 pr-3 text-right text-[13px]">{r.stock}</td>
              <td className="py-2 pr-3 text-right text-[12px] text-muted-foreground hidden sm:table-cell">₱{fmt(r.cost)}</td>
              <td className="py-2 text-right font-semibold text-[13px]">₱{fmt(r.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function TobaccoReport({ dateRange, isLoading: parentLoading }: Props) {
  const [data, setData] = useState<TobaccoData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const storeId = getStoreId()
    if (!storeId) return
    setLoading(true)
    const params = new URLSearchParams({ storeId })
    if (dateRange?.from) params.set("from", dateRange.from.toISOString())
    if (dateRange?.to) params.set("to", dateRange.to.toISOString())
    fetch(`/api/reports/tobacco?${params}`)
      .then(r => r.json())
      .then(({ data }) => setData(data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [dateRange])

  if (loading || parentLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const totals = data?.totals ?? { gross: 0, net: 0, qtySold: 0, stockValue: 0 }
  // Always use server-computed today — it queries only tobacco saleItems directly
  const today  = data?.today  ?? { gross: 0, net: 0, qtySold: 0 }

  return (
    <div className="space-y-4">
      {/* Today cards */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Today's Tobacco Sales</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border bg-gradient-to-br from-primary/10 to-primary/5 p-3">
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1">
              <DollarSign className="h-3 w-3" /> Gross Income
            </p>
            <p className="text-[15px] font-bold text-primary">₱{fmt(today.gross)}</p>
          </div>
          <div className="rounded-xl border bg-gradient-to-br from-green-50 to-emerald-50 p-3">
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1">
              <TrendingUp className="h-3 w-3" /> Net Income
            </p>
            <p className="text-[15px] font-bold text-green-600">₱{fmt(today.net)}</p>
          </div>
          <div className="rounded-xl border bg-gradient-to-br from-blue-50 to-cyan-50 p-3">
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1">
              <Cigarette className="h-3 w-3" /> Qty Sold
            </p>
            <p className="text-[15px] font-bold text-blue-600">{today.qtySold.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Period summary cards */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Selected Period</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border bg-card p-3">
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1">
              <DollarSign className="h-3 w-3" /> Gross Income
            </p>
            <p className="text-[15px] font-bold text-primary">₱{fmt(totals.gross)}</p>
          </div>
          <div className="rounded-xl border bg-card p-3">
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1">
              <TrendingUp className="h-3 w-3" /> Net Income
            </p>
            <p className="text-[15px] font-bold text-green-600">₱{fmt(totals.net)}</p>
          </div>
          <div className="rounded-xl border bg-card p-3">
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1">
              <Cigarette className="h-3 w-3" /> Qty Sold
            </p>
            <p className="text-[15px] font-bold text-blue-600">{totals.qtySold.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border bg-card p-3">
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1">
              <Package className="h-3 w-3" /> Stock Capital
            </p>
            <p className="text-[15px] font-bold text-orange-600">₱{fmt(totals.stockValue)}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="gross">
        <TabsList className="w-full grid grid-cols-4 h-9">
          <TabsTrigger value="gross" className="text-[11px]">Gross</TabsTrigger>
          <TabsTrigger value="net" className="text-[11px]">Net</TabsTrigger>
          <TabsTrigger value="qty" className="text-[11px]">Quantities</TabsTrigger>
          <TabsTrigger value="capital" className="text-[11px]">Capital</TabsTrigger>
        </TabsList>

        <TabsContent value="gross" className="mt-3">
          <p className="text-xs text-muted-foreground mb-2">Gross income per tobacco product</p>
          <ReportTable rows={data?.grossIncome ?? []} valueLabel="Gross (₱)" emptyMsg="No tobacco sales in selected period" />
        </TabsContent>
        <TabsContent value="net" className="mt-3">
          <p className="text-xs text-muted-foreground mb-2">Net income (after cost) per product</p>
          <ReportTable rows={data?.netIncome ?? []} valueLabel="Net (₱)" emptyMsg="No tobacco sales in selected period" />
        </TabsContent>
        <TabsContent value="qty" className="mt-3">
          <p className="text-xs text-muted-foreground mb-2">Units sold per tobacco product</p>
          <ReportTable rows={data?.quantitiesSold ?? []} valueLabel="Qty Sold" valuePrefix="" emptyMsg="No tobacco sales in selected period" />
        </TabsContent>
        <TabsContent value="capital" className="mt-3">
          <p className="text-xs text-muted-foreground mb-2">Current stock × cost price</p>
          <CostCapitalTable rows={data?.costCapital ?? []} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
