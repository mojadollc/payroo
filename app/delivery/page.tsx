"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Search, Clock, MapPin, Store, ChevronRight, ChevronLeft, Pencil, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { getAllDeliveryStores, getDeliveryBanners, searchDeliveryProducts } from "@/lib/firebase/services"
import type { DeliverySettings, DeliveryBanner, Product } from "@/lib/firebase/types"
import StoreDeliveryClient from "@/components/delivery/store-delivery-client"

const ADDRESS_KEY = "payroo_delivery_address"

function isStoreOpen(store: DeliverySettings): boolean {
  const now = new Date()
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
  return hhmm >= store.openTime && hhmm <= store.closeTime
}

function DeliveryContent() {
  const searchParams = useSearchParams()
  const storeId = searchParams.get("store")
  if (storeId) return <StoreDeliveryClient storeId={storeId} />
  return <DeliveryHomepage />
}

// ── Banner Carousel ──────────────────────────────────────────────────────────
function BannerCarousel({ banners }: { banners: DeliveryBanner[] }) {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (banners.length <= 1) return
    const t = setInterval(() => setCurrent(p => (p + 1) % banners.length), 4000)
    return () => clearInterval(t)
  }, [banners.length])

  if (!banners.length) return null

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div className="flex transition-transform duration-500 ease-in-out" style={{ transform: `translateX(-${current * 100}%)` }}>
        {banners.map(b => (
          <div key={b.id} className="w-full shrink-0">
            {b.link ? (
              <Link href={b.link}>
                <img src={b.imageUrl} alt={b.title ?? ""} className="w-full h-36 sm:h-48 object-cover rounded-xl" />
              </Link>
            ) : (
              <img src={b.imageUrl} alt={b.title ?? ""} className="w-full h-36 sm:h-48 object-cover rounded-xl" />
            )}
            {b.title && <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 rounded-b-xl"><p className="text-white text-sm font-semibold">{b.title}</p></div>}
          </div>
        ))}
      </div>
      {banners.length > 1 && (
        <>
          <button onClick={() => setCurrent(p => (p - 1 + banners.length) % banners.length)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-1 shadow"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => setCurrent(p => (p + 1) % banners.length)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-1 shadow"><ChevronRight className="h-4 w-4" /></button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {banners.map((_, i) => <div key={i} className={`h-1.5 rounded-full transition-all ${i === current ? "w-4 bg-white" : "w-1.5 bg-white/50"}`} />)}
          </div>
        </>
      )}
    </div>
  )
}

