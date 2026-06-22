"use client"

import { FeatureGate } from "@/components/feature-gate"
import { useState, useEffect, useCallback } from "react"
import { AlertTriangle, Plus, Search, PhilippinePeso, QrCode, Clock, CheckCircle2, Trash2, ChevronDown, ChevronUp, User, CreditCard, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { addUtang, getUtangList, addUtangPayment, deleteUtang, searchUtangByName, getUtangPayments } from "@/lib/firebase/services"
import { getStoreSettings } from "@/lib/firebase/services"
import { getStoreId } from "@/lib/store-id"
import type { UtangRecord, UtangPayment } from "@/lib/firebase/types"
import { Timestamp } from "firebase/firestore"
import { MobileAppShell, MobileCard, MobileSectionHeader } from "@/components/mobile-app-shell"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { FloatingActionButton } from "@/components/ui/floating-action-button"

// ── Credit Score ──────────────────────────────────────────────────────────────
function getCreditScore(records: UtangRecord[]): { score: number; label: string; color: string } {
  if (records.length === 0) return { score: 100, label: "No History", color: "text-gray-500" }
  const settled = records.filter(r => r.status === "settled").length
  const total = records.length
  const totalDebt = records.filter(r => r.status !== "settled").reduce((s, r) => s + r.balance, 0)
  let score = Math.round((settled / total) * 100)
  if (totalDebt > 2000) score = Math.max(0, score - 20)
  else if (totalDebt > 1000) score = Math.max(0, score - 10)
  if (score >= 80) return { score, label: "Good", color: "text-green-600" }
  if (score >= 50) return { score, label: "Fair", color: "text-yellow-600" }
  return { score, label: "Poor", color: "text-red-600" }
}

// ── QR Payment Dialog ─────────────────────────────────────────────────────────
function QRPaymentDialog({ utang, onClose }: { utang: UtangRecord; onClose: () => void }) {
  const gcashQR = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`GCash Payment\nTo: Store\nAmount: PHP ${utang.balance.toFixed(2)}\nFor: ${utang.customerName} utang`)}`
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xs text-center">
        <DialogHeader>
          <DialogTitle>QR Payment</DialogTitle>
          <DialogDescription>Customer scans to pay</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Show this to {utang.customerName} to settle ₱{utang.balance.toFixed(2)}</p>
        <img src={gcashQR} alt="QR Code" className="mx-auto rounded-lg border" />
        <p className="text-xs text-muted-foreground">Scan with GCash / Maya</p>
        <Button onClick={onClose}>Close</Button>
      </DialogContent>
    </Dialog>
  )
}

// ── Add Utang Dialog ──────────────────────────────────────────────────────────
function AddUtangDialog({ onClose, onSuccess, storeName, storeId }: { onClose: () => void; onSuccess: () => void; storeName: string; storeId: string }) {
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [amount, setAmount] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [warning, setWarning] = useState<UtangRecord[]>([])
  const { toast } = useToast()

  const checkNetwork = useCallback(async (name: string) => {
    if (name.trim().length < 2) { setWarning([]); return }
    const results = await searchUtangByName(name.trim())
    setWarning(results)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => checkNetwork(customerName), 500)
    return () => clearTimeout(t)
  }, [customerName, checkNetwork])

  const handleSave = async () => {
    if (!customerName.trim() || !amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast({ title: "Invalid input", description: "Enter customer name and valid amount", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const total = Number(amount)
      await addUtang({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        storeId,
        storeName,
        items: [{ productName: notes.trim() || "Credit purchase", quantity: 1, price: total, subtotal: total }],
        totalAmount: total,
        amountPaid: 0,
        balance: total,
        status: "active",
        notes: notes.trim() || undefined,
      })
      toast({ title: "Utang recorded" })
      onSuccess()
      onClose()
    } catch {
      toast({ title: "Error", description: "Failed to save utang", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Customer Name</Label>
        <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Juan dela Cruz" autoFocus />
      </div>
      {warning.length > 0 && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 space-y-1">
          <p className="text-sm font-semibold text-red-700 flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Network Warning</p>
          {warning.map(w => (
            <p key={w.id} className="text-xs text-red-600">⚠ {w.customerName} owes ₱{w.balance.toFixed(2)} at {w.storeName}</p>
          ))}
        </div>
      )}
      <div>
        <Label>Phone (optional)</Label>
        <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="09xxxxxxxxx" />
      </div>
      <div>
        <Label>Amount (₱)</Label>
        <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" min="0" />
      </div>
      <div>
        <Label>Notes / Items</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Rice, Sardines..." rows={2} />
      </div>
      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? "Saving..." : "Save Utang"}
      </Button>
    </div>
  )
}

// ── Pay Dialog ────────────────────────────────────────────────────────────────
function PayDialog({ utang, onClose, onSuccess }: { utang: UtangRecord; onClose: () => void; onSuccess: () => void }) {
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState<"cash" | "gcash" | "maya">("cash")
  const [ref, setRef] = useState("")
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const handlePay = async () => {
    const paid = Number(amount)
    if (!paid || paid <= 0) { toast({ title: "Enter valid amount", variant: "destructive" }); return }
    setSaving(true)
    try {
      const payment: Omit<UtangPayment, "id" | "createdAt"> = {
        utangId: utang.id!,
        customerName: utang.customerName,
        amount: paid,
        method,
        referenceNumber: ref.trim() || undefined,
      }
      await addUtangPayment(payment, utang.id!, utang.balance - paid)
      toast({ title: "Payment recorded", description: `₱${paid.toFixed(2)} received` })
      onSuccess()
      onClose()
    } catch {
      toast({ title: "Error", description: "Failed to record payment", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Record Payment — {utang.customerName}</DialogTitle><DialogDescription>Record a payment against this utang</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Balance: <span className="font-bold text-red-600">₱{utang.balance.toFixed(2)}</span></p>
          <div>
            <Label>Amount Paid (₱)</Label>
            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" autoFocus />
          </div>
          <div>
            <Label>Method</Label>
            <Select value={method} onValueChange={v => setMethod(v as typeof method)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="gcash">GCash</SelectItem>
                <SelectItem value="maya">Maya</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {method !== "cash" && (
            <div>
              <Label>Reference #</Label>
              <Input value={ref} onChange={e => setRef(e.target.value)} placeholder="Optional" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handlePay} disabled={saving}>{saving ? "Saving..." : "Confirm Payment"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Utang Row ─────────────────────────────────────────────────────────────────
function UtangRow({ record, onPay, onQR, onDelete }: { record: UtangRecord; onPay: () => void; onQR: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [payments, setPayments] = useState<UtangPayment[]>([])

  const loadPayments = async () => {
    if (!expanded) {
      const p = await getUtangPayments(record.id!)
      setPayments(p)
    }
    setExpanded(e => !e)
  }

  const statusColor = record.status === "settled" ? "bg-green-100 text-green-700" : record.status === "partial" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
  const createdAt = record.createdAt instanceof Timestamp ? record.createdAt.toDate() : new Date()

  return (
    <MobileCard className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold truncate">{record.customerName}</span>
            <Badge className={`text-xs ${statusColor}`}>{record.status}</Badge>
            {record.customerPhone && <span className="text-xs text-muted-foreground">{record.customerPhone}</span>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{record.storeName} · {createdAt.toLocaleDateString()}</p>
          {record.notes && <p className="text-xs text-muted-foreground truncate">{record.notes}</p>}
        </div>
        <div className="text-right shrink-0">
          <p className="font-bold text-red-600">₱{record.balance.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">of ₱{record.totalAmount.toFixed(2)}</p>
        </div>
      </div>
      <div className="flex gap-1 flex-wrap mt-3">
        {record.status !== "settled" && (
          <>
            <Button size="sm" variant="outline" className="h-8 text-xs text-green-700 border-green-300" onClick={onPay}>
              <PhilippinePeso className="h-4 w-4 mr-1" /> Pay
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onQR}>
              <QrCode className="h-4 w-4 mr-1" /> QR
            </Button>
          </>
        )}
        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={loadPayments}>
          {expanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />} History
        </Button>
        <Button size="sm" variant="ghost" className="h-8 text-xs text-destructive ml-auto" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {expanded && (
        <div className="pt-3 border-t mt-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Payment History</p>
          {payments.length === 0 ? (
            <p className="text-xs text-muted-foreground">No payments yet</p>
          ) : payments.map(p => {
            const pDate = p.createdAt instanceof Timestamp ? p.createdAt.toDate() : new Date()
            return (
              <div key={p.id} className="flex justify-between text-xs bg-muted/30 rounded-lg p-2">
                <span className="text-muted-foreground">{pDate.toLocaleDateString()} · {p.method.toUpperCase()}{p.referenceNumber ? ` #${p.referenceNumber}` : ""}</span>
                <span className="text-green-600 font-medium">+₱{p.amount.toFixed(2)}</span>
              </div>
            )
          })}
        </div>
      )}
    </MobileCard>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function UtangPage() {
  return (
    <FeatureGate feature="utang">
      <UtangPageContent />
    </FeatureGate>
  )
}

