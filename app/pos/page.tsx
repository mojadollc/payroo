"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { ShoppingCart, Barcode, Trash2, X, Usb, Plus, Minus, Search } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { BarcodeScanner } from "@/components/inventory/barcode-scanner"
import { CheckoutDialog } from "@/components/pos/checkout-dialog"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { FloatingActionButton } from "@/components/ui/floating-action-button"
import { MobileAppShell, MobileCard, MobileSectionHeader } from "@/components/mobile-app-shell"
import { cacheProducts, getCachedProducts, isOnline } from "@/lib/offline-sync"
import { localPutMany, localGetByStoreId } from "@/lib/offline/store"
import { useBusinessConfig } from "@/hooks/use-business-config"
import { useSubscription } from "@/hooks/use-subscription"
import { useHardwareScanner } from "@/hooks/use-hardware-scanner"
import { useToast } from "@/hooks/use-toast"
import { PWAInstallPrompt } from "@/components/pwa-install-prompt"
import { DefaultProductImage } from "@/components/ui/default-product-image"
import { getStoreId } from "@/lib/store-id"
import type { Product } from "@/lib/firebase/types"
import Link from "next/link"

interface CartItem extends Product {
  quantity: number
  subtotal: number
  selectedVariants?: Record<string, string> // e.g. { Color: "Red", Size: "M" }
  /** Stable line id: productId or productId_variantKey */
  cartLineId?: string
}

function getCartLineId(productId: string, selectedVariants?: Record<string, string>) {
  if (!selectedVariants || Object.keys(selectedVariants).length === 0) return productId
  return `${productId}_${Object.values(selectedVariants).join("-")}`
}

function CartQuantityInput({
  item, onUpdate, onLiveChange, className,
}: {
  item: CartItem
  onUpdate: (id: string, qty: number) => void
  onLiveChange?: (qty: number) => void
  className?: string
}) {
  const [localVal, setLocalVal] = useState(String(item.quantity))
  const editing = useRef(false)

  useEffect(() => {
    if (!editing.current) setLocalVal(String(item.quantity))
  }, [item.quantity])

  const commit = (raw: string) => {
    editing.current = false
    const val = parseInt(raw)
    if (!isNaN(val) && val > 0) {
      const lineId = item.cartLineId || item.id!
      onUpdate(lineId, val)
    } else {
      setLocalVal(String(item.quantity))
      onLiveChange?.(item.quantity)
    }
  }

  return (
    <Input
      type="number"
      inputMode="numeric"
      value={localVal}
      onFocus={(e) => { editing.current = true; e.target.select() }}
      onChange={(e) => {
        setLocalVal(e.target.value)
        const v = parseInt(e.target.value)
        if (!isNaN(v) && v > 0) onLiveChange?.(v)
      }}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(localVal) } }}
      className={className ?? "h-9 w-14 text-center p-0 text-base font-semibold"}
      min="1"
      max={item.stock}
    />
  )
}