// ── Search Result Item ───────────────────────────────────────────────────────
function SearchResultItem({ product, store }: { product: Product; store: DeliverySettings }) {
  const price = product.onSale && product.salePrice ? product.salePrice : product.price
  return (
    <Link href={`/delivery?store=${store.storeId}`} className="flex items-center gap-3 p-3 border-b hover:bg-muted/50 transition-colors">
      <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
        {product.imageUrl ? <img src={product.imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <span className="text-lg">📦</span>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{product.name}</p>
        <p className="text-xs text-muted-foreground">{store.storeName} · ₱{price}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </Link>
  )
}

// ── Main Homepage ────────────────────────────────────────────────────────────
function DeliveryHomepage() {
  const [stores, setStores] = useState<DeliverySettings[]>([])
  const [banners, setBanners] = useState<DeliveryBanner[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [address, setAddress] = useState("")
  const [editAddress, setEditAddress] = useState(false)
  const [tempAddress, setTempAddress] = useState("")
  const [searchResults, setSearchResults] = useState<{ product: Product; store: DeliverySettings }[] | null>(null)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(ADDRESS_KEY)
    if (saved) setAddress(saved)
    Promise.all([getAllDeliveryStores(), getDeliveryBanners()])
      .then(([s, b]) => { setStores(s); setBanners(b) })
      .finally(() => setLoading(false))
  }, [])

  const saveAddress = () => {
    setAddress(tempAddress)
    localStorage.setItem(ADDRESS_KEY, tempAddress)
    setEditAddress(false)
  }

  // Debounced search across stores + products
  useEffect(() => {
    if (!search.trim()) { setSearchResults(null); return }
    const timeout = setTimeout(async () => {
      setSearching(true)
      const results = await searchDeliveryProducts(search.trim())
      setSearchResults(results)
      setSearching(false)
    }, 400)
    return () => clearTimeout(timeout)
  }, [search])

  // Filter stores by name/address matching search
  const filteredStores = stores.filter(s =>
    !search.trim() ||
    s.storeName.toLowerCase().includes(search.toLowerCase()) ||
    (s.address ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (s.description ?? "").toLowerCase().includes(search.toLowerCase())
  )

  const showSearchResults = search.trim().length > 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 pt-4 pb-5">
          <div className="flex items-center justify-between mb-3">
            <Link href="/" className="flex items-center gap-2">
              <img src="/logo.svg" alt="Payroo" className="h-7 w-7 rounded" />
              <span className="font-bold text-lg">Payroo Delivery</span>
            </Link>
          </div>

          {/* Address Bar */}
          <button onClick={() => { setTempAddress(address); setEditAddress(true) }} className="w-full flex items-center gap-2 bg-white/15 rounded-lg px-3 py-2 mb-3 text-left hover:bg-white/20 transition-colors">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="text-sm truncate flex-1">{address || "Set your delivery address"}</span>
            <Pencil className="h-3.5 w-3.5 shrink-0 opacity-70" />
          </button>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search stores, food, products..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-8 bg-white text-foreground border-0"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-2.5"><X className="h-4 w-4 text-muted-foreground" /></button>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-4 space-y-5">
        {/* Search Results Dropdown */}
        {showSearchResults && (
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-3 py-2 border-b bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground">
                {searching ? "Searching..." : `${(searchResults?.length ?? 0) + filteredStores.length} results`}
              </p>
            </div>

            {/* Matching stores */}
            {filteredStores.length > 0 && (
              <div>
                <p className="px-3 pt-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Stores</p>
                {filteredStores.slice(0, 5).map(store => (
                  <Link key={store.id} href={`/delivery?store=${store.storeId}`} className="flex items-center gap-3 p-3 border-b hover:bg-muted/50 transition-colors">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                      {store.storeLogo ? <img src={store.storeLogo} alt="" className="h-10 w-10 rounded-full object-cover" /> : <Store className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{store.storeName}</p>
                      {store.address && <p className="text-xs text-muted-foreground truncate">{store.address}</p>}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            )}

            {/* Matching products */}
            {searchResults && searchResults.length > 0 && (
              <div>
                <p className="px-3 pt-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Products</p>
                {searchResults.slice(0, 8).map((r, i) => <SearchResultItem key={`${r.product.id}-${i}`} product={r.product} store={r.store} />)}
              </div>
            )}

            {!searching && filteredStores.length === 0 && (!searchResults || searchResults.length === 0) && (
              <div className="text-center py-6 text-muted-foreground text-sm">No results found</div>
            )}
          </div>
        )}

        {/* Banner Carousel */}
        {!showSearchResults && <BannerCarousel banners={banners} />}

        {/* Store List */}
        {!showSearchResults && (
          <>
            <h2 className="text-base font-semibold">
              {loading ? "Loading stores..." : `${stores.length} store${stores.length !== 1 ? "s" : ""} near you`}
            </h2>

            {!loading && stores.length === 0 && (
              <div className="text-center py-16">
                <Store className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No delivery stores available yet</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {stores.map(store => {
                const open = isStoreOpen(store)
                return (
                  <Link
                    key={store.id}
                    href={`/delivery?store=${store.storeId}`}
                    className={`group block rounded-xl border bg-white overflow-hidden hover:shadow-lg transition-shadow ${!open ? "opacity-70" : ""}`}
                  >
                    {/* Cover Image */}
                    <div className="relative h-32 bg-gradient-to-br from-primary/20 to-primary/5">
                      {store.storeImage ? (
                        <img src={store.storeImage} alt={store.storeName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full"><Store className="h-10 w-10 text-primary/30" /></div>
                      )}
                      <Badge className={`absolute top-2 right-2 text-[10px] ${open ? "bg-green-500 text-white" : "bg-gray-500 text-white"}`}>{open ? "Open" : "Closed"}</Badge>
                      {/* Logo overlay */}
                      {store.storeLogo && (
                        <div className="absolute -bottom-5 left-3 h-11 w-11 rounded-full border-2 border-white bg-white shadow overflow-hidden">
                          <img src={store.storeLogo} alt="" className="h-full w-full object-cover" />
                        </div>
                      )}
                    </div>

                    <div className={`p-3 ${store.storeLogo ? "pt-7" : "pt-3"}`}>
                      <div className="flex items-start justify-between">
                        <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">{store.storeName}</h3>
                        <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5 group-hover:text-primary transition-colors" />
                      </div>
                      {store.description && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{store.description}</p>}
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {store.openTime} - {store.closeTime}</span>
                        {store.address && <span className="flex items-center gap-1 truncate"><MapPin className="h-3 w-3 shrink-0" /> {store.address}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        {store.minOrder && store.minOrder > 0 && (
                          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Min ₱{store.minOrder}</span>
                        )}
                        {store.deliveryFee !== undefined && (
                          <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full font-medium">{store.deliveryFee === 0 ? "Free delivery" : `₱${store.deliveryFee} delivery`}</span>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Edit Address Dialog */}
      <Dialog open={editAddress} onOpenChange={setEditAddress}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" /> Delivery Address</DialogTitle></DialogHeader>
          <Textarea value={tempAddress} onChange={e => setTempAddress(e.target.value)} placeholder="Enter your full delivery address" rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAddress(false)}>Cancel</Button>
            <Button onClick={saveAddress}>Save Address</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function DeliveryPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>}>
      <DeliveryContent />
    </Suspense>
  )
}
