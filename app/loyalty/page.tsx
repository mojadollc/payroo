"use client"

import { FeatureGate } from "@/components/feature-gate"
import { useState, useEffect, useCallback } from "react"
import { QrCode, Plus, Coins, Gift, Settings2, Trash2, Users, ChevronDown, ChevronUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import {
  getLoyaltyCustomers, createLoyaltyCustomer, getLoyaltyRules, saveLoyaltyRule,
  deleteLoyaltyRule, getLoyaltySettings, saveLoyaltySettings, getLoyaltyTransactions,
  redeemLoyaltyCoins,
} from "@/lib/firebase/services"
import { getProducts } from "@/lib/firebase/services"
import type { LoyaltyCustomer, LoyaltyRule, LoyaltySettings, LoyaltyTransaction } from "@/lib/firebase/types"
import type { Product } from "@/lib/firebase/types"
import { Timestamp } from "firebase/firestore"

// ── QR Display ────────────────────────────────────────────────────────────────
function CustomerQRDialog({ customer, onClose }: { customer: LoyaltyCustomer; onClose: () => void }) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(customer.qrCode)}`
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xs text-center">
        <DialogHeader><DialogTitle>Loyalty QR — {customer.name}</DialogTitle><DialogDescription>Scan this QR at checkout to earn coins</DialogDescription></DialogHeader>
        <img src={qrUrl} alt="QR" className="mx-auto rounded-lg border" />
        <p className="text-xs text-muted-foreground break-all">{customer.qrCode}</p>
        <div className="flex justify-center gap-4 text-sm">
          <span className="font-bold text-yellow-600">🪙 {customer.coins} coins</span>
          <span className="text-muted-foreground">Min redeem: 100</span>
        </div>
        <Button onClick={onClose}>Close</Button>
      </DialogContent>
    </Dialog>
  )
}

// ── Add Customer Dialog ───────────────────────────────────────────────────────
function AddCustomerDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const handleSave = async () => {
    if (!name.trim()) { toast({ title: "Enter customer name", variant: "destructive" }); return }
    setSaving(true)
    try {
      await createLoyaltyCustomer(name.trim(), phone.trim() || undefined)
      toast({ title: "Customer enrolled!" })
      onSuccess()
      onClose()
    } catch {
      toast({ title: "Error enrolling customer", variant: "destructive" })
    } finally { setSaving(false) }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Enroll Customer</DialogTitle><DialogDescription>Add a new loyalty member</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Juan dela Cruz" autoFocus /></div>
          <div><Label>Phone (optional)</Label><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="09xxxxxxxxx" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Enroll"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Redeem Dialog ─────────────────────────────────────────────────────────────
function RedeemDialog({ customer, settings, onClose, onSuccess }: {
  customer: LoyaltyCustomer; settings: LoyaltySettings; onClose: () => void; onSuccess: () => void
}) {
  const [coins, setCoins] = useState(String(settings.minRedeemCoins))
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()
  const coinsNum = Number(coins)
  const discount = coinsNum * settings.coinValuePeso
  const canRedeem = coinsNum >= settings.minRedeemCoins && coinsNum <= customer.coins

  const handleRedeem = async () => {
    if (!canRedeem) return
    setSaving(true)
    try {
      await redeemLoyaltyCoins(customer.id!, customer.name, coinsNum)
      toast({ title: `Redeemed ${coinsNum} coins`, description: `₱${discount.toFixed(2)} discount applied` })
      onSuccess()
      onClose()
    } catch (e: any) {
      toast({ title: e.message || "Redeem failed", variant: "destructive" })
    } finally { setSaving(false) }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Redeem Coins — {customer.name}</DialogTitle><DialogDescription>Convert loyalty coins to discount</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm">Available: <span className="font-bold text-yellow-600">🪙 {customer.coins} coins</span></p>
          <p className="text-xs text-muted-foreground">Min. {settings.minRedeemCoins} coins · 1 coin = ₱{settings.coinValuePeso}</p>
          <div><Label>Coins to Redeem</Label>
            <Input type="number" value={coins} onChange={e => setCoins(e.target.value)} min={settings.minRedeemCoins} max={customer.coins} />
          </div>
          {coinsNum > 0 && (
            <div className={`rounded-lg p-3 text-sm ${canRedeem ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
              {canRedeem
                ? <span className="text-green-700 font-semibold">Discount: ₱{discount.toFixed(2)}</span>
                : <span className="text-red-600">{coinsNum < settings.minRedeemCoins ? `Min. ${settings.minRedeemCoins} coins required` : "Not enough coins"}</span>
              }
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleRedeem} disabled={!canRedeem || saving}>{saving ? "Processing..." : "Redeem"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Customer Row ──────────────────────────────────────────────────────────────
function CustomerRow({ customer, settings, onQR, onRedeem, onRefresh }: {
  customer: LoyaltyCustomer; settings: LoyaltySettings
  onQR: () => void; onRedeem: () => void; onRefresh: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [txs, setTxs] = useState<LoyaltyTransaction[]>([])

  const loadTxs = async () => {
    if (!expanded) { const t = await getLoyaltyTransactions(customer.id!); setTxs(t) }
    setExpanded(e => !e)
  }

  const tier = customer.totalEarned >= 500 ? { label: "Gold", color: "bg-yellow-100 text-yellow-700" }
    : customer.totalEarned >= 200 ? { label: "Silver", color: "bg-gray-100 text-gray-600" }
    : { label: "Bronze", color: "bg-orange-100 text-orange-700" }

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{customer.name}</span>
            <Badge className={`text-xs ${tier.color}`}>{tier.label}</Badge>
            {customer.phone && <span className="text-xs text-muted-foreground">{customer.phone}</span>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Earned: {customer.totalEarned} · Redeemed: {customer.totalRedeemed}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-bold text-yellow-600 text-lg">🪙 {customer.coins}</p>
          <p className="text-xs text-muted-foreground">coins</p>
        </div>
      </div>
      <div className="flex gap-1 flex-wrap">
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onQR}>
          <QrCode className="h-4 w-4 mr-1" /> QR
        </Button>
        {customer.coins >= settings.minRedeemCoins && (
          <Button size="sm" variant="outline" className="h-7 text-xs text-green-700 border-green-300" onClick={onRedeem}>
            <Gift className="h-4 w-4 mr-1" /> Redeem
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={loadTxs}>
          {expanded ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />} History
        </Button>
      </div>
      {expanded && (
        <div className="pt-1 border-t space-y-1">
          {txs.length === 0 ? <p className="text-xs text-muted-foreground">No transactions yet</p>
            : txs.slice(0, 10).map(tx => {
              const d = tx.createdAt instanceof Timestamp ? tx.createdAt.toDate() : new Date()
              return (
                <div key={tx.id} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{d.toLocaleDateString()} · {tx.type}</span>
                  <span className={tx.type === "earn" ? "text-yellow-600 font-medium" : "text-red-500 font-medium"}>
                    {tx.type === "earn" ? "+" : "-"}{tx.coins} 🪙
                  </span>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}

// ── Rules Tab ─────────────────────────────────────────────────────────────────
function RulesTab({ products }: { products: Product[] }) {
  const [rules, setRules] = useState<LoyaltyRule[]>([])
  const [selectedProductId, setSelectedProductId] = useState("")
  const [buyQty, setBuyQty] = useState("5")
  const [earnCoins, setEarnCoins] = useState("1")
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const loadRules = useCallback(async () => {
    setRules(await getLoyaltyRules())
  }, [])

  useEffect(() => { loadRules() }, [loadRules])

  const handleSave = async () => {
    const product = products.find(p => p.id === selectedProductId)
    if (!product || !buyQty || !earnCoins) { toast({ title: "Fill all fields", variant: "destructive" }); return }
    setSaving(true)
    try {
      await saveLoyaltyRule({ productId: product.id!, productName: product.name, buyQty: Number(buyQty), earnCoins: Number(earnCoins) })
      toast({ title: "Rule saved" })
      setSelectedProductId(""); setBuyQty("5"); setEarnCoins("1")
      loadRules()
    } catch { toast({ title: "Error saving rule", variant: "destructive" }) }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    await deleteLoyaltyRule(id)
    loadRules()
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-4 space-y-3">
        <p className="text-sm font-semibold">Add / Update Rule</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs">Product</Label>
            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
              <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
              <SelectContent>
                {products.map(p => <SelectItem key={p.id} value={p.id!}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Buy Qty</Label>
            <Input type="number" value={buyQty} onChange={e => setBuyQty(e.target.value)} min="1" placeholder="5" />
          </div>
          <div>
            <Label className="text-xs">Earn Coins</Label>
            <Input type="number" value={earnCoins} onChange={e => setEarnCoins(e.target.value)} min="1" placeholder="1" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {selectedProductId && buyQty && earnCoins
            ? `Buy ${buyQty}x ${products.find(p => p.id === selectedProductId)?.name} → earn ${earnCoins} coin(s)`
            : "e.g. Buy 5 Noodles → earn 1 coin"}
        </p>
        <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Rule"}</Button>
      </div>

      {rules.length === 0
        ? <p className="text-sm text-muted-foreground text-center py-8">No rules yet. Add one above.</p>
        : <div className="space-y-2">
          {rules.map(r => (
            <div key={r.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
              <span className="text-sm">Buy <strong>{r.buyQty}x</strong> {r.productName} → <strong className="text-yellow-600">🪙 {r.earnCoins}</strong></span>
              <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => handleDelete(r.id!)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      }
    </div>
  )
}

// ── Settings Tab ──────────────────────────────────────────────────────────────
function SettingsTab() {
  const [minCoins, setMinCoins] = useState("100")
  const [coinValue, setCoinValue] = useState("1")
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    getLoyaltySettings().then(s => { setMinCoins(String(s.minRedeemCoins)); setCoinValue(String(s.coinValuePeso)) })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveLoyaltySettings({ minRedeemCoins: Number(minCoins), coinValuePeso: Number(coinValue) })
      toast({ title: "Settings saved" })
    } catch { toast({ title: "Error saving settings", variant: "destructive" }) }
    finally { setSaving(false) }
  }

  return (
    <div className="border rounded-lg p-4 space-y-4 max-w-sm">
      <div>
        <Label>Minimum coins to redeem</Label>
        <Input type="number" value={minCoins} onChange={e => setMinCoins(e.target.value)} min="1" />
        <p className="text-xs text-muted-foreground mt-1">Customer needs at least this many coins to redeem</p>
      </div>
      <div>
        <Label>1 coin = ₱ value</Label>
        <Input type="number" value={coinValue} onChange={e => setCoinValue(e.target.value)} min="0.01" step="0.01" />
        <p className="text-xs text-muted-foreground mt-1">Peso discount per coin when redeeming</p>
      </div>
      <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Settings"}</Button>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LoyaltyPage() {
  return (
    <FeatureGate feature="loyalty">
      <LoyaltyPageContent />
    </FeatureGate>
  )
}

function LoyaltyPageContent() {
  const [customers, setCustomers] = useState<LoyaltyCustomer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [settings, setSettings] = useState<LoyaltySettings>({ minRedeemCoins: 100, coinValuePeso: 1 } as LoyaltySettings)
  const [search, setSearch] = useState("")
  const [showAdd, setShowAdd] = useState(false)
  const [qrTarget, setQrTarget] = useState<LoyaltyCustomer | null>(null)
  const [redeemTarget, setRedeemTarget] = useState<LoyaltyCustomer | null>(null)
  const { toast } = useToast()

  const load = useCallback(async () => {
    try {
      const [c, s, p] = await Promise.all([getLoyaltyCustomers(), getLoyaltySettings(), getProducts()])
      setCustomers(c); setSettings(s); setProducts(p)
    } catch { toast({ title: "Error loading data", variant: "destructive" }) }
  }, [toast])

  useEffect(() => { load() }, [load])

  const filtered = customers.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()))
  const totalCoinsOutstanding = customers.reduce((s, c) => s + c.coins, 0)
  const totalRedeemed = customers.reduce((s, c) => s + c.totalRedeemed, 0)

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Loyalty</h1>
            <p className="text-sm text-muted-foreground mt-0.5">QR rewards program</p>
          </div>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Enroll
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-3 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1">
            <CardTitle className="text-xs font-medium">Enrolled Customers</CardTitle>
            <Users className="h-3 w-3 text-blue-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-blue-600">{customers.length}</div>
            <p className="text-xs text-muted-foreground">loyalty members</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1">
            <CardTitle className="text-xs font-medium">Coins Outstanding</CardTitle>
            <Coins className="h-3 w-3 text-yellow-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-yellow-600">🪙 {totalCoinsOutstanding}</div>
            <p className="text-xs text-muted-foreground">≈ ₱{(totalCoinsOutstanding * settings.coinValuePeso).toFixed(2)} value</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1">
            <CardTitle className="text-xs font-medium">Total Redeemed</CardTitle>
            <Gift className="h-3 w-3 text-green-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-green-600">🪙 {totalRedeemed}</div>
            <p className="text-xs text-muted-foreground">coins used by customers</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="customers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="rules">Earn Rules</TabsTrigger>
          <TabsTrigger value="settings"><Settings2 className="h-4 w-4 mr-1" />Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="customers" className="space-y-3">
          <Input placeholder="Search customer..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
          {filtered.length === 0
            ? <div className="text-center py-16 text-muted-foreground"><QrCode className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>No customers enrolled yet</p></div>
            : filtered.map(c => (
              <CustomerRow
                key={c.id} customer={c} settings={settings}
                onQR={() => setQrTarget(c)}
                onRedeem={() => setRedeemTarget(c)}
                onRefresh={load}
              />
            ))
          }
        </TabsContent>

        <TabsContent value="rules">
          <RulesTab products={products} />
        </TabsContent>

        <TabsContent value="settings">
          <SettingsTab />
        </TabsContent>
      </Tabs>

      {showAdd && <AddCustomerDialog onClose={() => setShowAdd(false)} onSuccess={load} />}
      {qrTarget && <CustomerQRDialog customer={qrTarget} onClose={() => setQrTarget(null)} />}
      {redeemTarget && <RedeemDialog customer={redeemTarget} settings={settings} onClose={() => setRedeemTarget(null)} onSuccess={load} />}
    </div>
  )
}
