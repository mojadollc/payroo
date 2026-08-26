"use client"

import { useState, useEffect } from "react"
import { Receipt, Plus, Trash2, CheckCircle2, Zap, Wifi, Droplets, Flame, Phone, Tv, Building2, Copy } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { getStoreId } from "@/lib/store-id"
import { Badge } from "@/components/ui/badge"

const XENDIT_OTC = ["CEBUANA", "LBC"]

const BILLERS = [
  { name: "CEBUANA", icon: Building2, color: "bg-yellow-100 text-yellow-700", xendit: true },
  { name: "LBC", icon: Building2, color: "bg-red-100 text-red-700", xendit: true },
  { name: "MERALCO", icon: Zap, color: "bg-yellow-100 text-yellow-700" },
  { name: "GLOBE", icon: Phone, color: "bg-blue-100 text-blue-700" },
  { name: "SMART", icon: Phone, color: "bg-green-100 text-green-700" },
  { name: "PLDT", icon: Wifi, color: "bg-red-100 text-red-700" },
  { name: "MAYNILAD", icon: Droplets, color: "bg-cyan-100 text-cyan-700" },
  { name: "MANILA WATER", icon: Droplets, color: "bg-sky-100 text-sky-700" },
  { name: "CONVERGE", icon: Wifi, color: "bg-purple-100 text-purple-700" },
  { name: "SKY CABLE", icon: Tv, color: "bg-orange-100 text-orange-700" },
  { name: "CIGNAL", icon: Tv, color: "bg-indigo-100 text-indigo-700" },
  { name: "PETRON", icon: Flame, color: "bg-rose-100 text-rose-700" },
  { name: "SSS", icon: Building2, color: "bg-slate-100 text-slate-700" },
  { name: "PHILHEALTH", icon: Building2, color: "bg-emerald-100 text-emerald-700" },
  { name: "PAG-IBIG", icon: Building2, color: "bg-teal-100 text-teal-700" },
  { name: "BIR", icon: Building2, color: "bg-amber-100 text-amber-700" },
]

interface BillPayment {
  id: string
  txnRef: string
  billerName: string
  accountNumber: string
  amount: number
  serviceFee: number
  totalAmount: number
  status: string
  notes?: string
  createdAt: string
  paymentCode?: string | null
}

