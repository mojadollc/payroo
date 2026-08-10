"use client"

import type React from "react"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Product } from "@/lib/firebase/types"
import { useToast } from "@/hooks/use-toast"
import { getStoreId } from "@/lib/store-id"

interface StockAdjustmentDialogProps {
  product: Product
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function StockAdjustmentDialog({ product, open, onOpenChange, onSuccess }: StockAdjustmentDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    type: "restock" as "restock" | "adjustment",
    quantity: "",
    notes: "",
  })

  const newStock = product.stock + Number.parseInt(formData.quantity || "0")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const storeId = getStoreId()
      const res = await fetch("/api/inventory-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          productId: product.id,
          productName: product.name,
          type: formData.type,
          quantity: Number.parseInt(formData.quantity),
          previousStock: product.stock,
          newStock,
          notes: formData.notes,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Failed to adjust stock")
      toast({ title: "Stock updated", description: "Stock has been successfully adjusted" })
      setFormData({ type: "restock", quantity: "", notes: "" })
      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error("[v0] Error adjusting stock:", error)
      toast({
        title: "Error",
        description: "Failed to adjust stock",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
          <DialogDescription>Update inventory for {product.name}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg bg-muted p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Current Stock</span>
              <span className="font-semibold">{product.stock}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">New Stock</span>
              <span className="font-bold text-primary">{newStock}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="adjustment-type">Transaction Type</Label>
            <Select
              value={formData.type}
              onValueChange={(value: "restock" | "adjustment") => setFormData({ ...formData, type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="restock">Restock</SelectItem>
                <SelectItem value="adjustment">Adjustment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity Change (+ or -)</Label>
            <Input
              id="quantity"
              type="number"
              placeholder="e.g., +50 or -10"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Reason for adjustment..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Updating..." : "Update Stock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
