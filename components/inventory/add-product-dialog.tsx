"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Camera, Barcode, Shuffle, Plus, X } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { addProduct, uploadProductImage, updateProduct } from "@/lib/firebase/services"
import type { Category } from "@/lib/firebase/types"
import { useToast } from "@/hooks/use-toast"
import { BarcodeScanner } from "./barcode-scanner"
import { useHardwareScanner } from "@/hooks/use-hardware-scanner"
import { cropImageToSquare } from "@/lib/crop-image"
import { useBusinessConfig } from "@/hooks/use-business-config"

interface AddProductDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Category[]
  onSuccess: () => void
}

export function AddProductDialog({ open, onOpenChange, categories, onSuccess }: AddProductDialogProps) {
  const cfg = useBusinessConfig()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showScanner, setShowScanner] = useState(false)

  // Hardware barcode scanner support (USB OTG)
  useHardwareScanner({
    onScan: (barcode) => {
      if (open && !showScanner) handleBarcodeScanned(barcode)
    },
    enabled: open,
  })

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    name: "", barcode: "", price: "", cost: "", stock: "",
    unit: cfg.stockUnit, category: "", description: "",
    sku: "", weight: "", dimLength: "", dimWidth: "", dimHeight: "",
    shippingClass: "standard" as "standard" | "bulky" | "fragile" | "digital",
  })
  const [variants, setVariants] = useState<{ name: string; options: string }[]>([])

  // Reset unit default when config changes
  const unitDefault = cfg.stockUnit

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    // Snapshot current barcode to restore if browser corrupts it
    const currentBarcode = formData.barcode
    const cropped = await cropImageToSquare(file)
    setImageFile(cropped)
    const reader = new FileReader()
    reader.onloadend = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(cropped)
    // Restore barcode in case Android WebView injected file path
    setTimeout(() => {
      setFormData(prev => {
        if (prev.barcode.includes("fakepath") || prev.barcode.includes("\\") || prev.barcode.includes("/")) {
          return { ...prev, barcode: currentBarcode }
        }
        return prev
      })
    }, 100)
  }

  const generateBarcode = () => {
    const code = Array.from({ length: 11 }, () => Math.floor(Math.random() * 10)).join("")
    const digits = code.split("").map(Number)
    const check = (10 - (digits.reduce((s, d, i) => s + d * (i % 2 === 0 ? 1 : 3), 0) % 10)) % 10
    setFormData(prev => ({ ...prev, barcode: code + check }))
  }

  const handleBarcodeScanned = async (barcode: string) => {
    setFormData(prev => ({ ...prev, barcode }))
    setShowScanner(false)
    // Auto-lookup product info from Open Food Facts
    try {
      const urls = [
        `https://ph.openfoodfacts.org/api/v0/product/${barcode}.json`,
        `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
      ]
      for (const url of urls) {
        const res = await fetch(url)
        const data = await res.json()
        if (data.status === 1 && data.product) {
          const name = data.product.product_name_en || data.product.product_name || ""
          if (name) {
            setFormData(prev => ({
              ...prev,
              barcode,
              name: prev.name || name,
              category: prev.category || data.product.categories_tags?.[0]?.replace("en:", "") || prev.category,
            }))
            toast({ title: "Product found", description: name })
            break
          }
        }
      }
    } catch {}
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      toast({ title: "Validation Error", description: `${cfg.itemLabel} name is required`, variant: "destructive" }); return
    }
    if (cfg.barcodeRequired && !formData.barcode.trim()) {
      toast({ title: "Validation Error", description: "Barcode is required", variant: "destructive" }); return
    }
    const price = Number.parseFloat(formData.price)
    const cost = Number.parseFloat(formData.cost)
    const stock = cfg.trackStock ? Number.parseInt(formData.stock) : 999
    if (isNaN(price) || price <= 0) {
      toast({ title: "Validation Error", description: `Enter a valid ${cfg.priceLabel.toLowerCase()}`, variant: "destructive" }); return
    }
    if (isNaN(cost) || cost < 0) {
      toast({ title: "Validation Error", description: `Enter a valid ${cfg.costLabel.toLowerCase()}`, variant: "destructive" }); return
    }
    if (!formData.category) {
      toast({ title: "Validation Error", description: "Please select a category", variant: "destructive" }); return
    }
    setIsSubmitting(true)
    try {
      const isEcommerce = cfg.type === "ecommerce"
      const productId = await addProduct({
        name: formData.name.trim(),
        barcode: formData.barcode.trim() || `AUTO-${Date.now()}`,
        price, cost, stock,
        unit: formData.unit || unitDefault,
        category: formData.category,
        description: formData.description.trim(),
        ...(isEcommerce && {
          sku: formData.sku.trim() || undefined,
          weight: formData.weight ? Number(formData.weight) : undefined,
          dimensions: (formData.dimLength && formData.dimWidth && formData.dimHeight) ? {
            length: Number(formData.dimLength),
            width: Number(formData.dimWidth),
            height: Number(formData.dimHeight),
          } : undefined,
          shippingClass: formData.shippingClass,
          variants: variants
            .filter(v => v.name.trim() && v.options.trim())
            .map(v => ({ name: v.name.trim(), options: v.options.split(",").map(o => o.trim()).filter(Boolean) })),
        }),
      })
      if (imageFile) {
        const imageUrl = await uploadProductImage(imageFile, productId)
        await updateProduct(productId, { imageUrl })
      }
      toast({ title: "Success", description: `${cfg.itemLabel} added successfully` })
      setFormData({ name: "", barcode: "", price: "", cost: "", stock: "", unit: unitDefault, category: "", description: "", sku: "", weight: "", dimLength: "", dimWidth: "", dimHeight: "", shippingClass: "standard" })
      setVariants([])
      setImageFile(null); setImagePreview(null)
      onSuccess(); onOpenChange(false)
    } catch (error) {
      const msg = error instanceof Error ? error.message : `Failed to add ${cfg.itemLabel.toLowerCase()}`
      toast({ title: "Error", description: msg, variant: "destructive" })
    } finally { setIsSubmitting(false) }
  }

  // Merge default categories with existing ones
  const allCategories = categories.length > 0
    ? categories
    : cfg.defaultCategories.map((name, i) => ({ id: String(i), name, createdAt: null as any }))

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl w-[calc(100%-2rem)] sm:w-full mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add {cfg.itemLabel}</DialogTitle>
            <DialogDescription>Add a new {cfg.itemLabel.toLowerCase()} to your {cfg.type === "food" ? "menu" : "inventory"}</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Image */}
            <div className="space-y-2">
              <Label>Image</Label>
              <div className="flex gap-4">
                <div
                  className="flex h-32 w-32 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border hover:border-primary transition-colors"
                  onClick={() => { (document.activeElement as HTMLElement)?.blur(); setTimeout(() => fileInputRef.current?.click(), 50) }}
                >
                  {imagePreview
                    ? <img src={imagePreview} alt="Preview" className="h-full w-full object-cover rounded-lg" />
                    : <Camera className="h-8 w-8 text-muted-foreground" />}
                </div>
                <div className="flex flex-col gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => { (document.activeElement as HTMLElement)?.blur(); setTimeout(() => fileInputRef.current?.click(), 50) }}>Choose Image</Button>
                  <Button type="button" variant="outline" size="sm" className="border-blue-300 text-blue-600 hover:bg-blue-50" onClick={() => { (document.activeElement as HTMLElement)?.blur(); setTimeout(() => cameraInputRef.current?.click(), 50) }}>
                    <Camera className="h-4 w-4 mr-1" /> Take Photo
                  </Button>
                  {imagePreview && <Button type="button" variant="outline" size="sm" onClick={() => { setImageFile(null); setImagePreview(null) }}>Remove</Button>}
                </div>
              </div>

            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">{cfg.itemLabel} Name *</Label>
                <Input id="name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
              </div>

              {/* Barcode — shown for all but optional for non-retail */}
              <div className="space-y-2">
                <Label htmlFor="barcode">Barcode / Code {cfg.barcodeRequired ? "*" : "(optional)"}</Label>
                <div className="flex gap-2">
                  <Input
                    id="barcode"
                    value={formData.barcode}
                    onChange={e => {
                      const val = e.target.value
                      if (val.includes("fakepath") || val.includes("\\") || val.includes("C:")) return
                      setFormData({ ...formData, barcode: val })
                    }}
                    placeholder={cfg.barcodeRequired ? "Scan, type, or generate" : "Optional code"}
                    required={cfg.barcodeRequired}
                  />
                  <Button type="button" variant="outline" size="icon" title="Generate" onClick={generateBarcode}>
                    <Shuffle className="h-4 w-4 text-violet-500" />
                  </Button>
                  <Button type="button" variant="outline" size="icon" className="border-blue-300 hover:bg-blue-50" onClick={() => setShowScanner(true)}>
                    <Barcode className="h-4 w-4 text-blue-500" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">{cfg.priceLabel} (₱) *</Label>
                <Input id="price" type="number" step="0.01" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cost">{cfg.costLabel} (₱) *</Label>
                <Input id="cost" type="number" step="0.01" value={formData.cost} onChange={e => setFormData({ ...formData, cost: e.target.value })} required />
              </div>

              {/* Stock — hidden for service-only businesses */}
              {cfg.trackStock && (
                <div className="space-y-2">
                  <Label htmlFor="stock">{cfg.stockLabel} *</Label>
                  <Input id="stock" type="number" value={formData.stock} onChange={e => setFormData({ ...formData, stock: e.target.value })} required />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Select value={formData.unit} onValueChange={v => setFormData({ ...formData, unit: v })}>
                  <SelectTrigger id="unit"><SelectValue placeholder="Select unit" /></SelectTrigger>
                  <SelectContent>
                    {cfg.units.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select value={formData.category} onValueChange={v => setFormData({ ...formData, category: v })}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {allCategories.map(c => <SelectItem key={c.id ?? c.name} value={c.name}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description / Notes</Label>
              <Textarea id="description" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={2} />
            </div>

            {/* E-commerce specific fields */}
            {cfg.type === "ecommerce" && (
              <div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm font-semibold text-blue-700">🛒 E-Commerce Details</p>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU (Stock Keeping Unit)</Label>
                    <Input id="sku" value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value })} placeholder="e.g. SHIRT-RED-M" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="weight">Weight (grams)</Label>
                    <Input id="weight" type="number" value={formData.weight} onChange={e => setFormData({ ...formData, weight: e.target.value })} placeholder="e.g. 250" />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Dimensions (cm) — L × W × H</Label>
                    <div className="flex gap-2">
                      <Input placeholder="Length" type="number" value={formData.dimLength} onChange={e => setFormData({ ...formData, dimLength: e.target.value })} />
                      <Input placeholder="Width" type="number" value={formData.dimWidth} onChange={e => setFormData({ ...formData, dimWidth: e.target.value })} />
                      <Input placeholder="Height" type="number" value={formData.dimHeight} onChange={e => setFormData({ ...formData, dimHeight: e.target.value })} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="shippingClass">Shipping Class</Label>
                    <Select value={formData.shippingClass} onValueChange={v => setFormData({ ...formData, shippingClass: v as any })}>
                      <SelectTrigger id="shippingClass"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">📦 Standard</SelectItem>
                        <SelectItem value="bulky">🏗️ Bulky / Heavy</SelectItem>
                        <SelectItem value="fragile">🫙 Fragile</SelectItem>
                        <SelectItem value="digital">💾 Digital / No Shipping</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Variants */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Product Variants (e.g. Size, Color)</Label>
                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs border-blue-300 text-blue-700"
                      onClick={() => setVariants(v => [...v, { name: "", options: "" }])}>
                      <Plus className="h-3 w-3 mr-1" /> Add Variant
                    </Button>
                  </div>
                  {variants.map((v, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Input placeholder="Variant name (e.g. Size)" value={v.name}
                        onChange={e => setVariants(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                      <Input placeholder="Options, comma-separated (e.g. S,M,L,XL)" value={v.options}
                        onChange={e => setVariants(prev => prev.map((x, j) => j === i ? { ...x, options: e.target.value } : x))} />
                      <Button type="button" variant="ghost" size="icon" className="shrink-0 text-destructive"
                        onClick={() => setVariants(prev => prev.filter((_, j) => j !== i))}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {variants.length === 0 && <p className="text-xs text-muted-foreground">No variants added. Add if product comes in different sizes, colors, etc.</p>}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Adding..." : `Add ${cfg.itemLabel}`}</Button>
            </DialogFooter>
          </form>
          {/* File inputs OUTSIDE form to prevent file path leaking into form fields */}
          <div aria-hidden="true" className="absolute -z-10 opacity-0 pointer-events-none overflow-hidden h-0 w-0">
            <input ref={fileInputRef} type="file" accept="image/*" tabIndex={-1} onChange={handleImageChange} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" tabIndex={-1} onChange={handleImageChange} />
          </div>
        </DialogContent>
      </Dialog>

      {showScanner && <BarcodeScanner onScan={handleBarcodeScanned} onClose={() => setShowScanner(false)} />}
    </>
  )
}
