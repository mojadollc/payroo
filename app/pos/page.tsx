"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { ShoppingCart, Barcode, Trash2, X, Usb } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { BarcodeScanner } from "@/components/inventory/barcode-scanner"
import { CheckoutDialog } from "@/components/pos/checkout-dialog"
import { getProductByBarcode, getProducts, onProductsSnapshot } from "@/lib/firebase/services"
import type { Product } from "@/lib/firebase/types"
import { useToast } from "@/hooks/use-toast"
import { isFirebaseConfigured } from "@/lib/firebase/config"
import { cacheProducts, getCachedProducts, isOnline } from "@/lib/offline-sync"
import { useBusinessConfig } from "@/hooks/use-business-config"
import { useSubscription } from "@/hooks/use-subscription"
import { useHardwareScanner } from "@/hooks/use-hardware-scanner"
import { PWAInstallPrompt } from "@/components/pwa-install-prompt"
import Link from "next/link"

interface CartItem extends Product {
  quantity: number
  subtotal: number
}

function CartQuantityInput({ item, onUpdate }: { item: CartItem; onUpdate: (id: string, qty: number) => void }) {
  const [localVal, setLocalVal] = useState(String(item.quantity))

  useEffect(() => {
    setLocalVal(String(item.quantity))
  }, [item.quantity])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setLocalVal(raw)
    const val = parseInt(raw)
    if (!isNaN(val) && val > 0) {
      onUpdate(item.id!, val)
    }
  }

  const handleBlur = () => {
    const val = parseInt(localVal)
    if (isNaN(val) || val <= 0) {
      setLocalVal(String(item.quantity))
      onUpdate(item.id!, 1)
    }
  }

  return (
    <Input
      type="number"
      value={localVal}
      onChange={handleChange}
      onBlur={handleBlur}
      className="h-9 w-14 text-center p-0 text-base font-semibold"
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
  const [showCartDrawer, setShowCartDrawer] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const { toast } = useToast()
  const [lastHwScan, setLastHwScan] = useState<string | null>(null)
  const stockBlockedRef = useRef(false)
  const productsRef = useRef<Product[]>([])

  // Hardware barcode scanner support (USB OTG)
  const handleHardwareScan = useCallback((barcode: string) => {
    setLastHwScan(barcode)
    handleBarcodeSubmit(barcode)
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

  // Real-time product listener — stock updates from desktop push to mobile instantly
  useEffect(() => {
    if (!isFirebaseConfigured) return

    // Start with cached products immediately (fast first paint / offline)
    const cached = getCachedProducts()
    if (cached.length > 0) {
      setProducts(cached as Product[])
      setShuffledProducts(shuffleArray(cached as Product[]))
      productsRef.current = cached as Product[]
    }

    // Subscribe to real-time Firestore updates
    const unsubscribe = onProductsSnapshot((data) => {
      setProducts(data)
      setShuffledProducts(shuffleArray(data))
      productsRef.current = data
      cacheProducts(data)
    })

    return () => unsubscribe()
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

  // Check Firebase configuration synchronously on mount
  if (!isFirebaseConfigured) {
    router.push("/setup")
    return null
  }

  // Block entire POS if subscription is expired
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
      const data = await getProducts()
      setProducts(data)
      setShuffledProducts(shuffleArray(data))
      productsRef.current = data
      cacheProducts(data)
    } catch (error) {
      console.error("[v0] Error loading products:", error)
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
      // Try Firestore first, fall back to local cache
      let product: Product | null = null
      try {
        product = await getProductByBarcode(barcode)
      } catch {
        // Offline — search cached products
        const cached = getCachedProducts() as Product[]
        product = cached.find(p => p.barcode === barcode) ?? null
      }
      if (product) {
        if (product.stock <= 0) {
          toast({
            title: "Out of stock",
            description: `${product.name} is currently out of stock`,
            variant: "destructive",
          })
          return
        }
        addToCart(product)
        setBarcodeInput("")
        setSearchSuggestions([])
      } else {
        toast({
          title: "Product not found",
          description: "No product found with this barcode",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("[v0] Error finding product:", error)
      toast({
        title: "Error",
        description: "Failed to find product",
        variant: "destructive",
      })
    }
  }

  const effectivePrice = (product: Product) =>
    product.onSale && product.salePrice ? product.salePrice : product.price

  const addToCart = (product: Product) => {
    // Use latest real-time stock from productsRef
    const liveProduct = productsRef.current.find(p => p.id === product.id) || product
    const price = effectivePrice(liveProduct)
    stockBlockedRef.current = false

    if (liveProduct.stock <= 0) {
      toast({ title: "Out of stock", description: `${liveProduct.name} is currently out of stock`, variant: "destructive" })
      return
    }

    setCart(prev => {
      const existingItem = prev.find((item) => item.id === liveProduct.id)

      if (existingItem) {
        if (existingItem.quantity >= liveProduct.stock) {
          stockBlockedRef.current = true
          return prev
        }
        return prev.map((item) =>
          item.id === liveProduct.id
            ? {
                ...item,
                stock: liveProduct.stock,
                quantity: item.quantity + 1,
                subtotal: (item.quantity + 1) * price,
              }
            : item,
        )
      }

      return [
        ...prev,
        {
          ...liveProduct,
          price,
          quantity: 1,
          subtotal: price,
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

  const updateQuantity = (productId: string, newQuantity: number) => {
    const product = cart.find((item) => item.id === productId)
    if (!product) return

    if (newQuantity <= 0) {
      removeFromCart(productId)
      return
    }

    // Use real-time stock
    const liveStock = productsRef.current.find(p => p.id === productId)?.stock ?? product.stock
    if (newQuantity > liveStock) {
      toast({
        title: "Stock limit reached",
        description: `Only ${liveStock} units available`,
        variant: "destructive",
      })
      return
    }

    setCart(
      cart.map((item) =>
        item.id === productId
          ? {
              ...item,
              stock: liveStock,
              quantity: newQuantity,
              subtotal: newQuantity * item.price,
            }
          : item,
      ),
    )
  }

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.id !== productId))
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
    // No need to manually reload — onSnapshot listener auto-updates stock
  }

  return (
    <div className="min-h-screen bg-background">
        <PWAInstallPrompt />
        <div className="container mx-auto px-4 py-8">
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold">POS</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-sm text-muted-foreground">{cfg.emoji} {cfg.label}</p>
                  <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">
                    <Usb className="h-3 w-3" /> Ready
                  </span>
                </div>
              </div>
            </div>
            {lastHwScan && (
              <div className="mt-2 text-sm text-green-600 font-medium animate-pulse">
                ✅ Scanned: {lastHwScan}
              </div>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Product Selection */}
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
                              const q = barcodeInput.toLowerCase()
                              const name = p.name.toLowerCase()
                              const category = p.category.toLowerCase()
                              const description = (p.description || '').toLowerCase()
                              
                              // Determine match reason for display
                              let matchReason = ''
                              if (name.includes(q)) {
                                matchReason = 'Name match'
                              } else if (p.barcode.includes(q)) {
                                matchReason = 'Barcode match'
                              } else if (category.includes(q)) {
                                matchReason = `Category: ${p.category}`
                              } else if (description.includes(q)) {
                                matchReason = 'Description match'
                              } else {
                                // Related product logic
                                const searchWords = q.split(' ').filter(word => word.length > 2)
                                const relatedWord = searchWords.find(word => {
                                  if (word === 'ice' && (name.includes('cold') || name.includes('frozen') || name.includes('drink'))) return true
                                  if (word === 'juice' && (name.includes('drink') || name.includes('beverage'))) return true
                                  if (word === 'water' && (name.includes('drink') || name.includes('beverage'))) return true
                                  if (word === 'milk' && (name.includes('dairy') || name.includes('cream'))) return true
                                  if (word === 'bread' && (name.includes('loaf') || name.includes('bun'))) return true
                                  if (word === 'rice' && (name.includes('grain') || name.includes('bigas'))) return true
                                  if (word === 'soap' && (name.includes('detergent') || name.includes('wash'))) return true
                                  if (word === 'candy' && (name.includes('sweet') || name.includes('chocolate'))) return true
                                  if (word === 'noodle' && (name.includes('pasta') || name.includes('instant'))) return true
                                  if (word === 'coffee' && (name.includes('caffeine') || name.includes('instant'))) return true
                                  return false
                                })
                                matchReason = relatedWord ? `Related to "${relatedWord}"` : 'Related item'
                              }
                              
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted flex justify-between items-start border-b last:border-b-0"
                                  onMouseDown={() => { addToCart(p); setBarcodeInput(""); setSearchSuggestions([]) }}
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate">{p.name}</div>
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                      {matchReason} • Stock: {p.stock}
                                    </div>
                                  </div>
                                  <div className="text-right ml-2 flex-shrink-0">
                                    <div className="font-semibold text-sm">₱{effectivePrice(p).toFixed(2)}</div>
                                    {p.onSale && p.salePrice && (
                                      <div className="text-xs text-red-500 font-medium">ON SALE</div>
                                    )}
                                  </div>
                                </button>
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
                      {shuffledProducts.map((product) => (
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
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-muted-foreground">
                              <span className="text-2xl">📦</span>
                            </div>
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
                          <div className="flex justify-between items-center mt-1">
                            {product.onSale && product.salePrice ? (
                              <div className="flex flex-col">
                                <div className="text-sm font-bold text-red-500">₱{product.salePrice.toFixed(2)}</div>
                                <div className="text-[10px] line-through text-muted-foreground">₱{product.price.toFixed(2)}</div>
                              </div>
                            ) : (
                              <div className="text-sm font-bold text-primary">₱{product.price.toFixed(2)}</div>
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
                                <p className="text-xs text-muted-foreground">₱{item.price.toFixed(2)} each</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 -mr-1"
                                onClick={() => removeFromCart(item.id!)}
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
                                  onClick={() => updateQuantity(item.id!, item.quantity - 1)}
                                >
                                  −
                                </Button>
                                <CartQuantityInput item={item} onUpdate={updateQuantity} />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-9 w-9 p-0 rounded-lg border-green-300 text-green-600 hover:bg-green-50 text-lg font-bold"
                                  onClick={() => updateQuantity(item.id!, item.quantity + 1)}
                                >
                                  +
                                </Button>
                              </div>
                              <div className="ml-auto font-semibold text-sm">₱{item.subtotal.toFixed(2)}</div>
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
                          <span className="text-secondary font-semibold">₱{calculateProfit().toFixed(2)}</span>
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

        {/* Floating Cart Button (mobile) */}
        <button
          className="fixed bottom-24 right-4 z-40 lg:hidden flex items-center justify-center w-14 h-14 rounded-full bg-primary text-white shadow-2xl active:scale-95 transition-transform"
          onClick={() => setShowCartDrawer(true)}
        >
          <ShoppingCart className="h-7 w-7" />
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">
              {cart.reduce((s, i) => s + i.quantity, 0)}
            </span>
          )}
        </button>

        {/* Cart Drawer (mobile) */}
        {showCartDrawer && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowCartDrawer(false)} />
            <div className="absolute bottom-0 left-0 right-0 bg-background rounded-t-2xl max-h-[85vh] overflow-y-auto pb-safe">
              <div className="flex items-center justify-between p-4 border-b">
                <span className="font-bold flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" /> Cart ({cart.length})
                </span>
                <div className="flex items-center gap-2">
                  {cart.length > 0 && (
                    <Button variant="ghost" size="sm" className="bg-red-500 hover:bg-red-600 text-white" onClick={clearCart}>
                      Clear
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => setShowCartDrawer(false)}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>
              <div className="p-4 space-y-3">
                {cart.length === 0 ? (
                  <div className="py-12 text-center">
                    <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-sm text-muted-foreground">Cart is empty</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {cart.map((item) => (
                        <div key={item.id} className="space-y-2 pb-3 border-b last:border-0">
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{item.name}</p>
                              <p className="text-xs text-muted-foreground">₱{item.price.toFixed(2)} each</p>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeFromCart(item.id!)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <Button variant="outline" size="sm" className="h-9 w-9 p-0 rounded-lg border-red-300 text-red-600 text-lg font-bold" onClick={() => updateQuantity(item.id!, item.quantity - 1)}>−</Button>
                              <CartQuantityInput item={item} onUpdate={updateQuantity} />
                              <Button variant="outline" size="sm" className="h-9 w-9 p-0 rounded-lg border-green-300 text-green-600 text-lg font-bold" onClick={() => updateQuantity(item.id!, item.quantity + 1)}>+</Button>
                            </div>
                            <div className="ml-auto font-semibold text-sm">₱{item.subtotal.toFixed(2)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>₱{calculateTotal().toFixed(2)}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Est. Profit</span><span className="text-secondary font-semibold">₱{calculateProfit().toFixed(2)}</span></div>
                      <Separator />
                      <div className="flex justify-between font-bold text-lg"><span>Total</span><span>₱{calculateTotal().toFixed(2)}</span></div>
                    </div>
                    <div className="pb-20">
                      <Button size="lg" className="w-full" onClick={() => { setShowCartDrawer(false); setShowCheckout(true) }}>
                        Checkout
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

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
      </div>
    )
}
