"use client"

import { useState, useEffect } from "react"
import { Clock, TrendingUp, TrendingDown, Package } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import type { Product, InventoryTransaction } from "@/lib/firebase/types"
import { getStoreId } from "@/lib/store-id"

interface InventoryHistoryDialogProps {
  product: Product
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InventoryHistoryDialog({ product, open, onOpenChange }: InventoryHistoryDialogProps) {
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (open) {
      loadHistory()
    }
  }, [open, product.id])

  const loadHistory = async () => {
    setIsLoading(true)
    try {
      const storeId = getStoreId()
      const res = await fetch(`/api/inventory-transactions?storeId=${storeId}&productId=${product.id}`)
      const { data } = await res.json()
      setTransactions(data ?? [])
    } catch (error) {
      console.error("[v0] Error loading inventory history:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (timestamp: string | Date) => {
    return new Intl.DateTimeFormat("en-PH", {
      month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
    }).format(new Date(timestamp))
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "restock":
        return <TrendingUp className="h-4 w-4 text-secondary" />
      case "sale":
        return <TrendingDown className="h-4 w-4 text-destructive" />
      default:
        return <Package className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "restock":
        return "default"
      case "sale":
        return "destructive"
      default:
        return "outline"
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Inventory History</DialogTitle>
          <DialogDescription>Transaction history for {product.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[500px] overflow-y-auto">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-12 text-center">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">No transaction history available</p>
            </div>
          ) : (
            transactions.map((transaction) => (
              <div key={transaction.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getTypeIcon(transaction.type)}
                    <Badge variant={getTypeColor(transaction.type) as any}>{transaction.type}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDate(transaction.createdAt)}</span>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm mb-2">
                  <div>
                    <div className="text-muted-foreground text-xs">Previous</div>
                    <div className="font-semibold">{transaction.previousStock}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Change</div>
                    <div
                      className={`font-semibold ${transaction.quantity > 0 ? "text-secondary" : "text-destructive"}`}
                    >
                      {transaction.quantity > 0 ? "+" : ""}
                      {transaction.quantity}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">New Stock</div>
                    <div className="font-semibold">{transaction.newStock}</div>
                  </div>
                </div>

                {transaction.notes && <p className="text-xs text-muted-foreground mt-2 italic">{transaction.notes}</p>}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
