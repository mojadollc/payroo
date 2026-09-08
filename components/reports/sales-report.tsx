"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ShoppingCart, Clock, Ban, Loader2, Package, TrendingUp, ArrowUpDown } from "lucide-react"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import type { Sale } from "@/lib/firebase/types"

interface SalesReportProps {
  sales: Sale[]
  isLoading: boolean
  onRefresh?: () => void
}

type SortKey = "qty" | "revenue" | "profit"

// ── Exported so the reports page can render it as a first-class tab ────────────
export function ProductBreakdown({ sales, isLoading }: { sales: Sale[]; isLoading?: boolean }) {
  const [sort, setSort] = useState<SortKey>("qty")

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
      </div>
    )
  }

  const activeSales = sales.filter(s => s.status !== "voided")

  const productMap = new Map<string, {
    name: string; qty: number; revenue: number; profit: number; txCount: number
  }>()

  for (const sale of activeSales) {
    for (const item of sale.items) {
      const key = item.productId || item.productName
      const itemProfit = (item.price - item.cost) * item.quantity
      const ex = productMap.get(key)
      if (ex) {
        ex.qty += item.quantity
        ex.revenue += item.subtotal
        ex.profit += itemProfit
        ex.txCount++
      } else {
        productMap.set(key, { name: item.productName, qty: item.quantity, revenue: item.subtotal, profit: itemProfit, txCount: 1 })
      }
    }
  }

  const products = Array.from(productMap.values()).sort((a, b) => b[sort] - a[sort])
  const totalQty = products.reduce((s, p) => s + p.qty, 0)
  const totalRevenue = products.reduce((s, p) => s + p.revenue, 0)

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Package className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">No products sold in this period</p>
      </div>
    )
  }

  const sortButtons: { key: SortKey; label: string }[] = [
    { key: "qty", label: "Qty" },
    { key: "revenue", label: "Revenue" },
    { key: "profit", label: "Profit" },
  ]

  return (
    <div className="space-y-3">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-center">
          <p className="text-[11px] text-muted-foreground">Products</p>
          <p className="text-[17px] font-bold text-blue-700">{products.length}</p>
        </div>
        <div className="rounded-xl bg-green-50 border border-green-100 p-3 text-center">
          <p className="text-[11px] text-muted-foreground">Units Sold</p>
          <p className="text-[17px] font-bold text-green-700">{totalQty.toLocaleString()}</p>
        </div>
        <div className="rounded-xl bg-purple-50 border border-purple-100 p-3 text-center">
          <p className="text-[11px] text-muted-foreground">Revenue</p>
          <p className="text-[15px] font-bold text-purple-700">
            ₱{totalRevenue.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      {/* Sort toggle */}
      <div className="flex items-center gap-1.5">
        <ArrowUpDown className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="text-[11px] text-muted-foreground mr-1">Sort by:</span>
        {sortButtons.map(b => (
          <button
            key={b.key}
            onClick={() => setSort(b.key)}
            className={`text-[11px] px-2.5 py-1 rounded-full font-semibold transition-all ${
              sort === b.key ? "bg-amber-900 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      {/* Product list */}
      <div className="space-y-2">
        {products.map((p, i) => {
          const revenueShare = totalRevenue > 0 ? (p.revenue / totalRevenue) * 100 : 0
          const margin = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0
          return (
            <div key={i} className="rounded-xl border bg-card p-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[11px] font-bold text-muted-foreground/60 w-5 shrink-0">#{i + 1}</span>
                  <span className="text-[13px] font-semibold truncate">{p.name}</span>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[14px] font-bold">
                    ₱{p.revenue.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] text-green-600 font-medium">
                    +₱{p.profit.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
              <div className="h-1.5 bg-muted rounded-full mb-2 overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${revenueShare}%` }} />
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span><span className="font-semibold text-foreground">{p.qty}</span> units</span>
                <span>·</span>
                <span><span className="font-semibold text-foreground">{p.txCount}</span> txns</span>
                <span>·</span>
                <span className={`font-semibold ${margin >= 20 ? "text-green-600" : margin >= 10 ? "text-amber-600" : "text-red-500"}`}>
                  {margin.toFixed(1)}% margin
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── SalesReport — transactions only ───────────────────────────────────────────
export function SalesReport({ sales, isLoading, onRefresh }: SalesReportProps) {
  const { toast } = useToast()
  const { isOwner } = useAuth()
  const [voidTarget, setVoidTarget] = useState<Sale | null>(null)
  const [voidingId, setVoidingId] = useState<string | null>(null)

  const formatDate = (timestamp: any) => {
    const d = new Date(timestamp)
    return new Intl.DateTimeFormat("en-PH", {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    }).format(d)
  }

  const handleVoid = async () => {
    if (!voidTarget?.id) return
    setVoidingId(voidTarget.id)
    setVoidTarget(null)
    try {
      const res = await fetch("/api/sales", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: voidTarget.id, status: "voided" }),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Failed to void")
      toast({ title: "Sale voided", description: `₱${voidTarget.total.toFixed(2)} reversed — stock restored.` })
      onRefresh?.()
    } catch (err: any) {
      toast({ title: "Failed to void sale", description: err.message, variant: "destructive" })
    } finally {
      setVoidingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
      </div>
    )
  }

  if (sales.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <ShoppingCart className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">No sales in selected period</p>
      </div>
    )
  }

  const activeSales = sales.filter(s => s.status !== "voided")
  const totalGross = activeSales.reduce((s, x) => s + x.total, 0)
  const totalProfit = activeSales.reduce((s, x) => s + x.profit, 0)

  return (
    <>
      {/* Period summary */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-xl bg-green-50 border border-green-100 p-3">
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <ShoppingCart className="h-3 w-3" /> Gross Sales
          </p>
          <p className="text-[17px] font-bold text-green-700">
            ₱{totalGross.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-muted-foreground">{activeSales.length} active txns</p>
        </div>
        <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> Net Profit
          </p>
          <p className="text-[17px] font-bold text-emerald-700">
            ₱{totalProfit.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {totalGross > 0 ? ((totalProfit / totalGross) * 100).toFixed(1) : "0.0"}% margin
          </p>
        </div>
      </div>

      {/* Transaction list */}
      <div className="space-y-2">
        {sales.map(sale => {
          const isVoided = sale.status === "voided"
          const isVoiding = voidingId === sale.id
          const totalQty = sale.items.reduce((sum, i) => sum + i.quantity, 0)

          return (
            <div
              key={sale.id}
              className={`rounded-xl border transition-all ${isVoided ? "bg-muted/30 opacity-60" : "bg-card"}`}
            >
              <div className="flex items-center gap-3 p-3">
                <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                  sale.paymentMethod === "cash" ? "bg-green-100" :
                  sale.paymentMethod === "gcash" ? "bg-blue-100" :
                  sale.paymentMethod === "utang" ? "bg-red-100" : "bg-purple-100"
                }`}>
                  <span className="text-xs font-bold uppercase">
                    {sale.paymentMethod === "cash" ? "₱" :
                     sale.paymentMethod === "utang" ? "U" :
                     sale.paymentMethod.charAt(0).toUpperCase()}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[13px] font-semibold">{totalQty} item{totalQty !== 1 ? "s" : ""}</span>
                    <Badge variant="outline" className={`text-[10px] h-4 px-1.5 capitalize ${
                      sale.paymentMethod === "utang" ? "border-red-300 text-red-600 bg-red-50" : ""
                    }`}>
                      {sale.paymentMethod === "utang" ? "Utang" : sale.paymentMethod}
                    </Badge>
                    {(sale as any).utangCustomerName && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-orange-300 text-orange-700 bg-orange-50">
                        👤 {(sale as any).utangCustomerName}
                      </Badge>
                    )}
                    {isVoided && (
                      <Badge variant="destructive" className="text-[10px] h-4 px-1.5 gap-0.5">
                        <Ban className="h-2.5 w-2.5" /> Void
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3" />
                    {formatDate(sale.createdAt)}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <div className={`text-[15px] font-bold ${isVoided ? "line-through text-muted-foreground" : ""}`}>
                    ₱{sale.total.toFixed(2)}
                  </div>
                  <div className={`text-[11px] font-medium ${isVoided ? "line-through text-muted-foreground" : "text-green-600"}`}>
                    +₱{sale.profit.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="px-3 pb-2 space-y-0.5">
                {sale.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[12px]">
                    <span className="text-muted-foreground truncate flex-1">{item.quantity}× {item.productName}</span>
                    <span className={`font-medium shrink-0 ml-2 ${isVoided ? "line-through text-muted-foreground" : ""}`}>
                      ₱{item.subtotal.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {isOwner && !isVoided && (
                <div className="px-3 pb-2">
                  <Button
                    variant="ghost" size="sm"
                    className="h-7 w-full text-[11px] text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
                    disabled={isVoiding}
                    onClick={(e) => { e.stopPropagation(); setVoidTarget(sale) }}
                  >
                    {isVoiding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ban className="h-3 w-3" />}
                    Void
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      {activeSales.length > 0 && (
        <div className="flex items-center justify-between pt-3 mt-2 border-t text-[12px] text-muted-foreground px-1">
          <span>Active: {activeSales.length} · Voided: {sales.length - activeSales.length}</span>
          <span className="font-semibold text-foreground">
            Gross: ₱{totalGross.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
          </span>
        </div>
      )}

      {/* Void confirmation */}
      <AlertDialog open={!!voidTarget} onOpenChange={open => { if (!open) setVoidTarget(null) }}>
        <AlertDialogContent className="max-w-sm mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive text-[15px]">
              <Ban className="h-4 w-4" /> Void This Sale?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p className="text-[13px]">This will reverse the sale and restore inventory stock.</p>
                {voidTarget && (
                  <div className="rounded-lg bg-muted p-3 space-y-1.5 text-[13px]">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount</span>
                      <span className="font-bold">₱{voidTarget.total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Items</span>
                      <span className="text-right text-[12px]">
                        {voidTarget.items.map(i => `${i.productName} ×${i.quantity}`).join(", ")}
                      </span>
                    </div>
                  </div>
                )}
                <p className="text-[11px] text-destructive font-medium">⚠️ This action cannot be undone.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="h-10">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleVoid} className="h-10 bg-destructive hover:bg-destructive/90 text-white">
              Void Sale
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
