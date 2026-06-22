"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Camera, Barcode, Tag, Plus, X } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { updateProduct, uploadProductImage, deleteProductImage } from "@/lib/firebase/services"
import type { Product, Category } from "@/lib/firebase/types"
import { useToast } from "@/hooks/use-toast"
import { BarcodeScanner } from "./barcode-scanner"
import { cropImageToSquare } from "@/lib/crop-image"
import { useBusinessConfig } from "@/hooks/use-business-config"

interface EditProductDialogProps {
  product: Product
  categories: Category[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function EditProductDialog({ product, categories, open, onOpenChange, onSuccess }: EditProductDialogProps) {
  const cfg = useBusinessConfig()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(product.imageUrl || null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    name: product.name,
    barcode: product.barcode,
    price: product.price.toString(),
    cost: product.cost.toString(),
    stock: product.stock.toString(),
    unit: product.unit || "",
    category: product.category,
    description: product.description || "",
    onSale: product.onSale || false,
    salePrice: product.salePrice?.toString() || "",
    sku: product.sku || "",
    weight: product.weight?.toString() || "",
    dimLength: product.dimensions?.length?.toString() || "",
    dimWidth: product.dimensions?.width?.toString() || "",
    dimHeight: product.dimensions?.height?.toString() || "",
    shippingClass: product.shippingClass || "standard" as "standard" | "bulky" | "fragile" | "digital",
  })
  const [variants, setVariants] = useState<{ name: string; options: string }[]>(
    product.variants?.map(v => ({ name: v.name, options: v.options.join(", ") })) ?? []
  )

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const cropped = await cropImageToSquare(file)
      setImageFile(cropped)
      const reader = new FileReader()
      reader.onloadend = () => setImagePreview(reader.result as string)
      reader.readAsDataURL(cropped)
    }
  }

  const handleBarcodeScanned = (barcode: string) => {
    setFormData({ ...formData, barcode })
    setShowScanner(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const isEcommerce = cfg.type === "ecommerce"
      const updates: Partial<Product> = {
        name: formData.name,
        barcode: formData.barcode,
        price: Number.parseFloat(formData.price),
        cost: Number.parseFloat(formData.cost),
        stock: Number.parseInt(formData.stock),
        unit: formData.unit || undefined,
        category: formData.category,
        description: formData.description,
        onSale: formData.onSale,
        salePrice: formData.onSale && formData.salePrice ? Number.parseFloat(formData.salePrice) : undefined,
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
      }

      // Handle image update
      if (imageFile) {
        // Delete old image if exists
        if (product.imageUrl) {
          await deleteProductImage(product.imageUrl)
        }
        // Upload new image
        const imageUrl = await uploadProductImage(imageFile, product.id!)
        updates.imageUrl = imageUrl
      }

      await updateProduct(product.id!, updates)

      toast({
        title: "Product updated",
        description: "Product has been successfully updated",
      })

      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error("[v0] Error updating product:", error)
      toast({
        title: "Error",
        description: "Failed to update product",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>Update product information</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Product Image</Label>
              <div className="flex gap-4">
                <div
                  className="flex h-32 w-32 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border hover:border-primary transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {imagePreview ? (
                    <img
                      src={imagePreview || "/placeholder.svg"}
                      alt="Preview"
                      className="h-full w-full object-cover rounded-lg"
                    />
                  ) : (
                    <Camera className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    Change Image
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="border-blue-300 text-blue-600 hover:bg-blue-50" onClick={() => cameraInputRef.current?.click()}>
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
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageChange} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-name">{cfg.itemLabel} Name *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-barcode">Barcode *</Label>
                <div className="flex gap-2">
                  <Input
                    id="edit-barcode"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    required
                  />
                  <Button type="button" variant="outline" size="icon" onClick={() => setShowScanner(true)}>
                    <Barcode className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-price">{cfg.priceLabel} (₱) *</Label>
                <Input
                  id="edit-price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-cost">{cfg.costLabel} (₱) *</Label>
                <Input
                  id="edit-cost"
                  type="number"
                  step="0.01"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                  required
                />
              </div>

              <div className="col-span-2 space-y-3 rounded-lg border border-orange-200 bg-orange-50 p-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2 text-orange-700 font-semibold">
                    <Tag className="h-4 w-4" /> On Sale
                  </Label>
                  <Switch
                    checked={formData.onSale}
                    onCheckedChange={(v) => setFormData({ ...formData, onSale: v })}
                  />
                </div>
                {formData.onSale && (
                  <div className="space-y-1">
                    <Label htmlFor="edit-sale-price" className="text-sm text-orange-700">Sale Price (₱)</Label>
                    <Input
                      id="edit-sale-price"
                      type="number"
                      step="0.01"
                      placeholder="Enter sale price"
                      value={formData.salePrice}
                      onChange={(e) => setFormData({ ...formData, salePrice: e.target.value })}
                      className="border-orange-300"
                    />
                    {formData.salePrice && formData.price && (
                      <p className="text-xs text-orange-600">
                        Original: <span className="line-through">₱{formData.price}</span> → Sale: ₱{formData.salePrice}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-stock">{cfg.stockLabel} *</Label>
                <Input
                  id="edit-stock"
                  type="number"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-unit">Unit</Label>
                <Select
                  value={formData.unit}
                  onValueChange={(value) => setFormData({ ...formData, unit: value })}
                >
                  <SelectTrigger id="edit-unit">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {cfg.units.map(u => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-category">Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.name}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            {/* E-commerce specific fields */}
            {cfg.type === "ecommerce" && (
              <div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm font-semibold text-blue-700">🛒 E-Commerce Details</p>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-sku">SKU (Stock Keeping Unit)</Label>
                    <Input id="edit-sku" value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value })} placeholder="e.g. SHIRT-RED-M" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-weight">Weight (grams)</Label>
                    <Input id="edit-weight" type="number" value={formData.weight} onChange={e => setFormData({ ...formData, weight: e.target.value })} placeholder="e.g. 250" />
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
                    <Label htmlFor="edit-shippingClass">Shipping Class</Label>
                    <Select value={formData.shippingClass} onValueChange={v => setFormData({ ...formData, shippingClass: v as any })}>
                      <SelectTrigger id="edit-shippingClass"><SelectValue /></SelectTrigger>
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

            {/* Variants — always visible */}
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Product Variants <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
                  onClick={() => setVariants(v => [...v, { name: "", options: "" }])}>
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
              {variants.map((v, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input placeholder="e.g. Color" value={v.name} className="flex-[2]"
                    onChange={e => setVariants(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                  <Input placeholder="e.g. Red,Blue,Black" value={v.options} className="flex-[3]"
                    onChange={e => setVariants(prev => prev.map((x, j) => j === i ? { ...x, options: e.target.value } : x))} />
                  <Button type="button" variant="ghost" size="icon" className="shrink-0 text-destructive h-8 w-8"
                    onClick={() => setVariants(prev => prev.filter((_, j) => j !== i))}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {variants.length === 0 && <p className="text-[12px] text-muted-foreground">Add if product has different colors, sizes, flavors, etc.</p>}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Updating..." : "Update Product"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {showScanner && <BarcodeScanner onScan={handleBarcodeScanned} onClose={() => setShowScanner(false)} />}
    </>
  )
}
