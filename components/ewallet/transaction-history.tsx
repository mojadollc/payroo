"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowDownToLine, ArrowUpFromLine, Clock, Signal, Smartphone, Trash2 } from "lucide-react"
import type { EWalletTransaction } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"

interface TransactionHistoryProps {
  transactions: EWalletTransaction[]
  cashinTransactions: any[]
  isLoading: boolean
  onRefresh?: () => void
  /** Optional: show a Load more control when history is date-limited */
  hasMore?: boolean
  onLoadMore?: () => void
  isLoadingMore?: boolean
  emptyHint?: string
}

function fmtDate(timestamp: any) {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp)
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

export function TransactionHistory({
  transactions,
  cashinTransactions,
  isLoading,
  onRefresh,
  hasMore,
  onLoadMore,
  isLoadingMore,
  emptyHint,
}: TransactionHistoryProps) {
  const { toast } = useToast()

  const handleDeleteManual = async (id: string) => {
    if (!confirm("Delete this transaction? This cannot be undone.")) return
    try {
      const res = await fetch(`/api/ewallet-transactions?id=${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed")
      toast({ title: "Transaction deleted" })
      onRefresh?.()
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" })
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (transactions.length === 0 && cashinTransactions.length === 0) {
    return (
      <div className="py-12 text-center">
        <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">{emptyHint || "No transactions yet"}</p>
      </div>
    )
  }

  type Row =
    | { kind: "manual"; data: EWalletTransaction; date: Date }
    | { kind: "kiosk"; data: any; date: Date }

  const rows: Row[] = [
    ...transactions.map(t => ({
      kind: "manual" as const,
      data: t,
      date: t.createdAt ? new Date(t.createdAt as any) : new Date(0),
    })),
    ...cashinTransactions.map(t => ({
      kind: "kiosk" as const,
      data: t,
      date: t.createdAt ? new Date(t.createdAt) : new Date(0),
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime())

  return (
    <div className="space-y-3 max-h-[600px] overflow-y-auto">
      {rows.map(row => {
        if (row.kind === "manual") {
          const t = row.data
          return (
            <div key={t.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      t.type === "cashin"
                        ? "bg-secondary/20"
                        : t.type === "load"
                          ? "bg-purple-100"
                          : "bg-primary/20"
                    }`}
                  >
                    {t.type === "cashin" ? (
                      <ArrowDownToLine className="h-5 w-5 text-secondary" />
                    ) : t.type === "load" ? (
                      <Signal className="h-5 w-5 text-purple-600" />
                    ) : (
                      <ArrowUpFromLine className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={t.type === "cashin" ? "default" : "outline"} className="capitalize">
                        {t.type}
                      </Badge>
                      {t.type !== "load" && (
                        <Badge variant="outline" className="uppercase">
                          {t.provider}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{fmtDate(t.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="text-right">
                    <div className="font-bold text-lg">₱{t.amount.toFixed(2)}</div>
                    <div className="text-xs text-secondary font-semibold">
                      +₱{Math.abs(t.profit).toFixed(2)} commission
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                    onClick={() => handleDeleteManual(t.id!)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {(t.customerName || t.customerNumber) && (
                <div className="mb-2 text-sm">
                  {t.customerName && (
                    <div className="text-muted-foreground">
                      <span className="font-medium">Customer:</span> {t.customerName}
                    </div>
                  )}
                  {t.customerNumber && (
                    <div className="text-muted-foreground">
                      <span className="font-medium">Number:</span> {t.customerNumber}
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Ref: {t.referenceNumber}</span>
                <span className="text-muted-foreground">Rate: {(t.commissionRate * 100).toFixed(2)}%</span>
              </div>
            </div>
          )
        }

        const k = row.data
        const sellerEarning = k.sellerEarning ?? k.fee ?? 0
        const statusColor =
          k.status === "COMPLETED"
            ? "bg-green-100 text-green-700"
            : k.status === "PENDING"
              ? "bg-yellow-100 text-yellow-700"
              : k.status === "FAILED"
                ? "bg-red-100 text-red-700"
                : "bg-gray-100 text-gray-500"

        return (
          <div key={k.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full flex items-center justify-center bg-blue-100">
                  <Smartphone className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-blue-600 text-white">Kiosk Cash-In</Badge>
                    <Badge variant="outline" className="uppercase">
                      {k.channel}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{fmtDate(k.createdAt)}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-lg">
                  ₱{(k.amountInserted ?? k.amount ?? 0).toLocaleString()}
                </div>
                <div className="text-xs text-secondary font-semibold">+₱{sellerEarning} your commission</div>
              </div>
            </div>
            {(k.accountName || k.accountNumber) && (
              <div className="mb-2 text-sm">
                {k.accountName && (
                  <div className="text-muted-foreground">
                    <span className="font-medium">Customer:</span> {k.accountName}
                  </div>
                )}
                {k.accountNumber && (
                  <div className="text-muted-foreground">
                    <span className="font-medium">Account:</span> {k.accountNumber}
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Sent: ₱{(k.sendAmount ?? 0).toLocaleString()}</span>
              <span className={`px-2 py-0.5 rounded-full font-medium ${statusColor}`}>{k.status}</span>
            </div>
          </div>
        )
      })}

      {hasMore && onLoadMore && (
        <div className="pt-2 pb-4 flex justify-center">
          <Button variant="outline" size="sm" onClick={onLoadMore} disabled={isLoadingMore}>
            {isLoadingMore ? "Loading..." : "Load older transactions"}
          </Button>
        </div>
      )}
    </div>
  )
}