function UtangPageContent() {
  const [records, setRecords] = useState<UtangRecord[]>([])
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | "active" | "partial" | "settled">("all")
  const [showAdd, setShowAdd] = useState(false)
  const [payTarget, setPayTarget] = useState<UtangRecord | null>(null)
  const [qrTarget, setQrTarget] = useState<UtangRecord | null>(null)
  const [storeName, setStoreName] = useState("My Store")
  const [storeId, setStoreId] = useState("")
  const { toast } = useToast()

  const load = useCallback(async () => {
    try {
      const data = await getUtangList()
      setRecords(data)
    } catch (e) {
      console.error("Utang load error:", e)
      toast({ title: "Error loading utang records", variant: "destructive" })
    }
  }, [toast])

  useEffect(() => {
    load()
    getStoreSettings().then(s => { if (s?.name) setStoreName(s.name) })
    const sid = getStoreId()
    setStoreId(sid || "default-store")
    // If no storeId set, use a default so data can still be saved/loaded
    if (!sid) {
      localStorage.setItem("pos_ext_id", "default-store")
    }
  }, [load])

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this utang record?")) return
    setRecords(prev => prev.filter(r => r.id !== id))
    try {
      await deleteUtang(id)
      toast({ title: "Deleted" })
    } catch {
      load()
      toast({ title: "Error deleting", variant: "destructive" })
    }
  }

  const filtered = records.filter(r => {
    const matchSearch = !search || r.customerName.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === "all" || r.status === filter
    return matchSearch && matchFilter
  })

  const totalActive = records.filter(r => r.status !== "settled").reduce((s, r) => s + r.balance, 0)
  const activeCount = records.filter(r => r.status !== "settled").length
  const settledCount = records.filter(r => r.status === "settled").length

  // Aggregate per customer for credit scoring
  const customerMap = new Map<string, UtangRecord[]>()
  records.forEach(r => {
    const key = r.customerName.toLowerCase()
    customerMap.set(key, [...(customerMap.get(key) || []), r])
  })

  return (
    <MobileAppShell
      title="Utang"
      subtitle="Credit tracking"
      headerAction={
        <Button size="sm" className="h-9" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline ml-1.5">Add</span>
        </Button>
      }
    >
      {/* Mobile View */}
      <div className="md:hidden space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <MobileCard className="p-3 bg-gradient-to-br from-red-50 to-rose-50 border-red-200">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="p-1.5 bg-red-500 rounded-md">
                <PhilippinePeso className="h-4 w-4 text-white" />
              </div>
              <span className="text-[11px] text-muted-foreground">Total Receivable</span>
            </div>
            <div className="text-[15px] font-bold text-red-600 truncate">₱{totalActive.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="text-xs text-muted-foreground mt-1">{activeCount} active debts</div>
          </MobileCard>

          <MobileCard className="p-3 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="p-1.5 bg-green-500 rounded-md">
                <CheckCircle2 className="h-4 w-4 text-white" />
              </div>
              <span className="text-[11px] text-muted-foreground">Settled</span>
            </div>
            <div className="text-[15px] font-bold text-green-600 truncate">{settledCount}</div>
            <div className="text-xs text-muted-foreground mt-1">fully paid records</div>
          </MobileCard>

          <MobileCard className="p-3 bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="p-1.5 bg-yellow-500 rounded-md">
                <AlertCircle className="h-4 w-4 text-white" />
              </div>
              <span className="text-[11px] text-muted-foreground">Overdue</span>
            </div>
            <div className="text-[15px] font-bold text-yellow-600 truncate">
              {records.filter(r => r.status !== "settled" && r.balance > 500).length}
            </div>
            <div className="text-xs text-muted-foreground mt-1">balances over ₱500</div>
          </MobileCard>

          <MobileCard className="p-3 bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="p-1.5 bg-purple-500 rounded-md">
                <User className="h-4 w-4 text-white" />
              </div>
              <span className="text-[11px] text-muted-foreground">Customers</span>
            </div>
            <div className="text-[15px] font-bold text-purple-600 truncate">{customerMap.size}</div>
            <div className="text-xs text-muted-foreground mt-1">unique customers</div>
          </MobileCard>
        </div>

        {/* Search */}
        <MobileCard className="bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200">
          <div className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search customer..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10 h-12 text-base rounded-xl border-2 border-yellow-300 bg-white"
              />
            </div>
          </div>
        </MobileCard>

        {/* Filter */}
        <Select value={filter} onValueChange={v => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-full h-12 rounded-xl border-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Records</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="settled">Settled</SelectItem>
          </SelectContent>
        </Select>

        {/* Credit Scores */}
        {!search && filter === "all" && customerMap.size > 0 && (
          <div>
            <MobileSectionHeader title="Credit Scores" />
            <MobileCard>
              <div className="p-3 flex gap-2 flex-wrap">
                {Array.from(customerMap.entries()).slice(0, 6).map(([key, recs]) => {
                  const { score, label, color } = getCreditScore(recs)
                  return (
                    <div key={key} className="flex items-center gap-1.5 border rounded-full px-3 py-1.5 text-xs bg-background">
                      <span className="font-medium capitalize">{recs[0].customerName}</span>
                      <span className={`font-bold ${color}`}>{score} · {label}</span>
                    </div>
                  )
                })}
              </div>
            </MobileCard>
          </div>
        )}

        {/* Records List */}
        <div>
          <MobileSectionHeader title={filter === "all" ? "All Records" : filter === "active" ? "Active" : filter === "partial" ? "Partial" : "Settled"} />
          {filtered.length === 0 ? (
            <MobileCard className="p-8 text-center">
              <PhilippinePeso className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-muted-foreground">No utang records found</p>
            </MobileCard>
          ) : (
            <div className="space-y-3">
              {filtered.map(r => (
                <UtangRow
                  key={r.id}
                  record={r}
                  onPay={() => setPayTarget(r)}
                  onQR={() => setQrTarget(r)}
                  onDelete={() => handleDelete(r.id!)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Desktop View */}
      <div className="hidden md:block space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-3 md:grid-cols-3">
          <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-red-200">
            <CardHeader className="flex flex-row items-center justify-between p-3 pb-1">
              <CardTitle className="text-xs font-medium">Total Receivable</CardTitle>
              <PhilippinePeso className="h-3 w-3 text-red-500" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-[15px] font-bold text-red-600 truncate">₱{totalActive.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              <p className="text-xs text-muted-foreground">{activeCount} active debts</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardHeader className="flex flex-row items-center justify-between p-3 pb-1">
              <CardTitle className="text-xs font-medium">Settled</CardTitle>
              <CheckCircle2 className="h-3 w-3 text-green-500" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-[15px] font-bold text-green-600 truncate">{settledCount}</div>
              <p className="text-xs text-muted-foreground">fully paid records</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200">
            <CardHeader className="flex flex-row items-center justify-between p-3 pb-1">
              <CardTitle className="text-xs font-medium">Overdue Reminders</CardTitle>
              <Clock className="h-3 w-3 text-yellow-500" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-[15px] font-bold text-yellow-600 truncate">
                {records.filter(r => r.status !== "settled" && r.balance > 500).length}
              </div>
              <p className="text-xs text-muted-foreground">balances over ₱500</p>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filter */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search customer..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filter} onValueChange={v => setFilter(v as typeof filter)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="settled">Settled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Credit Scores */}
        {!search && filter === "all" && customerMap.size > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Credit Scores</p>
            <div className="flex gap-2 flex-wrap">
              {Array.from(customerMap.entries()).slice(0, 8).map(([key, recs]) => {
                const { score, label, color } = getCreditScore(recs)
                return (
                  <div key={key} className="flex items-center gap-1.5 border rounded-full px-3 py-1 text-xs bg-card">
                    <span className="font-medium capitalize">{recs[0].customerName}</span>
                    <span className={`font-bold ${color}`}>{score} · {label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Records List */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <PhilippinePeso className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No utang records found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(r => (
              <UtangRow
                key={r.id}
                record={r}
                onPay={() => setPayTarget(r)}
                onQR={() => setQrTarget(r)}
                onDelete={() => handleDelete(r.id!)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating Add Button (Mobile) */}
      <FloatingActionButton
        icon={<Plus className="h-7 w-7" />}
        label="Add Utang"
        onClick={() => setShowAdd(true)}
      />

      {/* Add Utang Bottom Sheet (Mobile) */}
      <BottomSheet
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Record Utang"
        description="Add a new credit transaction"
      >
        <div className="pb-20">
          <AddUtangDialog
            onClose={() => setShowAdd(false)}
            onSuccess={load}
            storeName={storeName}
            storeId={storeId}
          />
        </div>
      </BottomSheet>

      {/* Pay Dialog */}
      {payTarget && <PayDialog utang={payTarget} onClose={() => setPayTarget(null)} onSuccess={load} />}
      {/* QR Dialog */}
      {qrTarget && <QRPaymentDialog utang={qrTarget} onClose={() => setQrTarget(null)} />}
    </MobileAppShell>
  )
}