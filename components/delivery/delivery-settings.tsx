"use client"

import { useState, useEffect } from "react"
import { Truck, Clock, Package, Search, Check, ImageIcon } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { getStoreId } from "@/lib/store-id"
import { getStoreId } from "@/lib/store-id"
import type { Product, DeliverySettings } from "@/lib/firebase/types"

export function DeliverySettingsPanel() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [description, setDescription] = useState("")
  const [openTime, setOpenTime] = useState("08:00")
  const [closeTime, setCloseTime] = useState("22:00")
  const [minOrder, setMinOrder] = useState("")
  const [deliveryFee, setDeliveryFee] = useState("")
  const [storeLogo, setStoreLogo] = useState("")
  const [storeImage, setStoreImage] = useState("")
  const [enabledProductIds, setEnabledProductIds] = useState<Set<string>>(new Set())
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState("")
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)

  useEffect(() => {
    const load = async () => {
      const sid = getStoreId()
      const [sRes, pRes] = await Promise.all([
        fetch(`/api/delivery/settings?storeId=${sid}`),
        fetch(`/api/products?storeId=${sid}`),
      ])
      const [{ data: settings }, { data: prods }] = await Promise.all([sRes.json(), pRes.json()])
      setProducts(prods ?? [])
      if (settings) {
        setEnabled(settings.enabled)
        setDescription(settings.description ?? "")
        setOpenTime(settings.openTime)
        setCloseTime(settings.closeTime)
        setMinOrder(settings.minOrder?.toString() ?? "")
        setDeliveryFee(settings.deliveryFee?.toString() ?? "")
        setStoreLogo(settings.storeLogo ?? "")
        setStoreImage(settings.storeImage ?? "")
        setEnabledProductIds(new Set(settings.enabledProductIds))
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleUpload = async (file: File, type: "logo" | "image") => {
    if (type === "logo") setUploadingLogo(true)
    else setUploadingImage(true)
    try {
      const reader = new FileReader()
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      if (type === "logo") setStoreLogo(base64)
      else setStoreImage(base64)
      toast({ title: `${type === "logo" ? "Logo" : "Cover image"} uploaded` })
    } catch { toast({ title: "Upload failed", variant: "destructive" }) }
    finally {
      if (type === "logo") setUploadingLogo(false)
      else setUploadingImage(false)
    }
  }

  const toggleProduct = (id: string) => {
    setEnabledProductIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => setEnabledProductIds(new Set(products.map(p => p.id!)))
  const deselectAll = () => setEnabledProductIds(new Set())

  const handleSave = async () => {
    setSaving(true)
    try {
      const sid = getStoreId()
      const storeSettingsRes = await fetch(`/api/store-settings?storeId=${sid}`)
      const { data: storeSettings } = await storeSettingsRes.json()
      await fetch("/api/delivery/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: sid,
          enabled,
          storeName: storeSettings?.name ?? "My Store",
          description: description || "",
          address: storeSettings?.address || "",
          phone: storeSettings?.phone || "",
          storeLogo: storeLogo || undefined,
          storeImage: storeImage || undefined,
          openTime,
          closeTime,
          minOrder: minOrder ? parseFloat(minOrder) : 0,
          deliveryFee: deliveryFee ? parseFloat(deliveryFee) : 0,
          enabledProductIds: Array.from(enabledProductIds),
        }),
      })
      toast({ title: "Delivery settings saved" })
    } catch {
      toast({ title: "Failed to save", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className="text-center py-8 text-muted-foreground">Loading delivery settings...</div>

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Truck className="h-4 w-4 text-primary" /> Online Delivery
          </CardTitle>
          <CardDescription>Enable delivery so customers can order from your store online.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="delivery-toggle" className="font-medium">Enable Delivery Store</Label>
            <Switch id="delivery-toggle" checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {enabled && (
            <>
              <div className="space-y-1">
                <Label>Store Description</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Short description for customers" rows={2} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="flex items-center gap-1"><ImageIcon className="h-3 w-3" /> Store Logo</Label>
                  <div className="flex items-center gap-2">
                    {storeLogo && <img src={storeLogo} alt="Logo" className="h-10 w-10 rounded-full object-cover border" />}
                    <label className="cursor-pointer">
                      <Button variant="outline" size="sm" disabled={uploadingLogo} asChild><span>{uploadingLogo ? "Uploading..." : storeLogo ? "Change" : "Upload"}</span></Button>
                      <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0], "logo") }} />
                    </label>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="flex items-center gap-1"><ImageIcon className="h-3 w-3" /> Cover Image</Label>
                  <div className="flex items-center gap-2">
                    {storeImage && <img src={storeImage} alt="Cover" className="h-10 w-16 rounded object-cover border" />}
                    <label className="cursor-pointer">
                      <Button variant="outline" size="sm" disabled={uploadingImage} asChild><span>{uploadingImage ? "Uploading..." : storeImage ? "Change" : "Upload"}</span></Button>
                      <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0], "image") }} />
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="flex items-center gap-1"><Clock className="h-3 w-3" /> Opening Time</Label>
                  <Input type="time" value={openTime} onChange={e => setOpenTime(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="flex items-center gap-1"><Clock className="h-3 w-3" /> Closing Time</Label>
                  <Input type="time" value={closeTime} onChange={e => setCloseTime(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Min Order (₱)</Label>
                  <Input type="number" value={minOrder} onChange={e => setMinOrder(e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-1">
                  <Label>Delivery Fee (₱)</Label>
                  <Input type="number" value={deliveryFee} onChange={e => setDeliveryFee(e.target.value)} placeholder="0" />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {enabled && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4 text-primary" /> Delivery Products
            </CardTitle>
            <CardDescription>
              Select which products to show on your delivery store page.
              ({enabledProductIds.size} of {products.length} selected)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
              </div>
              <Button variant="outline" size="sm" onClick={selectAll}>All</Button>
              <Button variant="outline" size="sm" onClick={deselectAll}>None</Button>
            </div>

            <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
              {filtered.map(product => {
                const selected = enabledProductIds.has(product.id!)
                return (
                  <button
                    key={product.id}
                    onClick={() => toggleProduct(product.id!)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 transition-colors ${selected ? "bg-primary/5" : ""}`}
                  >
                    <div className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 ${selected ? "bg-primary border-primary text-primary-foreground" : "border-input"}`}>
                      {selected && <Check className="h-3 w-3" />}
                    </div>
                    <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
                      {product.imageUrl ? <img src={product.imageUrl} alt="" className="h-8 w-8 rounded object-cover" /> : <span className="text-xs">📦</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground">₱{product.price} · {product.stock} in stock</p>
                    </div>
                  </button>
                )
              })}
              {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">No products found</p>}
            </div>
          </CardContent>
        </Card>
      )}

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? "Saving..." : "Save Delivery Settings"}
      </Button>
    </div>
  )
}