export default function POSPage() {
  const router = useRouter()
  const cfg = useBusinessConfig()
  const { isActive, loading: subLoading, endDate } = useSubscription()
  const CART_KEY = "pos_cart"
  const [products, setProducts] = useState<Product[]>([])
  const [shuffledProducts, setShuffledProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window === "undefined") return []
    try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]") } catch { return [] }
  })

  // Persist cart to localStorage on every change
  useEffect(() => {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)) } catch {}
  }, [cart])
  const [barcodeInput, setBarcodeInput] = useState("")
  const [searchSuggestions, setSearchSuggestions] = useState<Product[]>([])
  const [dropdownQty, setDropdownQty] = useState<Record<string, number>>({})
  const [liveQuantities, setLiveQuantities] = useState<Record<string, number>>({})
  const [showCartDrawer, setShowCartDrawer] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [variantPicker, setVariantPicker] = useState<{ product: Product; selections: Record<string, string> } | null>(null)
  const { toast } = useToast()
  const [lastHwScan, setLastHwScan] = useState<string | null>(null)
  const stockBlockedRef = useRef(false)
  const productsRef = useRef<Product[]>([])

  // Keep latest barcode handler without stale closures
  const handleBarcodeSubmitRef = useRef<(barcode: string) => void>(() => {})

  // Hardware barcode scanner support (USB OTG)
  const handleHardwareScan = useCallback((barcode: string) => {
    setLastHwScan(barcode)
    handleBarcodeSubmitRef.current(barcode)
    setBarcodeInput("")
    setTimeout(() => setLastHwScan(null), 2000)
  }, [])

  const scannerInputRef = useHardwareScanner({
    onScan: handleHardwareScan,
    enabled: !showScanner && !showCheckout,
  })

  // Shuffle array function
  const shuffleArray = (array: Product[]) => {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  // Load products on mount — fetch from Postgres API
  useEffect(() => {
    const storeId = getStoreId()
    if (!storeId) return

    // Show cached products immediately
    const cached = getCachedProducts()
    if (cached.length > 0) {
      setProducts(cached as Product[])
      setShuffledProducts(shuffleArray(cached as Product[]))
      productsRef.current = cached as Product[]
    } else {
      localGetByStoreId<Product>("products").then(idbProducts => {
        if (idbProducts.length > 0) {
          setProducts(idbProducts)
          setShuffledProducts(shuffleArray(idbProducts))
          productsRef.current = idbProducts
        }
      }).catch(() => {})
    }

    fetch(`/api/products?storeId=${storeId}`)
      .then(r => r.json())
      .then(({ data }) => {
        if (!data?.length) return
        setProducts(data)
        setShuffledProducts(prev => {
          if (prev.length === 0) return shuffleArray(data)
          const map = new Map(data.map((p: Product) => [p.id, p]))
          const kept = prev.map(p => map.get(p.id)).filter((p): p is Product => !!p)
          const existingIds = new Set(kept.map(p => p.id))
          const added = data.filter((p: Product) => !existingIds.has(p.id))
          return [...kept, ...added]
        })
        productsRef.current = data
        cacheProducts(data)
        localPutMany("products", data.map((d: Product) => ({ ...d, _createdAtMs: Date.now(), _updatedAtMs: Date.now() }))).catch(() => {})
      })
      .catch(() => {})
  }, [])

  // Auto-sync cart stock when products update in real-time
  useEffect(() => {
    if (products.length === 0 || cart.length === 0) return
    let changed = false
    const updated = cart.reduce<CartItem[]>((acc, item) => {
      const liveProduct = products.find(p => p.id === item.id)
      if (!liveProduct || liveProduct.stock <= 0) {
        changed = true
        toast({ title: "Removed from cart", description: `${item.name} is now out of stock`, variant: "destructive" })
        return acc
      }
      if (item.quantity > liveProduct.stock) {
        changed = true
        toast({ title: "Quantity adjusted", description: `${item.name} reduced to ${liveProduct.stock} (stock updated)`, variant: "destructive" })
        acc.push({ ...item, stock: liveProduct.stock, quantity: liveProduct.stock, subtotal: liveProduct.stock * item.price })
      } else {
        acc.push({ ...item, stock: liveProduct.stock })
      }
      return acc
    }, [])
    if (changed) setCart(updated)
  }, [products])

  // Block entire POS if subscription is expired — never show while still loading
  if (!subLoading && !isActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-red-100">
            <span className="text-5xl">🔒</span>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-red-600">Subscription Expired</h1>
            <p className="text-muted-foreground">
              Your subscription expired on{" "}
              <strong>
                {endDate?.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" }) ?? "an earlier date"}
              </strong>.
            </p>
            <p className="text-sm text-muted-foreground">
              The POS and all features are locked. Renew your subscription to continue using Payroo POS.
            </p>
          </div>
          <div className="space-y-3">
            <Link href="/subscription">
              <Button size="lg" className="w-full bg-red-600 hover:bg-red-700 text-white gap-2">
                Renew Subscription
              </Button>
            </Link>
            <Link href="/settings">
              <Button size="lg" variant="outline" className="w-full">
                View Subscription Details
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Real-time product listener is in the useEffect above (before conditional returns)

  const loadProducts = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) return
      const res = await fetch(`/api/products?storeId=${storeId}`)
      const { data } = await res.json()
      if (data?.length > 0) {
        setProducts(data)
        setShuffledProducts(shuffleArray(data))
        productsRef.current = data
        cacheProducts(data)
      }
    } catch (error) {
      console.error("[pos] Error loading products:", error)
      const cached = getCachedProducts()
      if (cached.length > 0) {
        setProducts(cached as Product[])
        setShuffledProducts(shuffleArray(cached as Product[]))
      }
    }
  }

  const handleInputChange = (value: string) => {
    setBarcodeInput(value)
    if (value.trim().length >= 2) {
      const q = value.toLowerCase()
      
      // Enhanced search with related products and fuzzy matching
      const matches = products.filter(p => {
        const name = p.name.toLowerCase()
        const barcode = p.barcode.toLowerCase()
        const category = p.category.toLowerCase()
        const description = (p.description || '').toLowerCase()
        
        return name.includes(q) || barcode.includes(q) || category.includes(q) || description.includes(q)
      })
      
      // Find related products by keywords
      const relatedMatches = products.filter(p => {
        const name = p.name.toLowerCase()
        const category = p.category.toLowerCase()
        
        // Skip if already in main matches
        if (matches.some(m => m.id === p.id)) return false
        
        // Related product logic based on search term
        const searchWords = q.split(' ').filter(word => word.length > 2)
        
        return searchWords.some(word => {
          // Find products with similar keywords
          if (word === 'ice' && (name.includes('cold') || name.includes('frozen') || name.includes('drink') || category.includes('beverage'))) return true
          if (word === 'juice' && (name.includes('drink') || name.includes('beverage') || category.includes('drink'))) return true
          if (word === 'water' && (name.includes('drink') || name.includes('beverage') || name.includes('liquid'))) return true
          if (word === 'milk' && (name.includes('dairy') || category.includes('dairy') || name.includes('cream'))) return true
          if (word === 'bread' && (name.includes('loaf') || category.includes('bakery') || name.includes('bun'))) return true
          if (word === 'rice' && (name.includes('grain') || category.includes('grain') || name.includes('bigas'))) return true
          if (word === 'soap' && (name.includes('detergent') || category.includes('cleaning') || name.includes('wash'))) return true
          if (word === 'candy' && (name.includes('sweet') || category.includes('snack') || name.includes('chocolate'))) return true
          if (word === 'noodle' && (name.includes('pasta') || name.includes('instant') || category.includes('noodle'))) return true
          if (word === 'coffee' && (name.includes('caffeine') || name.includes('instant') || category.includes('beverage'))) return true
          
          return false
        })
      })
      
      // Combine main matches with related matches
      const allMatches = [...matches, ...relatedMatches]
      
      // Sort by relevance: exact matches first, then starts-with, then contains, then related
      const sortedMatches = allMatches.sort((a, b) => {
        const aName = a.name.toLowerCase()
        const bName = b.name.toLowerCase()
        const aIsMainMatch = matches.some(m => m.id === a.id)
        const bIsMainMatch = matches.some(m => m.id === b.id)
        
        // Main matches always come before related matches
        if (aIsMainMatch && !bIsMainMatch) return -1
        if (bIsMainMatch && !aIsMainMatch) return 1
        
        // Within main matches, prioritize by relevance
        if (aIsMainMatch && bIsMainMatch) {
          // Exact name match gets highest priority
          if (aName === q) return -1
          if (bName === q) return 1
          
          // Name starts with query gets second priority
          if (aName.startsWith(q) && !bName.startsWith(q)) return -1
          if (bName.startsWith(q) && !aName.startsWith(q)) return 1
          
          // Barcode exact match gets third priority
          if (a.barcode === q) return -1
          if (b.barcode === q) return 1
        }
        
        // Alphabetical order for remaining matches
        return aName.localeCompare(bName)
      })
      
      setSearchSuggestions(sortedMatches.slice(0, 12)) // Increased to 12 to show more related products
    } else {
      setSearchSuggestions([])
    }
  }

  const handleBarcodeSubmit = async (barcode: string) => {
    try {
      const storeId = getStoreId()
      let product: Product | null = null
      try {
        const res = await fetch(`/api/products?storeId=${storeId}&barcode=${encodeURIComponent(barcode)}`)
        const { data } = await res.json()
        product = data ?? null
      } catch {
        const cached = getCachedProducts() as Product[]
        product = cached.find(p => p.barcode === barcode) ?? null
      }
      if (product) {
        if (product.stock <= 0) {
          toast({ title: "Out of stock", description: `${product.name} is currently out of stock`, variant: "destructive" })
          return
        }
        addToCart(product)
        setBarcodeInput("")
        setSearchSuggestions([])
      } else {
        toast({ title: "Product not found", description: "No product found with this barcode", variant: "destructive" })
      }
    } catch (error) {
      console.error("[pos] Error finding product:", error)
      toast({ title: "Error", description: "Failed to find product", variant: "destructive" })
    }
  }

  // Keep hardware scanner callback up to date
  handleBarcodeSubmitRef.current = handleBarcodeSubmit

  const effectivePrice = (product: Product) =>
    product.onSale && product.salePrice ? product.salePrice : product.price

  const addToCart = (product: Product, selectedVariants?: Record<string, string>) => {
    // Use latest real-time stock from productsRef
    const liveProduct = productsRef.current.find(p => p.id === product.id) || product
    const price = effectivePrice(liveProduct)
    stockBlockedRef.current = false

    // If product has variants and none selected, show picker
    if (liveProduct.variants && liveProduct.variants.length > 0 && !selectedVariants) {
      setVariantPicker({ product: liveProduct, selections: {} })
      return
    }

    if (liveProduct.stock <= 0) {
      toast({ title: "Out of stock", description: `${liveProduct.name} is currently out of stock`, variant: "destructive" })
      return
    }

    // Build a unique cart key that includes variant selections
    const variantKey = selectedVariants ? Object.values(selectedVariants).join("-") : ""
    const cartId = variantKey ? `${liveProduct.id}_${variantKey}` : liveProduct.id

    setCart(prev => {
      const existingItem = prev.find((item) => {
        if (variantKey) {
          const itemVariantKey = item.selectedVariants ? Object.values(item.selectedVariants).join("-") : ""
          return item.id === liveProduct.id && itemVariantKey === variantKey
        }
        return item.id === liveProduct.id && !item.selectedVariants
      })

      if (existingItem) {
        if (existingItem.quantity >= liveProduct.stock) {
          stockBlockedRef.current = true
          return prev
        }
        return prev.map((item) =>
          item === existingItem
            ? {
                ...item,
                stock: liveProduct.stock,
                quantity: item.quantity + 1,
                subtotal: (item.quantity + 1) * price,
              }
            : item,
        )
      }

      const lineId = getCartLineId(liveProduct.id!, selectedVariants)
      return [
        ...prev,
        {
          ...liveProduct,
          price,
          quantity: 1,
          subtotal: price,
          selectedVariants: selectedVariants || undefined,
          cartLineId: lineId,
        },
      ]
    })

    setTimeout(() => {
      if (stockBlockedRef.current) {
        toast({
          title: "Stock limit reached",
          description: `Only ${liveProduct.stock} units available`,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Added to cart",
          description: `${liveProduct.name} added`,
        })
      }
    }, 0)
  }

  /** Update quantity by cart line id (supports variants). Falls back to product id. */
  const updateQuantity = (lineOrProductId: string, newQuantity: number) => {
    const product = cart.find(
      (item) => (item.cartLineId || item.id) === lineOrProductId || item.id === lineOrProductId
    )
    if (!product) return

    if (newQuantity <= 0) {
      removeFromCart(lineOrProductId)
      return
    }

    // Use real-time stock (stock is per product, not per variant)
    const liveStock = productsRef.current.find(p => p.id === product.id)?.stock ?? product.stock
    if (newQuantity > liveStock) {
      toast({
        title: "Stock limit reached",
        description: `Only ${liveStock} units available`,
        variant: "destructive",
      })
      return
    }

    const lineId = product.cartLineId || getCartLineId(product.id!, product.selectedVariants)
    setCart(prev =>
      prev.map((item) => {
        const itemLine = item.cartLineId || getCartLineId(item.id!, item.selectedVariants)
        if (itemLine !== lineId) return item
        return {
          ...item,
          stock: liveStock,
          quantity: newQuantity,
          subtotal: newQuantity * item.price,
          cartLineId: lineId,
        }
      }),
    )
  }

  const removeFromCart = (lineOrProductId: string) => {
    setCart(prev =>
      prev.filter((item) => {
        const itemLine = item.cartLineId || getCartLineId(item.id!, item.selectedVariants)
        return itemLine !== lineOrProductId
      })
    )
  }

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + item.subtotal, 0)
  }

  const calculateProfit = () => {
    return cart.reduce((sum, item) => sum + (item.price - item.cost) * item.quantity, 0)
  }

  const clearCart = () => {
    setCart([])
    try { localStorage.removeItem(CART_KEY) } catch {}
  }

  const handleCheckoutSuccess = () => {
    clearCart()
    loadProducts()
  }

  return (
    <MobileAppShell
      title="Point of Sale"
      subtitle={`${cfg.emoji} ${cfg.label}`}
      headerAction={
        <div className="flex items-center gap-2">
          {lastHwScan && (
            <span className="text-xs text-green-600 font-medium animate-pulse hidden md:inline">
              ✅ {lastHwScan}
            </span>
          )}
          {cart.length > 0 && (
            <button
              className="relative inline-flex items-center gap-1 text-xs text-white bg-yellow-500 border border-yellow-600 px-2 py-1 rounded-full font-semibold shadow"
              onClick={() => setShowCartDrawer(true)}
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              {cart.reduce((s, i) => s + i.quantity, 0)}
            </button>
          )}
          <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 border border-green-200 px-2 py-1 rounded-full">
            <Usb className="h-3 w-3" /> Ready
          </span>
        </div>
      }
      stickyBar={
        <div className="md:hidden flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
            <Input
              ref={scannerInputRef}
              placeholder={cfg.posPlaceholder}
              value={barcodeInput}
              onChange={(e) => handleInputChange(e.target.value)}
              className="pl-10 h-11 text-base rounded-xl border-2 border-yellow-300 bg-white focus:border-yellow-400"
              autoFocus
              onBlur={() => setTimeout(() => setSearchSuggestions([]), 150)}
            />
            {searchSuggestions.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border-2 border-yellow-300 rounded-xl shadow-2xl max-h-72 overflow-y-auto">
                {searchSuggestions.map(p => {
                  const qty = dropdownQty[p.id!] ?? 1
                  return (
                    <div key={p.id} className="flex items-center gap-2 px-3 py-2.5 border-b last:border-b-0 bg-white hover:bg-yellow-50">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{p.name}</div>
                        <div className="text-xs text-muted-foreground">₱{effectivePrice(p).toFixed(2)} • Stock: {p.stock}{p.onSale && p.salePrice && <span className="ml-1 text-orange-500 font-semibold">SALE</span>}</div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button type="button" className="h-7 w-7 rounded-full border border-red-300 text-red-500 font-bold text-base flex items-center justify-center active:bg-red-50" onMouseDown={(e) => { e.preventDefault(); setDropdownQty(prev => ({ ...prev, [p.id!]: Math.max(1, (prev[p.id!] ?? 1) - 1) })) }}>−</button>
                        <span className="w-6 text-center text-sm font-bold">{qty}</span>
                        <button type="button" className="h-7 w-7 rounded-full border border-green-300 text-green-600 font-bold text-base flex items-center justify-center active:bg-green-50" onMouseDown={(e) => { e.preventDefault(); setDropdownQty(prev => ({ ...prev, [p.id!]: Math.min(p.stock, (prev[p.id!] ?? 1) + 1) })) }}>+</button>
                        <button type="button" className="ml-1 h-8 px-3 rounded-lg bg-yellow-500 text-white text-xs font-bold active:bg-yellow-600" onMouseDown={() => { for (let i = 0; i < qty; i++) addToCart(p); setDropdownQty(prev => { const n = { ...prev }; delete n[p.id!]; return n }); setBarcodeInput(""); setSearchSuggestions([]) }}>Add</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          <Button
            size="lg"
            className="h-11 w-11 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-white border-0 shadow-md flex-shrink-0"
            onClick={() => setShowScanner(true)}
          >
            <Barcode className="h-5 w-5" />
          </Button>
        </div>
      }
    >
      <PWAInstallPrompt />

      {/* Mobile View */}
      <div className="md:hidden space-y-4">

        {/* Product Grid */}
        <div className="pt-1">
          <MobileSectionHeader title="Products" />
          <div className="grid grid-cols-2 gap-3">
            {shuffledProducts.slice(0, 20).map((product) => (
              <MobileCard
                key={product.id}
                onClick={() => product.stock > 0 && addToCart(product)}
                className={product.stock <= 0 ? "opacity-50" : ""}
              >
                <div className="relative aspect-square bg-muted">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <DefaultProductImage />
                  )}
                  {product.stock <= 0 && (
                    <div className="absolute inset-0 bg-background/90 flex items-center justify-center">
                      <span className="text-sm font-bold text-destructive">Out of Stock</span>
                    </div>
                  )}
                  {product.onSale && product.salePrice && product.stock > 0 && (
                    <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-lg shadow-lg">
                      SALE
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="font-semibold text-sm truncate mb-0.5" title={product.name}>
                    {product.name}
                  </div>
                  {product.variants && product.variants.length > 0 && (
                    <p className="text-[10px] text-primary font-medium mb-0.5">{product.variants.map(v => v.name).join(", ")}</p>
                  )}
                  {product.onSale && product.salePrice ? (
                    <div className="flex items-center gap-2">
                      <div className="text-base font-bold text-orange-600">₱{product.salePrice.toFixed(2)}</div>
                      <div className="text-xs line-through text-muted-foreground">₱{product.price.toFixed(2)}</div>
                    </div>
                  ) : (
                    <div className="text-base font-bold text-emerald-700">₱{product.price.toFixed(2)}</div>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">Stock: {product.stock}</div>
                </div>
              </MobileCard>
            ))}
          </div>
        </div>
      </div>

      {/* Desktop View */}
      <div className="hidden md:block">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
              {/* Sticky Scan Product Bar */}
              <div className="sticky top-0 z-30 bg-background pb-2 -mx-4 px-4 pt-2">
                <Card className="border-2 border-yellow-300 bg-gradient-to-r from-yellow-50 to-amber-50 shadow-lg">
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-sm text-yellow-900 font-semibold flex items-center gap-2">
                      <Barcode className="h-4 w-4 text-yellow-700" />
                      Scan Product
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 space-y-3">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        if (barcodeInput.trim()) {
                          setSearchSuggestions([])
                          handleBarcodeSubmit(barcodeInput.trim())
                        }
                      }}
                      className="flex gap-2"
                    >
                      <div className="relative flex-1">
                        <Input
                          ref={scannerInputRef}
                          placeholder={cfg.posPlaceholder}
                          value={barcodeInput}
                          onChange={(e) => handleInputChange(e.target.value)}
                          className="w-full"
                          autoFocus
                          onBlur={() => setTimeout(() => setSearchSuggestions([]), 150)}
                        />
                        {searchSuggestions.length > 0 && (
                          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg max-h-64 overflow-y-auto">
                            {searchSuggestions.map(p => {
                              const qty = dropdownQty[p.id!] ?? 1
                              return (
                                <div key={p.id} className="flex items-center gap-2 px-3 py-2 border-b last:border-b-0 hover:bg-muted">
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm truncate">{p.name}</div>
                                    <div className="text-xs text-muted-foreground">₱{effectivePrice(p).toFixed(2)} • Stock: {p.stock}{p.onSale && p.salePrice && <span className="ml-1 text-orange-500 font-medium">SALE</span>}</div>
                                  </div>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <button type="button" className="h-6 w-6 rounded border border-red-300 text-red-500 font-bold text-sm flex items-center justify-center hover:bg-red-50" onMouseDown={(e) => { e.preventDefault(); setDropdownQty(prev => ({ ...prev, [p.id!]: Math.max(1, (prev[p.id!] ?? 1) - 1) })) }}>−</button>
                                    <span className="w-6 text-center text-sm font-bold">{qty}</span>
                                    <button type="button" className="h-6 w-6 rounded border border-green-300 text-green-600 font-bold text-sm flex items-center justify-center hover:bg-green-50" onMouseDown={(e) => { e.preventDefault(); setDropdownQty(prev => ({ ...prev, [p.id!]: Math.min(p.stock, (prev[p.id!] ?? 1) + 1) })) }}>+</button>
                                    <button type="button" className="ml-1 h-7 px-2.5 rounded bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold" onMouseDown={() => { for (let i = 0; i < qty; i++) addToCart(p); setDropdownQty(prev => { const n = { ...prev }; delete n[p.id!]; return n }); setBarcodeInput(""); setSearchSuggestions([]) }}>Add</button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                      <Button type="button" variant="outline" className="bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500" onClick={() => setShowScanner(true)}>
                        <Barcode className="h-4 w-4" />
                      </Button>
                      <Button type="submit">Add</Button>
                    </form>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Select Products */}
              <Card>
                <CardHeader className="p-3 pb-2">
                  <CardTitle className="text-sm">Quick Select {cfg.itemLabelPlural}</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className="max-h-96 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                      {shuffledProducts.slice(0, 40).map((product) => (
                      <Button
                        key={product.id}
                        variant="outline"
                        className="h-auto flex-col items-start p-0 overflow-hidden bg-card hover:bg-accent/50"
                        onClick={() => addToCart(product)}
                        disabled={product.stock <= 0}
                      >
                        <div className="relative w-full aspect-square bg-muted">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <DefaultProductImage />
                          )}
                          {product.stock <= 0 && (
                            <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                              <span className="text-xs font-bold text-destructive">Out of Stock</span>
                            </div>
                          )}
                          {product.onSale && product.salePrice && product.stock > 0 && (
                            <div className="absolute top-1 left-1 bg-red-500 text-white text-[9px] font-bold px-1 py-0.5 rounded">
                              ON SALE
                            </div>
                          )}
                        </div>
                        <div className="w-full text-left p-2">
                          <div className="font-semibold text-xs truncate" title={product.name}>
                            {product.name}
                          </div>
                          {product.variants && product.variants.length > 0 && (
                            <p className="text-[9px] text-primary font-medium truncate">{product.variants.map(v => v.name).join(", ")}</p>
                          )}
                          <div className="flex justify-between items-center mt-1">
                            {product.onSale && product.salePrice ? (
                              <div className="flex flex-col">
                                <div className="text-sm font-bold text-orange-600">₱{product.salePrice.toFixed(2)}</div>
                                <div className="text-[10px] line-through text-muted-foreground">₱{product.price.toFixed(2)}</div>
                              </div>
                            ) : (
                              <div className="text-sm font-bold text-emerald-700">₱{product.price.toFixed(2)}</div>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground">Stock: {product.stock}</div>
                        </div>
                      </Button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
          </div>

          {/* Cart */}
          <div className="lg:col-span-1">
              <Card className="sticky top-4">
                <CardHeader className="p-3 pb-2">
                  <CardTitle className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5" />
                      Cart ({cart.length})
                    </span>
                    {cart.length > 0 && (
                      <Button variant="ghost" size="sm" className="bg-red-500 hover:bg-red-600 text-white" onClick={clearCart}>
                        Clear
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 space-y-3">
                  {cart.length === 0 ? (
                    <div className="py-12 text-center">
                      <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-sm text-muted-foreground">Cart is empty</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {cart.map((item) => (
                          <div key={item.id} className="space-y-2 pb-3 border-b last:border-0">
                            <div className="flex justify-between items-start">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{item.name}</p>
                                {item.selectedVariants && (
                                  <p className="text-[11px] text-primary font-medium">{Object.values(item.selectedVariants).join(" · ")}</p>
                                )}
                                <p className="text-xs text-muted-foreground">₱{item.price.toFixed(2)} each</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 -mr-1"
                                onClick={() => removeFromCart(item.cartLineId || item.id!)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-9 w-9 p-0 rounded-lg border-red-300 text-red-600 hover:bg-red-50 text-lg font-bold"
                                  onClick={() => updateQuantity(item.cartLineId || item.id!, item.quantity - 1)}
                                >
                                  −
                                </Button>
                                <CartQuantityInput item={item} onUpdate={updateQuantity} onLiveChange={(q) => setLiveQuantities(prev => ({ ...prev, [item.cartLineId || item.id!]: q }))} />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-9 w-9 p-0 rounded-lg border-green-300 text-green-600 hover:bg-green-50 text-lg font-bold"
                                  onClick={() => updateQuantity(item.cartLineId || item.id!, item.quantity + 1)}
                                >
                                  +
                                </Button>
                              </div>
                              <div className="ml-auto font-semibold text-sm">₱{((liveQuantities[item.id!] ?? item.quantity) * item.price).toFixed(2)}</div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span>₱{calculateTotal().toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Est. Profit</span>
                          <span className="text-teal-600 font-semibold">₱{calculateProfit().toFixed(2)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-bold text-lg">
                          <span>Total</span>
                          <span>₱{calculateTotal().toFixed(2)}</span>
                        </div>
                      </div>

                      <Button size="lg" className="w-full" onClick={() => setShowCheckout(true)}>
                        Checkout
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
          </div>
        </div>
      </div>

      {/* Floating Cart Button (Mobile) */}
      <FloatingActionButton
        icon={<ShoppingCart className="h-7 w-7" />}
        onClick={() => setShowCartDrawer(true)}
        badge={cart.reduce((s, i) => s + i.quantity, 0)}
      />

      {/* Cart Bottom Sheet (Mobile) */}
      <BottomSheet
        open={showCartDrawer}
        onClose={() => setShowCartDrawer(false)}
        title="Shopping Cart"
        description={cart.length > 0 ? `${cart.length} items` : "Your cart is empty"}
      >
        {cart.length === 0 ? (
          <div className="py-16 text-center">
            <ShoppingCart className="h-20 w-20 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-base text-muted-foreground">Your cart is empty</p>
            <p className="text-sm text-muted-foreground mt-2">Add products to get started</p>
          </div>
        ) : (
          <div className="space-y-3 pb-6">
            {/* Cart Items */}
            <div className="divide-y divide-border/50">
              {cart.map((item, idx) => (
                <div key={`${item.id}_${item.selectedVariants ? Object.values(item.selectedVariants).join("-") : idx}`} className="py-2.5 first:pt-0">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium truncate">{item.name}</p>
                      {item.selectedVariants && (
                        <p className="text-[11px] text-primary font-medium">{Object.values(item.selectedVariants).join(" · ")}</p>
                      )}
                      <p className="text-[12px] text-muted-foreground">₱{item.price.toFixed(2)} × {item.quantity}</p>
                    </div>
                    <div className="text-[14px] font-semibold text-emerald-700 ml-2">₱{((liveQuantities[item.id!] ?? item.quantity) * item.price).toFixed(2)}</div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 ml-1 text-destructive/60" onClick={() => removeFromCart(item.cartLineId || item.id!)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-md border-red-200 text-red-500"
                      onClick={() => updateQuantity(item.cartLineId || item.id!, item.quantity - 1)}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <CartQuantityInput
                      item={item}
                      onUpdate={updateQuantity}
                      onLiveChange={(q) => setLiveQuantities(prev => ({ ...prev, [item.cartLineId || item.id!]: q }))}
                      className="h-8 w-12 text-center p-0 text-[14px] font-semibold rounded-md border"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-md border-green-200 text-green-600"
                      onClick={() => updateQuantity(item.cartLineId || item.id!, item.quantity + 1)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="border-t pt-3 space-y-1.5">
              <div className="flex justify-between text-[13px]">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">₱{calculateTotal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-muted-foreground">Est. Profit</span>
                <span className="font-medium text-teal-600">₱{calculateProfit().toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-[16px] font-bold">
                <span>Total</span>
                <span className="text-emerald-700">₱{calculateTotal().toFixed(2)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2">
              <Button
                size="lg"
                className="w-full h-11 text-[14px] rounded-xl shadow-md"
                onClick={() => {
                  setShowCartDrawer(false)
                  setShowCheckout(true)
                }}
              >
                Checkout
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full h-9 rounded-xl text-[13px] text-destructive border-destructive/20"
                onClick={clearCart}
              >
                Clear Cart
              </Button>
            </div>
          </div>
        )}
      </BottomSheet>

        {showScanner && (
          <BarcodeScanner
            onScan={(barcode) => {
              handleBarcodeSubmit(barcode)
              setShowScanner(false)
            }}
            onClose={() => setShowScanner(false)}
          />
        )}

        {showCheckout && (
          <CheckoutDialog
            cart={cart}
            total={calculateTotal()}
            profit={calculateProfit()}
            onClose={() => setShowCheckout(false)}
            onSuccess={handleCheckoutSuccess}
          />
        )}

        {/* Variant Picker */}
        <BottomSheet
          open={!!variantPicker}
          onClose={() => setVariantPicker(null)}
          title={variantPicker?.product.name ?? "Select Options"}
          description="Choose your preferences"
        >
          {variantPicker && (
            <div className="space-y-4 pb-6">
              {variantPicker.product.variants!.map((variant) => (
                <div key={variant.name} className="space-y-2">
                  <p className="text-sm font-medium">{variant.name}</p>
                  <div className="flex flex-wrap gap-2">
                    {variant.options.map((option) => {
                      const isSelected = variantPicker.selections[variant.name] === option
                      return (
                        <Button
                          key={option}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          className={`rounded-full px-4 h-9 ${isSelected ? "" : ""}`}
                          onClick={() => setVariantPicker(prev => prev ? {
                            ...prev,
                            selections: { ...prev.selections, [variant.name]: option }
                          } : null)}
                        >
                          {option}
                        </Button>
                      )
                    })}
                  </div>
                </div>
              ))}
              <Button
                className="w-full h-12 mt-4 text-[15px]"
                disabled={variantPicker.product.variants!.some(v => !variantPicker.selections[v.name])}
                onClick={() => {
                  addToCart(variantPicker.product, variantPicker.selections)
                  setVariantPicker(null)
                }}
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Add to Cart
                {Object.keys(variantPicker.selections).length > 0 && (
                  <span className="ml-2 text-xs opacity-80">
                    ({Object.values(variantPicker.selections).join(", ")})
                  </span>
                )}
              </Button>
            </div>
          )}
        </BottomSheet>
      </MobileAppShell>
  )
}
