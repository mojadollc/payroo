"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Clock, MapPin, Minus, Plus, ShoppingCart, Store, X, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { getStoreId } from "@/lib/store-id"
import type { DeliverySettings, Product } from "@/lib/firebase/types"

interface CartItem { product: Product; quantity: number }

function isStoreOpen(store: DeliverySettings): boolean {
  const now = new Date()
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
  return hhmm >= store.openTime && hhmm <= store.closeTime
}

export default function StoreDeliveryClient({ storeId }: { storeId: string }) {
  const [store, setStore] = useState<DeliverySettings | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [custName, setCustName] = useState("")
  const [custPhone, setCustPhone] = useState("")
  const [custAddress, setCustAddress] = useState("")
  const [custNotes, setCustNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [orderSuccess, setOrderSuccess] = useState(false)

  useEffect(() => {
    const load = async () => {
      const [sRes, pRes] = await Promise.all([
        fetch(`/api/delivery/settings?storeId=${storeId}`),
        fetch(`/api/products?storeId=${storeId}`),
      ])
      const [{ data: settings }, { data: prods }] = await Promise.all([sRes.json(), pRes.json()])
      if (!settings) { setLoading(false); return }
      setStore(settings)
      const enabledIds = new Set(settings.enabledProductIds ?? [])
      setProducts((prods ?? []).filter((p: any) => p.stock > 0 && enabledIds.has(p.id)))
      setLoading(false)
    }
    load()
  }, [storeId])

  const categories = ["All", ...Array.from(new Set(products.map(p => p.category))).sort()]
  const filtered = products.filter(p => {
    if (selectedCategory !== "All" && p.category !== selectedCategory) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(c => c.product.id === product.id)
      if (existing) return prev.map(c => c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c)
      return [...prev, { product, quantity: 1 }]
    })
  }

  const updateQty = (productId: string, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.product.id !== productId) return c
      const newQty = c.quantity + delta
      return newQty <= 0 ? c : { ...c, quantity: newQty }
    }))
  }

  const removeFromCart = (productId: string) => setCart(prev => prev.filter(c => c.product.id !== productId))

  const cartTotal = cart.reduce((sum, c) => sum + (c.product.onSale && c.product.salePrice ? c.product.salePrice : c.product.price) * c.quantity, 0)
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0)
  const deliveryFee = store?.deliveryFee ?? 0
  const grandTotal = cartTotal + deliveryFee

  const handleCheckout = async () => {
    if (!store || !custName || !custPhone || !custAddress) return
    setSubmitting(true)
    try {
      await fetch("/api/delivery/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: store.storeId, storeName: store.storeName,
          customerName: custName, customerPhone: custPhone, customerAddress: custAddress,
          items: cart.map(c => ({
            productId: c.product.id, productName: c.product.name,
            price: c.product.onSale && c.product.salePrice ? c.product.salePrice : c.product.price,
            quantity: c.quantity,
            subtotal: (c.product.onSale && c.product.salePrice ? c.product.salePrice : c.product.price) * c.quantity,
          })),
          total: grandTotal, deliveryFee, status: "pending", notes: custNotes || undefined,
        }),
      })
      setOrderSuccess(true); setCart([]); setCheckoutOpen(false)
    } catch { alert("Failed to place order. Please try again.") }
    finally { setSubmitting(false) }
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>

  if (!store) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <Store className="h-12 w-12 text-muted-foreground" />
      <p className="text-muted-foreground">Store not found or delivery not enabled</p>
      <Link href="/delivery"><Button variant="outline">Back to stores</Button></Link>
    </div>
  )

  const open = isStoreOpen(store)

  if (orderSuccess) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-4">
      <div className="text-6xl">🎉</div>
      <h1 className="text-2xl font-bold text-center">Order Placed!</h1>
      <p className="text-muted-foreground text-center max-w-sm">Your order has been sent to {store.storeName}. They will contact you to confirm.</p>
      <div className="flex gap-2">
        <Link href="/delivery"><Button variant="outline">Browse more stores</Button></Link>
        <Button onClick={() => setOrderSuccess(false)}>Order again</Button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-4">
          <Link href="/delivery" className="inline-flex items-center gap-1 text-sm mb-3 opacity-80 hover:opacity-100">
            <ArrowLeft className="h-4 w-4" /> All stores
          </Link>
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              {store.storeImage ? <img src={store.storeImage} alt="" className="h-16 w-16 rounded-xl object-cover" /> : <Store className="h-8 w-8 text-white/60" />}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold">{store.storeName}</h1>
              {store.description && <p className="text-sm opacity-80 mt-0.5">{store.description}</p>}
              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs opacity-80">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {store.openTime} - {store.closeTime}</span>
                {store.address && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {store.address}</span>}
                {store.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {store.phone}</span>}
              </div>
            </div>
            <Badge className={open ? "bg-green-500 text-white shrink-0" : "bg-gray-500 text-white shrink-0"}>{open ? "Open" : "Closed"}</Badge>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-4">
        <div className="sticky top-0 z-10 bg-gray-50 pb-3 space-y-3">
          <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="bg-white" />
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {categories.map(cat => (
              <button key={cat} onClick={() => setSelectedCategory(cat)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedCategory === cat ? "bg-primary text-primary-foreground" : "bg-white border text-muted-foreground hover:border-primary"}`}>{cat}</button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No products found</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filtered.map(product => {
              const inCart = cart.find(c => c.product.id === product.id)
              const price = product.onSale && product.salePrice ? product.salePrice : product.price
              return (
                <div key={product.id} className="rounded-xl border bg-white overflow-hidden">
                  <div className="relative aspect-square bg-muted">
                    {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full text-2xl">📦</div>}
                    {product.onSale && product.salePrice && <span className="absolute top-1 left-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">SALE</span>}
                  </div>
                  <div className="p-2.5">
                    <h3 className="text-xs font-semibold truncate">{product.name}</h3>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="font-bold text-sm text-primary">₱{price}</span>
                      {product.onSale && product.salePrice && <span className="text-[10px] line-through text-muted-foreground">₱{product.price}</span>}
                    </div>
                    {inCart ? (
                      <div className="flex items-center justify-between mt-2 bg-primary/10 rounded-lg px-2 py-1">
                        <button onClick={() => updateQty(product.id!, -1)} className="p-0.5"><Minus className="h-3.5 w-3.5" /></button>
                        <span className="text-sm font-semibold">{inCart.quantity}</span>
                        <button onClick={() => updateQty(product.id!, 1)} className="p-0.5"><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                    ) : (
                      <Button size="sm" className="w-full mt-2 h-7 text-xs" onClick={() => addToCart(product)} disabled={!open}><Plus className="h-3 w-3 mr-1" /> Add</Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-3 bg-white border-t shadow-lg safe-area-bottom">
          <button onClick={() => setCartOpen(true)} className="w-full bg-primary text-primary-foreground rounded-xl py-3 px-4 flex items-center justify-between font-semibold">
            <span className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" /><span className="bg-white/20 rounded-full px-2 py-0.5 text-sm">{cartCount}</span></span>
            <span>View Cart · ₱{cartTotal.toLocaleString()}</span>
          </button>
        </div>
      )}

      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> Your Cart</DialogTitle></DialogHeader>
          {cart.length === 0 ? <p className="text-center text-muted-foreground py-8">Your cart is empty</p> : (
            <div className="space-y-3">
              {cart.map(item => {
                const price = item.product.onSale && item.product.salePrice ? item.product.salePrice : item.product.price
                return (
                  <div key={item.product.id} className="flex items-center gap-3 border rounded-lg p-2">
                    <div className="h-12 w-12 rounded bg-muted flex items-center justify-center shrink-0">
                      {item.product.imageUrl ? <img src={item.product.imageUrl} alt="" className="h-12 w-12 rounded object-cover" /> : <span>📦</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.product.name}</p>
                      <p className="text-xs text-muted-foreground">₱{price} × {item.quantity} = ₱{(price * item.quantity).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(item.product.id!, -1)} className="h-7 w-7 rounded border flex items-center justify-center"><Minus className="h-3 w-3" /></button>
                      <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                      <button onClick={() => updateQty(item.product.id!, 1)} className="h-7 w-7 rounded border flex items-center justify-center"><Plus className="h-3 w-3" /></button>
                      <button onClick={() => removeFromCart(item.product.id!)} className="h-7 w-7 rounded flex items-center justify-center text-red-500 ml-1"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                )
              })}
              <div className="border-t pt-3 space-y-1 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>₱{cartTotal.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Delivery Fee</span><span>{deliveryFee === 0 ? "Free" : `₱${deliveryFee}`}</span></div>
                <div className="flex justify-between font-bold text-base border-t pt-2"><span>Total</span><span>₱{grandTotal.toLocaleString()}</span></div>
              </div>
              {store?.minOrder && cartTotal < store.minOrder && <p className="text-xs text-red-500">Minimum order is ₱{store.minOrder}. Add ₱{store.minOrder - cartTotal} more.</p>}
            </div>
          )}
          <DialogFooter>
            <Button className="w-full" disabled={cart.length === 0 || (store?.minOrder ? cartTotal < store.minOrder : false)} onClick={() => { setCartOpen(false); setCheckoutOpen(true) }}>
              Proceed to Checkout · ₱{grandTotal.toLocaleString()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Delivery Details</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Full Name *</Label><Input value={custName} onChange={e => setCustName(e.target.value)} placeholder="Juan Dela Cruz" /></div>
            <div className="space-y-1"><Label>Phone Number *</Label><Input value={custPhone} onChange={e => setCustPhone(e.target.value)} placeholder="09XX-XXX-XXXX" /></div>
            <div className="space-y-1"><Label>Delivery Address *</Label><Textarea value={custAddress} onChange={e => setCustAddress(e.target.value)} placeholder="House #, Street, Barangay, City" rows={2} /></div>
            <div className="space-y-1"><Label>Notes (optional)</Label><Input value={custNotes} onChange={e => setCustNotes(e.target.value)} placeholder="e.g. Landmark, special instructions" /></div>
            <div className="border-t pt-3 text-sm font-semibold flex justify-between"><span>Total</span><span>₱{grandTotal.toLocaleString()}</span></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutOpen(false)}>Back</Button>
            <Button onClick={handleCheckout} disabled={!custName || !custPhone || !custAddress || submitting}>{submitting ? "Placing order..." : "Place Order"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