export default function BillsPage() {
  const { toast } = useToast()
  const [transactions, setTransactions] = useState<BillPayment[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<BillPayment | null>(null)

  const [form, setForm] = useState({
    billerName: "",
    customerName: "",
    accountNumber: "",
    amount: "",
    serviceFee: "",
    notes: "",
  })

  const storeId = getStoreId()
  const isXenditOTC = XENDIT_OTC.includes(form.billerName.toUpperCase())

  const loadTransactions = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/bill-payments?storeId=${storeId}`)
      const { data } = await res.json()
      setTransactions(data ?? [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadTransactions() }, [])

  const amount = parseFloat(form.amount) || 0
  const serviceFee = parseFloat(form.serviceFee) || 0
  const totalAmount = amount + serviceFee

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.billerName) { toast({ title: "Select a biller", variant: "destructive" }); return }
    if (!amount || amount <= 0) { toast({ title: "Enter a valid amount", variant: "destructive" }); return }
    if (isXenditOTC && !form.customerName.trim()) { toast({ title: "Customer name is required for " + form.billerName, variant: "destructive" }); return }

    setSubmitting(true)
    try {
      const res = await fetch("/api/bill-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, ...form, amount, serviceFee }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const { data } = await res.json()
      setSuccess(data)
      setForm({ billerName: "", customerName: "", accountNumber: "", amount: "", serviceFee: "", notes: "" })
      loadTransactions()
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    toast({ title: "Payment code copied!" })
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl pb-24 md:pb-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-blue-100">
          <Receipt className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Pay Bills</h1>
          <p className="text-sm text-muted-foreground">Process bill payments for customers</p>
        </div>
      </div>

      {/* Success receipt */}
      {success && (
        <Card className="mb-6 border-2 border-green-400 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="font-bold text-green-700">
                {success.paymentCode ? "Payment Code Generated!" : "Payment Recorded!"}
              </span>
            </div>

            {/* Xendit OTC payment code highlight */}
            {success.paymentCode && (
              <div className="bg-white border-2 border-yellow-400 rounded-xl p-4 mb-3 text-center">
                <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">
                  {success.billerName} Payment Code
                </p>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-3xl font-extrabold font-mono tracking-widest text-yellow-700">
                    {success.paymentCode}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => copyCode(success.paymentCode!)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Show this code at any {success.billerName} branch to complete payment
                </p>
              </div>
            )}

            <div className="bg-white rounded-lg p-3 space-y-1.5 text-sm font-mono border border-green-200">
              <div className="flex justify-between"><span className="text-muted-foreground">TXN REF</span><span className="font-bold">{success.txnRef}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">BILLER</span><span className="font-bold">{success.billerName}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">ACCOUNT</span><span>{success.accountNumber}</span></div>
              <div className="border-t pt-1.5 mt-1.5">
                <div className="flex justify-between"><span className="text-muted-foreground">AMOUNT</span><span>₱{success.amount.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">SERVICE FEE</span><span>₱{success.serviceFee.toFixed(2)}</span></div>
                <div className="flex justify-between font-bold text-base mt-1"><span>TOTAL</span><span className="text-green-700">₱{success.totalAmount.toFixed(2)}</span></div>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t">
                <span>STATUS</span>
                <Badge variant={success.status === "PENDING" ? "outline" : "default"} className="text-[10px]">
                  {success.status}
                </Badge>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground"><span>DATE</span><span>{new Date(success.createdAt).toLocaleString("en-PH")}</span></div>
            </div>
            <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => setSuccess(null)}>
              <Plus className="h-4 w-4 mr-1" /> New Transaction
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Form */}
      {!success && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">New Bill Payment</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Biller quick select */}
              <div className="space-y-2">
                <Label>Biller Name *</Label>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {BILLERS.map(b => {
                    const Icon = b.icon
                    const selected = form.billerName === b.name
                    return (
                      <button
                        key={b.name}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, billerName: b.name }))}
                        className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 text-xs font-semibold transition-all ${
                          selected ? "border-blue-500 bg-blue-50 text-blue-700" : "border-border hover:border-blue-300"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        {b.name}
                        {b.xendit && (
                          <span className="text-[9px] bg-green-100 text-green-700 px-1 rounded">LIVE</span>
                        )}
                      </button>
                    )
                  })}
                </div>
                <Input
                  placeholder="Or type biller name..."
                  value={form.billerName}
                  onChange={e => setForm(f => ({ ...f, billerName: e.target.value }))}
                />
              </div>

              {/* Customer name — required for Xendit OTC */}
              {isXenditOTC && (
                <div className="space-y-2">
                  <Label>Customer Name * <span className="text-xs text-blue-600">(required for {form.billerName})</span></Label>
                  <Input
                    placeholder="e.g. Juan Dela Cruz"
                    value={form.customerName}
                    onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
                    required
                  />
                </div>
              )}

              {/* Account number */}
              <div className="space-y-2">
                <Label>Account Number <span className="text-muted-foreground text-xs">(auto-generated if empty)</span></Label>
                <Input
                  placeholder="e.g. 1234567890"
                  value={form.accountNumber}
                  onChange={e => setForm(f => ({ ...f, accountNumber: e.target.value }))}
                />
              </div>

              {/* Amount + Service Fee */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Amount to Pay (₱) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Service Fee (₱) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={form.serviceFee}
                    onChange={e => setForm(f => ({ ...f, serviceFee: e.target.value }))}
                    required
                  />
                </div>
              </div>

              {/* Total */}
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-blue-700">Overall Total</span>
                <span className="text-2xl font-extrabold text-blue-700">₱{totalAmount.toFixed(2)}</span>
              </div>

              {isXenditOTC && (
                <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  ✓ A real Xendit payment code will be generated for {form.billerName}. Customer pays at any {form.billerName} branch.
                </p>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input
                  placeholder="e.g. reference, remarks..."
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              <Button type="submit" className="w-full h-12 text-base font-bold" disabled={submitting}>
                {submitting
                  ? isXenditOTC ? "Generating Payment Code..." : "Processing..."
                  : `Confirm Payment · ₱${totalAmount.toFixed(2)}`}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Transaction history */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            Recent Transactions
            <Badge variant="outline">{transactions.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Loading...</div>
          ) : transactions.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No transactions yet</div>
          ) : (
            <div className="divide-y">
              {transactions.map(t => {
                const paymentCode = t.notes?.startsWith("PAYMENT_CODE:")
                  ? t.notes.split("|")[0].replace("PAYMENT_CODE:", "").trim()
                  : null
                return (
                  <div key={t.id} className="px-4 py-3 flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm">{t.billerName}</span>
                        <Badge variant="outline" className="text-[10px] font-mono">{t.txnRef}</Badge>
                        <Badge
                          variant={t.status === "PENDING" ? "outline" : "default"}
                          className="text-[10px]"
                        >
                          {t.status}
                        </Badge>
                      </div>
                      {paymentCode && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-xs font-mono font-bold text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded">
                            {paymentCode}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => copyCode(paymentCode)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Acct: {t.accountNumber} · {new Date(t.createdAt).toLocaleDateString("en-PH")}
                      </div>
                      <div className="text-xs mt-0.5 flex gap-3">
                        <span>Bill: <span className="font-semibold">₱{t.amount.toFixed(2)}</span></span>
                        <span>Fee: <span className="font-semibold text-orange-600">₱{t.serviceFee.toFixed(2)}</span></span>
                        <span>Total: <span className="font-bold text-blue-700">₱{t.totalAmount.toFixed(2)}</span></span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive shrink-0"
                      onClick={async () => {
                        await fetch(`/api/bill-payments?id=${t.id}`, { method: "DELETE" })
                        setTransactions(prev => prev.filter(x => x.id !== t.id))
                        toast({ title: "Transaction deleted" })
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
