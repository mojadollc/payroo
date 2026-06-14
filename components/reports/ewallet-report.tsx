"use client"

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
    const d = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp as any)
    return new Intl.DateTimeFormat("en-PH", {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    }).format(d)
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Wallet className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">No e-wallet transactions in selected period</p>
      </div>
    )
  }

  // Show only today's transactions as "Recent"
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const recentTxns = transactions.filter(t => {
    const d = t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt as any)
    return d >= today
  })

  const totalProfit = recentTxns.reduce((s, t) => s + Math.abs(t.profit), 0)

  return (
    <>
      {/* Summary bar */}
      <div className="flex items-center justify-between px-1 mb-3">
        <span className="text-[12px] font-medium">Today's Transactions</span>
        <span className="text-[11px] text-muted-foreground">{recentTxns.length} txn{recentTxns.length !== 1 ? "s" : ""}</span>
      </div>

      {recentTxns.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-[13px] text-muted-foreground">No e-wallet transactions today yet</p>
        </div>
      ) : (
      <div className="space-y-2 -mx-1 px-1">
        {recentTxns.map(txn => {
          const icon = txn.type === "cashin"
            ? <ArrowDownToLine className="h-4 w-4 text-green-600" />
            : txn.type === "load"
            ? <Signal className="h-4 w-4 text-purple-600" />
            : <ArrowUpFromLine className="h-4 w-4 text-blue-600" />
          const iconBg = txn.type === "cashin" ? "bg-green-100" : txn.type === "load" ? "bg-purple-100" : "bg-blue-100"

          return (
            <div key={txn.id} className="rounded-xl border bg-card">
              {/* Header row */}
              <div className="flex items-center gap-3 p-3">
                <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
                  {icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-semibold capitalize">{txn.type}</span>
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 uppercase">
                      {txn.provider}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {formatDate(txn.createdAt)}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-[15px] font-bold">₱{txn.amount.toFixed(2)}</div>
                  <div className="text-[11px] font-medium text-green-600">+₱{Math.abs(txn.profit).toFixed(2)}</div>
                </div>
              </div>

              {/* Details - always visible */}
              <div className="px-3 pb-2.5 space-y-0.5">
                <div className="flex justify-between text-[12px]">
                  <span className="text-muted-foreground">Commission</span>
                  <span className="font-medium text-green-600">₱{txn.commission.toFixed(2)} ({(txn.commissionRate * 100).toFixed(1)}%)</span>
                </div>
                {txn.customerName && (
                  <div className="flex justify-between text-[12px]">
                    <span className="text-muted-foreground">Customer</span>
                    <span className="font-medium truncate ml-4">{txn.customerName}</span>
                  </div>
                )}
                {txn.customerNumber && (
                  <div className="flex justify-between text-[12px]">
                    <span className="text-muted-foreground">Number</span>
                    <span className="font-mono text-[11px]">{txn.customerNumber}</span>
                  </div>
                )}
                <div className="flex justify-between text-[12px]">
                  <span className="text-muted-foreground">Ref#</span>
                  <span className="font-mono text-[11px] text-muted-foreground">{txn.referenceNumber}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      )}

      {/* Footer */}
      {recentTxns.length > 0 && (
        <div className="flex items-center justify-between pt-3 mt-3 border-t text-[12px] text-muted-foreground px-1">
          <span>Today's volume: ₱{recentTxns.reduce((s, t) => s + t.amount, 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
          <span className="font-semibold text-green-600">
            Profit: ₱{totalProfit.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
          </span>
        </div>
      )}
    </>
  )
}
