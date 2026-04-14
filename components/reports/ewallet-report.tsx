"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Wallet, ArrowDownToLine, ArrowUpFromLine, Signal } from "lucide-react"
import type { EWalletTransaction } from "@/lib/firebase/types"
import type { Timestamp } from "firebase/firestore"

interface EWalletReportProps {
  transactions: EWalletTransaction[]
  isLoading: boolean
}

export function EWalletReport({ transactions, isLoading }: EWalletReportProps) {
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

  if (transactions.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">No e-wallet transactions in selected period</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {transactions.map((transaction) => (
            <div key={transaction.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      transaction.type === "cashin" ? "bg-secondary/20" : transaction.type === "load" ? "bg-purple-100" : "bg-primary/20"
                    }`}
                  >
                    {transaction.type === "cashin" ? (
                      <ArrowDownToLine className="h-5 w-5 text-secondary" />
                    ) : transaction.type === "load" ? (
                      <Signal className="h-5 w-5 text-purple-600" />
                    ) : (
                      <ArrowUpFromLine className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={transaction.type === "cashin" ? "default" : "outline"} className="capitalize">
                        {transaction.type}
                      </Badge>
                      <Badge variant="outline" className="uppercase">
                        {transaction.provider}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{formatDate(transaction.createdAt)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg">₱{transaction.amount.toFixed(2)}</div>
                  <div className="text-xs text-secondary font-semibold">Profit: ₱{Math.abs(transaction.profit).toFixed(2)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm border-t pt-3">
                <div>
                  <span className="text-muted-foreground">Commission</span>
                  <div className="font-semibold">₱{transaction.commission.toFixed(2)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Rate</span>
                  <div className="font-semibold">{(transaction.commissionRate * 100).toFixed(2)}%</div>
                </div>
              </div>

              {transaction.customerName && (
                <div className="mt-2 text-xs text-muted-foreground border-t pt-2">
                  Customer: {transaction.customerName} {transaction.customerNumber && `(${transaction.customerNumber})`}
                </div>
              )}

              <div className="mt-1 text-xs text-muted-foreground">Ref: {transaction.referenceNumber}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
