"use client"

import { useState, useRef, useEffect } from "react"
import { CreditCard, Wallet, Banknote, Check, Printer, HandCoins, AlertTriangle, QrCode, Star, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { addSale, addUtang, searchUtangByName, getStoreSettings, getLoyaltyCustomerByQR, getLoyaltyRules, getLoyaltySettings, earnLoyaltyCoins } from "@/lib/firebase/services"
import { enqueueOfflineSale, enqueueOfflineUtang, isOnline } from "@/lib/offline-sync"
import { offlineAddSale, offlineAddUtang } from "@/lib/offline/services"
import type { Product, UtangRecord, LoyaltyCustomer } from "@/lib/firebase/types"
import { useToast } from "@/hooks/use-toast"

interface CartItem extends Product {
  quantity: number
  subtotal: number
}

interface CheckoutDialogProps {
  cart: CartItem[]
  total: number
  profit: number
  onClose: () => void
  onSuccess: () => void
}

export function CheckoutDialog({ cart, total, profit, onClose, onSuccess }: CheckoutDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "gcash" | "maya" | "utang">("cash")
  const [amountReceived, setAmountReceived] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [saleComplete, setSaleComplete] = useState(false)
  const [saleSnapshot, setSaleSnapshot] = useState<{ cart: CartItem[]; total: number; change: number; paymentMethod: string } | null>(null)
  const [utangCustomer, setUtangCustomer] = useState("")
  const [utangWarnings, setUtangWarnings] = useState<UtangRecord[]>([])
  const [utangChecked, setUtangChecked] = useState(false)
  // Loyalty
  const [loyaltyStep, setLoyaltyStep] = useState(false)
  const [loyaltyQR, setLoyaltyQR] = useState("")
  const [loyaltyCustomer, setLoyaltyCustomer] = useState<LoyaltyCustomer | null>(null)
  const [loyaltyCoinsEarned, setLoyaltyCoinsEarned] = useState(0)
  const [loyaltyLookingUp, setLoyaltyLookingUp] = useState(false)
  const [loyaltyDone, setLoyaltyDone] = useState(false)
  const { toast } = useToast()
  // Pre-fetch store settings when dialog opens so checkout doesn't wait
  const storeSettingsRef = useRef<{ name: string; address: string; phone?: string; businessType?: string; region?: string; province?: string; city?: string; barangay?: string } | null>(null)
  useEffect(() => {
    getStoreSettings().then(s => { storeSettingsRef.current = s }).catch(() => {})
  }, [])

  const checkUtangNetwork = async (name: string) => {
    if (name.trim().length < 2) { setUtangWarnings([]); setUtangChecked(false); return }
    const results = await searchUtangByName(name.trim())
    setUtangWarnings(results)
    setUtangChecked(true)
  }

  const change = Number.parseFloat(amountReceived) - total
  const isValidPayment = Number.parseFloat(amountReceived) >= total

  const handleCheckout = async () => {
    if (!isValidPayment) {
      toast({
        title: "Insufficient amount",
        description: "Amount received must be greater than or equal to total",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)

    try {
      if (paymentMethod === "utang") {
        if (!utangCustomer.trim()) {
          toast({ title: "Enter customer name for utang", variant: "destructive" })
          setIsProcessing(false)
          return
        }

        if (!isOnline()) {
          // Queue utang offline (both legacy localStorage + IndexedDB)
          const storeId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "unknown-store"
          const storeName = localStorage.getItem("storeName") || "My Store"
          enqueueOfflineUtang({
            customerName: utangCustomer.trim(),
            storeId,
            storeName,
            items: cart.map(item => ({ productName: item.name, quantity: item.quantity, price: item.price, subtotal: item.subtotal })),
            totalAmount: total,
          })
          offlineAddUtang({
            customerName: utangCustomer.trim(),
            storeId,
            storeName,
            items: cart.map(item => ({ productName: item.name, quantity: item.quantity, price: item.price, subtotal: item.subtotal })),
            totalAmount: total,
            amountPaid: 0,
            balance: total,
            status: "active",
          })
          toast({ title: "📴 Utang saved offline", description: "Will sync when internet returns" })
          setSaleSnapshot({ cart: [...cart], total, change: 0, paymentMethod: "utang" })
          onSuccess()
          setSaleComplete(true)
          return
        }

        const storeSettings = storeSettingsRef.current
        const storeName = storeSettings?.name || "My Store"
        const storeId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "unknown-store"

        // Optimistic UI — show success immediately
        const utangPayload = {
          customerName: utangCustomer.trim(),
          storeId,
          storeName,
          items: cart.map(item => ({ productName: item.name, quantity: item.quantity, price: item.price, subtotal: item.subtotal })),
          totalAmount: total,
          amountPaid: 0,
          balance: total,
          status: "active" as const,
        }
        setSaleSnapshot({ cart: [...cart], total, change: 0, paymentMethod: "utang" })
        onSuccess()
        setSaleComplete(true)
        setIsProcessing(false)

        // Fire-and-forget
        addUtang(utangPayload).catch((error) => {
          console.error("[checkout] Background utang write failed:", error)
          toast({ title: "⚠️ Utang may not have saved", description: "Check your connection", variant: "destructive" })
        })
        return
      }

      // ── Regular sale (cash / gcash / maya) ──
      if (!isOnline()) {
        // Queue sale offline (both legacy localStorage + IndexedDB)
        enqueueOfflineSale({
          items: cart.map(item => ({
            productId: item.id!,
            productName: item.name,
            quantity: item.quantity,
            price: item.price,
            cost: item.cost,
            subtotal: item.subtotal,
          })),
          total,
          profit,
          paymentMethod: paymentMethod as "cash" | "gcash" | "maya",
        })
        offlineAddSale({
          items: cart.map(item => ({
            productId: item.id!,
            productName: item.name,
            quantity: item.quantity,
            price: item.price,
            cost: item.cost,
            subtotal: item.subtotal,
          })),
          total,
          profit,
          paymentMethod: paymentMethod as "cash" | "gcash" | "maya",
          status: "completed",
        })
        toast({ title: "📴 Sale saved offline", description: "Will sync when internet returns" })
        setSaleSnapshot({ cart: [...cart], total, change, paymentMethod })
        onSuccess()
        setSaleComplete(true)
        setLoyaltyStep(false) // skip loyalty when offline
        return
      }

      // Use pre-fetched store settings (already loaded when dialog opened)
      const storeSettings = storeSettingsRef.current
      const storeLocation = storeSettings?.city && storeSettings?.region
        ? {
            region: storeSettings.region,
            province: storeSettings.province ?? "",
            city: storeSettings.city,
            barangay: storeSettings.barangay ?? "",
            businessType: storeSettings.businessType ?? "retail",
          }
        : undefined

      // Optimistic UI — show success immediately, write to Firestore in background
      const snap = { cart: [...cart], total, change, paymentMethod }
      const salePayload = {
        items: cart.map((item) => ({
          productId: item.id!,
          productName: item.name,
          quantity: item.quantity,
          price: item.price,
          cost: item.cost,
          subtotal: item.subtotal,
        })),
        total,
        profit,
        paymentMethod: paymentMethod as "cash" | "gcash" | "maya",
        status: "completed" as const,
      }

      setSaleSnapshot(snap)
      onSuccess()
      setSaleComplete(true)
      setLoyaltyStep(true)
      setIsProcessing(false)

      // Fire-and-forget Firestore write in background
      addSale(salePayload, storeLocation).catch((error) => {
        console.error("[checkout] Background sale write failed:", error)
        toast({ title: "⚠️ Sale may not have saved", description: "Check your connection and verify in reports", variant: "destructive" })
      })
      return
    } catch (error) {
      console.error("[v0] Error processing sale:", error)
      toast({
        title: "Error",
        description: "Failed to process sale",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleLoyaltyLookup = async () => {
    if (!loyaltyQR.trim()) return
    setLoyaltyLookingUp(true)
    try {
      const customer = await getLoyaltyCustomerByQR(loyaltyQR.trim())
      if (!customer) { toast({ title: "QR not found", description: "Customer not enrolled", variant: "destructive" }); setLoyaltyLookingUp(false); return }
      // Calculate coins earned from rules
      const [rules] = await Promise.all([getLoyaltyRules()])
      let totalCoins = 0
      const saleItems: { productName: string; quantity: number; coinsEarned: number }[] = []
      for (const item of cart) {
        const rule = rules.find(r => r.productId === item.id)
        if (rule) {
          const coins = Math.floor(item.quantity / rule.buyQty) * rule.earnCoins
          if (coins > 0) { totalCoins += coins; saleItems.push({ productName: item.name, quantity: item.quantity, coinsEarned: coins }) }
        }
      }
      setLoyaltyCustomer(customer)
      setLoyaltyCoinsEarned(totalCoins)
    } catch { toast({ title: "Error looking up customer", variant: "destructive" }) }
    finally { setLoyaltyLookingUp(false) }
  }

  const handleAwardCoins = async () => {
    if (!loyaltyCustomer || loyaltyCoinsEarned === 0) { setLoyaltyDone(true); return }
    try {
      const saleItems = cart.map(item => ({ productName: item.name, quantity: item.quantity, coinsEarned: 0 }))
      await earnLoyaltyCoins(loyaltyCustomer.id!, loyaltyCustomer.name, loyaltyCoinsEarned, saleItems, total)
      toast({ title: `🪙 +${loyaltyCoinsEarned} coins awarded to ${loyaltyCustomer.name}!` })
    } catch { toast({ title: "Error awarding coins", variant: "destructive" }) }
    setLoyaltyDone(true)
  }

  // Loyalty step shown after sale completes
  if (saleComplete && saleSnapshot && loyaltyStep && !loyaltyDone) {
    return (
      <Dialog open onOpenChange={() => { setLoyaltyDone(true) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-yellow-600">
              <Star className="h-5 w-5" /> Loyalty Rewards
            </DialogTitle>
            <DialogDescription>Award loyalty coins for this purchase</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Does the customer have a loyalty QR card?</p>
            {!loyaltyCustomer ? (
              <>
                <div className="flex gap-2">
                  <Input
                    placeholder="Scan or type QR code..."
                    value={loyaltyQR}
                    onChange={e => setLoyaltyQR(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleLoyaltyLookup()}
                    autoFocus
                  />
                  <Button onClick={handleLoyaltyLookup} disabled={loyaltyLookingUp} size="sm">
                    <QrCode className="h-4 w-4" />
                  </Button>
                </div>
                <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setLoyaltyDone(true)}>
                  <X className="h-4 w-4 mr-1" /> Skip
                </Button>
              </>
            ) : (
              <>
                <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 space-y-1">
                  <p className="font-semibold">{loyaltyCustomer.name}</p>
                  <p className="text-sm text-muted-foreground">Current coins: 🪙 {loyaltyCustomer.coins}</p>
                  {loyaltyCoinsEarned > 0
                    ? <p className="text-sm font-bold text-yellow-700">+{loyaltyCoinsEarned} coins from this purchase!</p>
                    : <p className="text-sm text-muted-foreground">No qualifying items for coins this purchase.</p>
                  }
                </div>
                <Button className="w-full" onClick={handleAwardCoins}>
                  {loyaltyCoinsEarned > 0 ? `Award 🪙 ${loyaltyCoinsEarned} Coins` : "Done"}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  const handlePrintReceipt = async () => {
    const snap = saleSnapshot!
    const storeSettings = await getStoreSettings()
    const storeName = storeSettings?.name || "My Store"
    const storeAddress = storeSettings?.address || ""
    const storePhone = storeSettings?.phone || ""
    const date = new Date().toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })

    const itemRows = snap.cart.map(item => {
      const name = item.name.length > 16 ? item.name.substring(0, 15) + "." : item.name
      return `<tr>
        <td class="item-name">${name}</td>
        <td class="item-qty">${item.quantity}</td>
        <td class="item-total">&#8369;${item.subtotal.toFixed(2)}</td>
      </tr>
      <tr><td class="item-price" colspan="3">  @ &#8369;${item.price.toFixed(2)} each</td></tr>`
    }).join("")

    const win = window.open("", "_blank", "width=300,height=600")
    if (!win) return
    win.document.write(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>Receipt</title>
<style>
  @page {
    size: 58mm auto;
    margin: 0;
  }
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  html, body {
    width: 58mm;
    margin: 0 auto;
    padding: 2mm 2mm 4mm 2mm;
    font-family: 'Courier New', Courier, monospace;
    font-size: 9pt;
    color: #000;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .center { text-align: center; }
  .right  { text-align: right; }
  .bold   { font-weight: bold; }
  .store-name {
    font-size: 11pt;
    font-weight: bold;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 1mm;
  }
  .store-info {
    font-size: 7.5pt;
    text-align: center;
    margin: 0.5mm 0;
  }
  .divider {
    border: none;
    border-top: 1px dashed #000;
    margin: 1.5mm 0;
    width: 100%;
  }
  .meta {
    font-size: 7.5pt;
    margin: 0.5mm 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  .item-name {
    font-size: 8.5pt;
    width: 48%;
    padding: 0.5mm 0 0 0;
    word-break: break-word;
  }
  .item-qty {
    font-size: 8.5pt;
    width: 12%;
    text-align: center;
    padding: 0.5mm 0 0 0;
  }
  .item-total {
    font-size: 8.5pt;
    width: 40%;
    text-align: right;
    padding: 0.5mm 0 0 0;
  }
  .item-price {
    font-size: 7.5pt;
    color: #444;
    padding-bottom: 0.5mm;
  }
  .summary-row td {
    font-size: 8.5pt;
    padding: 0.4mm 0;
  }
  .summary-row td:last-child {
    text-align: right;
  }
  .total-row td {
    font-size: 10pt;
    font-weight: bold;
    padding: 1mm 0;
    border-top: 1px solid #000;
  }
  .total-row td:last-child {
    text-align: right;
  }
  .change-row td {
    font-size: 9.5pt;
    font-weight: bold;
    padding: 0.5mm 0;
  }
  .change-row td:last-child {
    text-align: right;
  }
  .footer {
    text-align: center;
    margin-top: 2mm;
    font-size: 8pt;
  }
  .footer-thanks {
    font-size: 9.5pt;
    font-weight: bold;
    margin: 1.5mm 0 1mm;
  }
  .powered {
    font-size: 7pt;
    margin-top: 2mm;
  }
  @media print {
    html, body { width: 58mm; }
  }
</style>
</head><body>
  <div class="store-name">${storeName}</div>
  ${storeAddress ? `<div class="store-info">${storeAddress}</div>` : ""}
  ${storePhone ? `<div class="store-info">Tel: ${storePhone}</div>` : ""}
  <hr class="divider">
  <div class="meta center">${date}</div>
  <div class="meta center">Payment: ${snap.paymentMethod.toUpperCase()}</div>
  <hr class="divider">
  <table>
    <tbody>${itemRows}</tbody>
  </table>
  <hr class="divider">
  <table>
    <tr class="summary-row"><td>Subtotal</td><td>&#8369;${snap.total.toFixed(2)}</td></tr>
    ${snap.paymentMethod !== "utang"
      ? `<tr class="summary-row"><td>Amount Paid</td><td>&#8369;${Number.parseFloat(amountReceived || "0").toFixed(2)}</td></tr>
         <tr class="change-row"><td>Change</td><td>&#8369;${snap.change.toFixed(2)}</td></tr>`
      : `<tr class="change-row"><td>Balance (Utang)</td><td>&#8369;${snap.total.toFixed(2)}</td></tr>`
    }
    <tr class="total-row"><td>TOTAL</td><td>&#8369;${snap.total.toFixed(2)}</td></tr>
  </table>
  <hr class="divider">
  <div class="footer">
    <div class="footer-thanks">Thank you! 😊</div>
    <div>Please come again!</div>
    <hr class="divider">
    <div class="powered">Powered by Payroo POS</div>
  </div>
  <script>window.onload = function() { window.print(); }<\/script>
</body></html>`)
    win.document.close()
  }

  if (saleComplete && saleSnapshot && (!loyaltyStep || loyaltyDone)) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full mx-auto">
          <DialogHeader>
            <DialogTitle className="text-green-600 flex items-center gap-2">
              <Check className="h-5 w-5" /> Sale Completed!
            </DialogTitle>
            <VisuallyHidden><DialogDescription>Sale receipt and summary</DialogDescription></VisuallyHidden>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-lg bg-muted p-4 space-y-1">
              {saleSnapshot.cart.map(item => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>{item.name} x{item.quantity}</span>
                  <span>₱{item.subtotal.toFixed(2)}</span>
                </div>
              ))}
              <div className="border-t pt-1 mt-1 flex justify-between font-bold">
                <span>Total</span><span>₱{saleSnapshot.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Paid ({saleSnapshot.paymentMethod.toUpperCase()})</span>
                <span>₱{Number.parseFloat(amountReceived).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold text-green-600">
                <span>Change</span><span>₱{saleSnapshot.change.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="gap-2" onClick={() => handlePrintReceipt()}>
              <Printer className="h-4 w-4" /> Print Receipt
            </Button>
            <Button onClick={onClose}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Complete Sale</DialogTitle>
          <DialogDescription>Select payment method and complete transaction</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Order Summary */}
          <div className="rounded-lg bg-muted p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Items</span>
              <span className="text-sm font-medium">{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Total Amount</span>
              <span className="text-lg font-bold">₱{total.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <div className="grid grid-cols-4 gap-2">
              <Button
                type="button"
                variant={paymentMethod === "cash" ? "default" : "outline"}
                className={`flex-col h-auto py-3 ${paymentMethod !== "cash" ? "bg-transparent" : ""}`}
                onClick={() => setPaymentMethod("cash")}
              >
                <Banknote className="h-5 w-5 mb-1" />
                <span className="text-xs">Cash</span>
              </Button>
              <Button
                type="button"
                variant={paymentMethod === "gcash" ? "default" : "outline"}
                className={`flex-col h-auto py-3 ${paymentMethod !== "gcash" ? "bg-transparent" : ""}`}
                onClick={() => setPaymentMethod("gcash")}
              >
                <Wallet className="h-5 w-5 mb-1" />
                <span className="text-xs">GCash</span>
              </Button>
              <Button
                type="button"
                variant={paymentMethod === "maya" ? "default" : "outline"}
                className={`flex-col h-auto py-3 ${paymentMethod !== "maya" ? "bg-transparent" : ""}`}
                onClick={() => setPaymentMethod("maya")}
              >
                <CreditCard className="h-5 w-5 mb-1" />
                <span className="text-xs">Maya</span>
              </Button>
              <Button
                type="button"
                variant={paymentMethod === "utang" ? "default" : "outline"}
                className={`flex-col h-auto py-3 ${paymentMethod !== "utang" ? "bg-transparent text-red-600 border-red-300" : "bg-red-600 hover:bg-red-700"}`}
                onClick={() => setPaymentMethod("utang")}
              >
                <HandCoins className="h-5 w-5 mb-1" />
                <span className="text-xs">Utang</span>
              </Button>
            </div>
          </div>

          {/* Utang customer input */}
          {paymentMethod === "utang" && (
            <div className="space-y-2">
              <Label>Customer Name (for utang)</Label>
              <Input
                placeholder="Juan dela Cruz"
                value={utangCustomer}
                onChange={e => { setUtangCustomer(e.target.value); setUtangChecked(false) }}
                onBlur={() => checkUtangNetwork(utangCustomer)}
              />
              {utangChecked && utangWarnings.length > 0 && (
                <div className="rounded-lg border border-red-300 bg-red-50 p-2 space-y-1">
                  <p className="text-xs font-semibold text-red-700 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Network Warning</p>
                  {utangWarnings.map(w => (
                    <p key={w.id} className="text-xs text-red-600">⚠ {w.customerName} owes ₱{w.balance.toFixed(2)} at {w.storeName}</p>
                  ))}
                </div>
              )}
              {utangChecked && utangWarnings.length === 0 && (
                <p className="text-xs text-green-600">✓ No existing utang found in network</p>
              )}
            </div>
          )}

          {/* Denomination buttons */}
          {paymentMethod !== "utang" && <div className="space-y-2">
            <Label>Quick Cash Amounts</Label>
            <div className="grid grid-cols-4 gap-2">
              <Button
                type="button"
                variant="outline"
                className="bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                onClick={() => setAmountReceived(total.toFixed(2))}
              >
                Exact
              </Button>
              {([50, 100, 300, 500, 800, 1000] as const).map((amount, i) => {
                const colors = [
                  "bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100",
                  "bg-violet-50 border-violet-300 text-violet-700 hover:bg-violet-100",
                  "bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100",
                  "bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100",
                  "bg-cyan-50 border-cyan-300 text-cyan-700 hover:bg-cyan-100",
                  "bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100",
                ]
                return (
                  <Button
                    key={amount}
                    type="button"
                    variant="outline"
                    className={colors[i]}
                    onClick={() => setAmountReceived(String(amount))}
                  >
                    ₱{amount}
                  </Button>
                )
              })}
            </div>
          </div>}

          {/* Amount Received */}
          {paymentMethod !== "utang" && (
            <div className="space-y-2">
              <Label htmlFor="amount-received">Amount Received</Label>
              <Input
                id="amount-received"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
                autoFocus
              />
            </div>
          )}

          {/* Change */}
          {amountReceived && paymentMethod !== "utang" && (
            <div className={`rounded-lg p-4 ${isValidPayment ? "bg-secondary/20" : "bg-destructive/20"}`}>
              <div className="flex justify-between items-center">
                <span className="font-semibold">Change</span>
                <span className={`text-xl font-bold ${isValidPayment ? "text-secondary" : "text-destructive"}`}>
                  ₱{isValidPayment ? change.toFixed(2) : "Insufficient"}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isProcessing} className="bg-transparent">
            Cancel
          </Button>
          <Button onClick={handleCheckout} disabled={(paymentMethod !== "utang" && !isValidPayment) || isProcessing} className="gap-2">
            <Check className="h-4 w-4" />
            {isProcessing ? "Processing..." : "Complete Sale"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
