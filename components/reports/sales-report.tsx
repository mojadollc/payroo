"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ShoppingCart, Clock, Ban, Loader2 } from "lucide-react"
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

  const formatDate = (timestamp: Timestamp) => {
    return new Intl.DateTimeFormat("en-PH", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(timestamp.toDate())
  }

  const handleVoid = async () => {
    if (!voidTarget?.id) return
    setVoidingId(voidTarget.id)
    setVoidTarget(null)
    try {
      await voidSale(voidTarget.id)
      toast({
        title: "Sale voided",
        description: `₱${voidTarget.total.toFixed(2)} reversed — stock restored for ${voidTarget.items.length} item(s).`,
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
      <Card>
        <CardContent className="p-6">
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />)}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (sales.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">No sales in selected period</p>
        </CardContent>
      </Card>
    )
  }

  const activeSales = sales.filter(s => s.status !== "voided")
  const voidedSales = sales.filter(s => s.status === "voided")

  return (
    <>
      <Card>
        <CardContent className="p-6">
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {sales.map(sale => {
              const isVoided = sale.status === "voided"
              const isVoiding = voidingId === sale.id
              return (
                <div
                  key={sale.id}
                  className={`border rounded-lg p-4 transition-colors ${
                    isVoided
                      ? "bg-muted/40 border-muted opacity-60"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant={isVoided ? "secondary" : "default"}>
                          {sale.items.length} item{sale.items.length !== 1 ? "s" : ""}
                        </Badge>
                        <Badge variant="outline" className="capitalize">
                          {sale.paymentMethod}
                        </Badge>
                        {isVoided && (
                          <Badge variant="destructive" className="gap-1">
                            <Ban className="h-3 w-3" /> VOIDED
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(sale.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="text-right">
                        <div className={`font-bold text-lg ${isVoided ? "line-through text-muted-foreground" : ""}`}>
                          ₱{sale.total.toFixed(2)}
                        </div>
                        <div className={`text-xs font-semibold ${isVoided ? "line-through text-muted-foreground" : "text-secondary"}`}>
                          Profit: ₱{sale.profit.toFixed(2)}
                        </div>
                      </div>
                      {/* Void button — owner only, only on active sales */}
                      {isOwner && !isVoided && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 shrink-0"
                          disabled={isVoiding}
                          onClick={() => setVoidTarget(sale)}
                        >
                          {isVoiding
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Ban className="h-3.5 w-3.5" />
                          }
                          Void
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {sale.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm border-t pt-2">
                        <div>
                          <span className={`font-medium ${isVoided ? "line-through text-muted-foreground" : ""}`}>
                            {item.productName}
                          </span>
                          <span className="text-muted-foreground ml-2">x{item.quantity}</span>
                        </div>
                        <span className={`font-semibold ${isVoided ? "line-through text-muted-foreground" : ""}`}>
                          ₱{item.subtotal.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Summary footer */}
          {voidedSales.length > 0 && (
            <div className="mt-4 pt-3 border-t text-xs text-muted-foreground flex justify-between">
              <span>{activeSales.length} active · {voidedSales.length} voided</span>
              <span>
                Active total: ₱{activeSales.reduce((s, x) => s + x.total, 0).toFixed(2)}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Void confirmation dialog */}
      <AlertDialog open={!!voidTarget} onOpenChange={open => { if (!open) setVoidTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Ban className="h-5 w-5" /> Void This Sale?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>This will permanently mark the sale as <strong>VOIDED</strong> and:</p>
                <ul className="text-sm list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Remove it from your profit & revenue totals</li>
                  <li>Restore the sold quantities back to inventory</li>
                  <li>Log a reversal entry in inventory history</li>
                </ul>
                {voidTarget && (
                  <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount</span>
                      <span className="font-bold">₱{voidTarget.total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Items</span>
                      <span>{voidTarget.items.map(i => `${i.productName} ×${i.quantity}`).join(", ")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Payment</span>
                      <span className="capitalize">{voidTarget.paymentMethod}</span>
                    </div>
                  </div>
                )}
                <p className="text-xs text-destructive font-medium">⚠️ This action cannot be undone.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleVoid}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              Yes, Void Sale
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
