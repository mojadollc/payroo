"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ShoppingCart, Clock, Ban, Loader2, ChevronDown, ChevronUp } from "lucide-react"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { voidSale } from "@/lib/firebase/services"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import type { Sale } from "@/lib/firebase/types"
import type { Timestamp } from "firebase/firestore"

interface SalesReportProps {
  sales: Sale[]
  isLoading: boolean
  onRefresh?: () => void
}

export function SalesReport({ sales, isLoading, onRefresh }: SalesReportProps) {
  const { toast } = useToast()
  const { isOwner } = useAuth()
  const [voidTarget, setVoidTarget] = useState<Sale | null>(null)
  const [voidingId, setVoidingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const formatDate = (timestamp: Timestamp) => {
    const d = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp as any)
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
      await voidSale(voidTarget.id)
      toast({
        title: "Sale voided",
        description: `₱${voidTarget.total.toFixed(2)} reversed — stock restored.`,
      })
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
  const voidedSales = sales.filter(s => s.status === "voided")

  return (
    <>
      {/* Summary bar */}
      <div className="flex items-center justify-between px-1 mb-3">
        <span className="text-xs text-muted-foreground">{sales.length} transaction{sales.length !== 1 ? "s" : ""}</span>
        {voidedSales.length > 0 && (
          <span className="text-xs text-muted-foreground">{voidedSales.length} voided</span>
        )}
      </div>

      {/* Sale cards */}
      <div className="space-y-2 max-h-[60vh] overflow-y-auto -mx-1 px-1">
        {sales.map(sale => {
          const isVoided = sale.status === "voided"
          const isVoiding = voidingId === sale.id
          const isExpanded = expandedId === sale.id
          const totalQty = sale.items.reduce((sum, i) => sum + i.quantity, 0)

          return (
            <div
              key={sale.id}
              className={`rounded-xl border transition-all ${
                isVoided ? "bg-muted/30 opacity-60" : "bg-card active:scale-[0.99]"
              }`}
            >
              {/* Header row - always visible */}
              <div
                className="flex items-center gap-3 p-3 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : sale.id!)}
              >
                {/* Left: payment icon */}
                <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                  sale.paymentMethod === "cash" ? "bg-green-100" :
                  sale.paymentMethod === "gcash" ? "bg-blue-100" :
                  "bg-purple-100"
                }`}>
                  <span className="text-xs font-bold uppercase">
                    {sale.paymentMethod === "cash" ? "₱" : sale.paymentMethod.charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Middle: info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[13px] font-semibold">
                      {totalQty} item{totalQty !== 1 ? "s" : ""}
                    </span>
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 capitalize">
                      {sale.paymentMethod}
                    </Badge>
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

                {/* Right: amount + expand */}
                <div className="text-right shrink-0">
                  <div className={`text-[15px] font-bold ${isVoided ? "line-through text-muted-foreground" : ""}`}>
                    ₱{sale.total.toFixed(2)}
                  </div>
                  <div className={`text-[11px] font-medium ${isVoided ? "line-through text-muted-foreground" : "text-green-600"}`}>
                    +₱{sale.profit.toFixed(2)}
                  </div>
                </div>

                <div className="shrink-0">
                  {isExpanded
                    ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  }
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-3 pb-3 border-t mx-3 pt-2 space-y-1.5">
                  {sale.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-[13px]">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-muted-foreground w-5 text-right shrink-0">{item.quantity}×</span>
                        <span className={`truncate ${isVoided ? "line-through text-muted-foreground" : ""}`}>
                          {item.productName}
                        </span>
                      </div>
                      <span className={`font-medium shrink-0 ml-2 ${isVoided ? "line-through text-muted-foreground" : ""}`}>
                        ₱{item.subtotal.toFixed(2)}
                      </span>
                    </div>
                  ))}

                  {/* Void button */}
                  {isOwner && !isVoided && (
                    <div className="pt-2 border-t mt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-full text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
                        disabled={isVoiding}
                        onClick={(e) => { e.stopPropagation(); setVoidTarget(sale) }}
                      >
                        {isVoiding
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Ban className="h-3.5 w-3.5" />
                        }
                        Void Sale
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer summary */}
      {activeSales.length > 0 && (
        <div className="flex items-center justify-between pt-3 mt-3 border-t text-[12px] text-muted-foreground px-1">
          <span>Active: {activeSales.length} sales</span>
          <span className="font-semibold text-foreground">
            Total: ₱{activeSales.reduce((s, x) => s + x.total, 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
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
                      <span className="text-right text-[12px]">{voidTarget.items.map(i => `${i.productName} ×${i.quantity}`).join(", ")}</span>
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
