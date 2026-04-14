"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ShoppingCart, Clock } from "lucide-react"
import type { Sale } from "@/lib/firebase/types"
import type { Timestamp } from "firebase/firestore"

interface SalesReportProps {
  sales: Sale[]
  isLoading: boolean
}

export function SalesReport({ sales, isLoading }: SalesReportProps) {
  const formatDate = (timestamp: Timestamp) => {
    const date = timestamp.toDate()
    return new Intl.DateTimeFormat("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
            ))}
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

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {sales.map((sale) => (
            <div key={sale.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="default">{sale.items.length} items</Badge>
                    <Badge variant="outline" className="capitalize">
                      {sale.paymentMethod}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDate(sale.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg">₱{sale.total.toFixed(2)}</div>
                  <div className="text-xs text-secondary font-semibold">Profit: ₱{sale.profit.toFixed(2)}</div>
                </div>
              </div>

              <div className="space-y-2">
                {sale.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm border-t pt-2">
                    <div>
                      <span className="font-medium">{item.productName}</span>
                      <span className="text-muted-foreground ml-2">x{item.quantity}</span>
                    </div>
                    <span className="font-semibold">₱{item.subtotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
