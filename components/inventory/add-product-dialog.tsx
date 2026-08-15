"use client"

import type React from "react"
import { useState, useRef, useCallback } from "react"
import { Camera, Barcode, Shuffle, Plus, X } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Category } from "@/lib/firebase/types"
import { useToast } from "@/hooks/use-toast"
import { BarcodeScanner } from "./barcode-scanner"
import { useHardwareScanner } from "@/hooks/use-hardware-scanner"
import { cropImageToSquare } from "@/lib/crop-image"
import { useBusinessConfig } from "@/hooks/use-business-config"
import { getStoreId } from "@/lib/store-id"

interface AddProductDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Category[]
  onSuccess: () => void
}

function looksLikeFilePath(val: string) {
  return (
    val.includes("fakepath") ||
    val.includes("\\") ||
    /[A-Za-z]:\//.test(val) ||
    (val.startsWith("/") && !val.startsWith("/api/") && val.length > 40)
  )
}

export function AddProductDialog({ open, onOpenChange, categories, onSuccess }: AddProductDialogProps) {
  const cfg = useBusinessConfig()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [imageUploading, setImageUploading] = useState(false)

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const barcodeSnapshotRef = useRef("")
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    name: "", barcode: "", price: "", cost: "", stock: "",
    unit: cfg.stockUnit, category: "", description: "",
    sku: "", weight: "", dimLength: "", dimWidth: "", dimHeight: "",
    shippingClass: "standard" as "standard" | "bulky" | "fragile" | "digital",
  })
  const [variants, setVariants] = useState<{ name: string; options: string }[]>([])

  const unitDefault = cfg.stockUnit

  const handleBarcodeScanned = useCallback(async (barcode: string) => {
    const clean = barcode.trim()
    if (!clean || looksLikeFilePath(clean)) return
    setFormData(prev => ({ ...prev, barcode: clean }))
    setShowScanner(false)

    // Reject if barcode already exists in this store
    try {
      const storeId = getStoreId()
      const res = await fetch(`/api/products?storeId=${storeId}&barcode=${encodeURIComponent(clean)}`)
      const { data: existing } = await res.json()
      if (existing) {
        toast({ title: "Barcode already in use", description: `Already used by: ${existing.name}`, variant: "destructive" })
        return
      }
    } catch {
      // offline — allow and check again on submit
    }

    // Auto-lookup product info from Open Food Facts
    try {
      const urls = [
        `https://ph.openfoodfacts.org/api/v0/product/${clean}.json`,
        `https://world.openfoodfacts.org/api/v0/product/${clean}.json`,
      ]
      for (const url of urls) {
        const res = await fetch(url)
        const data = await res.json()
        if (data.status === 1 && data.product) {
          const name = data.product.product_name_en || data.product.product_name || ""
          if (name) {
            setFormData(prev => ({
              ...prev,
              barcode: clean,
              name: prev.name || name,
              category: prev.category || data.product.categories_tags?.[0]?.replace("en:", "") || prev.category,
            }))
            toast({ title: "Product found", description: name })
            break
          }
        }
      }
    } catch {
      // network optional
    }
  }, [toast])

  // Hardware barcode scanner support (USB OTG)
  useHardwareScanner({
    onScan: (barcode) => {
      if (open && !showScanner) handleBarcodeScanned(barcode)
    },
    enabled: open && !showScanner,
  })

  const openFilePicker = (ref: React.RefObject<HTMLInputElement | null>) => {
    // Snapshot barcode before file dialog — Android WebView can corrupt nearby inputs
    barcodeSnapshotRef.current = formData.barcode
    ;(document.activeElement as HTMLElement)?.blur()
    setTimeout(() => ref.current?.click(), 50)
  }

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = "" // allow re-selecting same file
    if (!file) return

    const barcodeSnapshot = barcodeSnapshotRef.current || formData.barcode

    if (file.size > 8 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Maximum size is 8 MB", variant: "destructive" })
      return
    }

    if (!file.type.startsWith("image/") && !file.name.match(/\.(jpe?g|png|webp|gif|heic)$/i)) {
      toast({ title: "Invalid file", description: "Please choose an image", variant: "destructive" })
      return
    }

    setImageUploading(true)
    try {
      let cropped: File
      try {
        cropped = await cropImageToSquare(file)
      } catch {
        // cropImageToSquare failed — use raw file
        cropped = file
      }
      setImageFile(cropped)
      const reader = new FileReader()
      reader.onloadend = () => setImagePreview(reader.result as string)
      reader.readAsDataURL(cropped)
    } catch (err) {
      console.error("[add-product] image process failed:", err)
      toast({
        title: "Image processing failed",
        description: err instanceof Error ? err.message : "Try a different photo",
        variant: "destructive",
      })
    } finally {
      setImageUploading(false)
      // Restore barcode if WebView injected a file path
      setTimeout(() => {
        setFormData(prev => {
          if (looksLikeFilePath(prev.barcode)) {
            return { ...prev, barcode: barcodeSnapshot }
          }
          return prev
        })
      }, 150)
    }
  }

  const generateBarcode = () => {
    const code = Array.from({ length: 11 }, () => Math.floor(Math.random() * 10)).join("")
    const digits = code.split("").map(Number)
    const check = (10 - (digits.reduce((s, d, i) => s + d * (i % 2 === 0 ? 1 : 3), 0) % 10)) % 10
    setFormData(prev => ({ ...prev, barcode: code + check }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      toast({ title: "Validation Error", description: `${cfg.itemLabel} name is required`, variant: "destructive" })
      return
    }
    if (cfg.barcodeRequired && !formData.barcode.trim()) {
      toast({ title: "Validation Error", description: "Barcode is required", variant: "destructive" })
      return
    }
    if (looksLikeFilePath(formData.barcode)) {
      toast({ title: "Invalid barcode", description: "Barcode looks like a file path — please re-scan or type it", variant: "destructive" })
      return
    }

    const price = Number.parseFloat(formData.price)
    const cost = Number.parseFloat(formData.cost)
    const stock = cfg.trackStock ? Number.parseInt(formData.stock) : 999
    if (isNaN(price) || price <= 0) {
      toast({ title: "Validation Error", description: `Enter a valid ${cfg.priceLabel.toLowerCase()}`, variant: "destructive" })
      return
    }
    if (isNaN(cost) || cost < 0) {
      toast({ title: "Validation Error", description: `Enter a valid ${cfg.costLabel.toLowerCase()}`, variant: "destructive" })
      return
    }
    if (!formData.category) {
      toast({ title: "Validation Error", description: "Please select a category", variant: "destructive" })
      return
    }

    const barcode = formData.barcode.trim() || `AUTO-${Date.now()}`

    // Unique barcode check
    if (formData.barcode.trim()) {
      try {
        const storeId = getStoreId()
        const res = await fetch(`/api/products?storeId=${storeId}&barcode=${encodeURIComponent(barcode)}`)
        const { data: existing } = await res.json()
        if (existing) {
          toast({ title: "Barcode already in use", description: `Already used by: ${existing.name}`, variant: "destructive" })
          return
        }
      } catch {
        // offline — proceed
      }
    }

    setIsSubmitting(true)
    try {
      const storeId = getStoreId()
      const isEcommerce = cfg.type === "ecommerce"
      const productData: any = {
        storeId,
        name: formData.name.trim(),
        barcode,
        price,
        cost,
        stock,
        unit: formData.unit || unitDefault,
        category: formData.category,
        description: formData.description.trim(),
        ...(isEcommerce && {
          sku: formData.sku.trim() || undefined,
          weight: formData.weight ? Number(formData.weight) : undefined,
          dimensions: formData.dimLength && formData.dimWidth && formData.dimHeight
            ? { length: Number(formData.dimLength), width: Number(formData.dimWidth), height: Number(formData.dimHeight) }
            : undefined,
          shippingClass: formData.shippingClass,
          variants: variants.filter(v => v.name.trim() && v.options.trim()).map(v => ({ name: v.name.trim(), options: v.options.split(",").map(o => o.trim()).filter(Boolean) })),
        }),
      }

      // Upload image to DO Spaces if present
      if (imageFile) {
        const productId = `prod_${Date.now()}`
        const formData2 = new FormData()
        formData2.append("file", imageFile)
        formData2.append("productId", productId)
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData2 })
        if (!uploadRes.ok) throw new Error("Image upload failed")
        const { url } = await uploadRes.json()
        productData.imageUrl = url
        productData.id = productId
      }

      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productData),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Failed to add product")

      toast({ title: "Success", description: `${cfg.itemLabel} added successfully` })
      setFormData({
        name: "", barcode: "", price: "", cost: "", stock: "",
        unit: unitDefault, category: "", description: "",
        sku: "", weight: "", dimLength: "", dimWidth: "", dimHeight: "",
        shippingClass: "standard",
      })
      setVariants([])
      setImageFile(null)
      setImagePreview(null)
      onSuccess()
      onOpenChange(false)
    } catch (error) {
      const msg = error instanceof Error ? error.message : `Failed to add ${cfg.itemLabel.toLowerCase()}`
      toast({ title: "Error", description: msg, variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const allCategories =
    categories.length > 0
      ? categories
      : cfg.defaultCategories.map((name, i) => ({ id: String(i), name, createdAt: null as any }))

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl w-[calc(100%-2rem)] sm:w-full mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add {cfg.itemLabel}</DialogTitle>
            <DialogDescription>
              Add a new {cfg.itemLabel.toLowerCase()} to your {cfg.type === "food" ? "menu" : "inventory"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Image */}
            <div className="space-y-2">
              <Label>Image</Label>
              <div className="flex gap-4">
                <div
                  className={`flex h-32 w-32 cursor-pointer items-center justify-center rounded-lg overflow-hidden transition-colors ${
                    imagePreview
                      ? "border-0"
                      : "border-2 border-dashed border-border hover:border-primary"
                  }`}
                  onClick={() => openFilePicker(fileInputRef)}
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="h-full w-full object-cover rounded-lg outline-none" />
                  ) : (
                    <Camera className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={imageUploading}
                    onClick={() => openFilePicker(fileInputRef)}
                  >
                    {imageUploading ? "Processing..." : "Choose Image"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-blue-300 text-blue-600 hover:bg-blue-50"
                    disabled={imageUploading}
                    onClick={() => openFilePicker(cameraInputRef)}
                  >
                    <Camera className="h-4 w-4 mr-1" /> Take Photo
                  </Button>
                  {imagePreview && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setImageFile(null)
                        setImagePreview(null)
                      }}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">{cfg.itemLabel} Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="barcode">
                  Barcode / Code {cfg.barcodeRequired ? "*" : "(optional)"}
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="barcode"
                    value={formData.barcode}
                    onChange={e => {
                      const val = e.target.value
                      if (looksLikeFilePath(val)) return
                      setFormData({ ...formData, barcode: val })
                    }}
                    placeholder={cfg.barcodeRequired ? "Scan, type, or generate" : "Optional code"}
                    required={cfg.barcodeRequired}
                    autoComplete="off"
                  />
                  <Button type="button" variant="outline" size="icon" title="Generate" onClick={generateBarcode}>
                    <Shuffle className="h-4 w-4 text-violet-500" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="border-blue-300 hover:bg-blue-50"
                    onClick={() => setShowScanner(true)}
                  >
                    <Barcode className="h-4 w-4 text-blue-500" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">{cfg.priceLabel} (₱) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={e => setFormData({ ...formData, price: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cost">{cfg.costLabel} (₱) *</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  value={formData.cost}
                  onChange={e => setFormData({ ...formData, cost: e.target.value })}
                  required
                />
              </div>

              {cfg.trackStock && (
                <div className="space-y-2">
                  <Label htmlFor="stock">{cfg.stockLabel} *</Label>
                  <Input
                    id="stock"
                    type="number"
                    value={formData.stock}
                    onChange={e => setFormData({ ...formData, stock: e.target.value })}
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Select value={formData.unit} onValueChange={v => setFormData({ ...formData, unit: v })}>
                  <SelectTrigger id="unit">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {cfg.units.map(u => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select value={formData.category} onValueChange={v => setFormData({ ...formData, category: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {allCategories.map(c => (
                      <SelectItem key={c.id ?? c.name} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description / Notes</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>

            {cfg.type === "ecommerce" && (
              <div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm font-semibold text-blue-700">🛒 E-Commerce Details</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU (Stock Keeping Unit)</Label>
                    <Input
                      id="sku"
                      value={formData.sku}
                      onChange={e => setFormData({ ...formData, sku: e.target.value })}
                      placeholder="e.g. SHIRT-RED-M"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weight">Weight (grams)</Label>
                    <Input
                      id="weight"
                      type="number"
                      value={formData.weight}
                      onChange={e => setFormData({ ...formData, weight: e.target.value })}
                      placeholder="e.g. 250"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Dimensions (cm) — L × W × H</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Length"
                        type="number"
                        value={formData.dimLength}
                        onChange={e => setFormData({ ...formData, dimLength: e.target.value })}
                      />
                      <Input
                        placeholder="Width"
                        type="number"
                        value={formData.dimWidth}
                        onChange={e => setFormData({ ...formData, dimWidth: e.target.value })}
                      />
                      <Input
                        placeholder="Height"
                        type="number"
                        value={formData.dimHeight}
                        onChange={e => setFormData({ ...formData, dimHeight: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shippingClass">Shipping Class</Label>
                    <Select
                      value={formData.shippingClass}
                      onValueChange={v => setFormData({ ...formData, shippingClass: v as any })}
                    >
                      <SelectTrigger id="shippingClass">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">📦 Standard</SelectItem>
                        <SelectItem value="bulky">🏗️ Bulky / Heavy</SelectItem>
                        <SelectItem value="fragile">🫙 Fragile</SelectItem>
                        <SelectItem value="digital">💾 Digital / No Shipping</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">
                  Product Variants <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setVariants(v => [...v, { name: "", options: "" }])}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
              {variants.map((v, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input
                    placeholder="e.g. Color"
                    value={v.name}
                    className="flex-[2]"
                    onChange={e =>
                      setVariants(prev => prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                    }
                  />
                  <Input
                    placeholder="e.g. Red,Blue,Black"
                    value={v.options}
                    className="flex-[3]"
                    onChange={e =>
                      setVariants(prev => prev.map((x, j) => (j === i ? { ...x, options: e.target.value } : x)))
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-destructive h-8 w-8"
                    onClick={() => setVariants(prev => prev.filter((_, j) => j !== i))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {variants.length === 0 && (
                <p className="text-[12px] text-muted-foreground">
                  Add if product has different colors, sizes, flavors, etc.
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || imageUploading}>
                {isSubmitting ? "Adding..." : `Add ${cfg.itemLabel}`}
              </Button>
            </DialogFooter>
          </form>

          {/* File inputs OUTSIDE form to prevent file path leaking into form fields */}
          <div aria-hidden="true" className="absolute -z-10 opacity-0 pointer-events-none overflow-hidden h-0 w-0">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              tabIndex={-1}
              onChange={handleImageChange}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              tabIndex={-1}
              onChange={handleImageChange}
            />
          </div>
        </DialogContent>
      </Dialog>

      {showScanner && (
        <BarcodeScanner onScan={handleBarcodeScanned} onClose={() => setShowScanner(false)} />
      )}
    </>
  )
}
