"use client"

import { useState } from "react"
import Image from "next/image"
import { Edit, Trash2, AlertTriangle, PackagePlus, History } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { EditProductDialog } from "./edit-product-dialog"
import { StockAdjustmentDialog } from "./stock-adjustment-dialog"
import { InventoryHistoryDialog } from "./inventory-history-dialog"
import { deleteProduct, deleteProductImage } from "@/lib/firebase/services"
import type { Product, Category } from "@/lib/firebase/types"
import { useToast } from "@/hooks/use-toast"

interface ProductListProps {
  products: Product[]
  categories: Category[]
  onUpdate: () => void
  isLoading: boolean
}

export function ProductList({ products, categories, onUpdate, isLoading }: ProductListProps) {
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null)
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null)
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null)
  const { toast } = useToast()

  const handleDelete = async () => {
    if (!deletingProduct) return

    try {
      if (deletingProduct.imageUrl) {
        await deleteProductImage(deletingProduct.imageUrl)
      }
      await deleteProduct(deletingProduct.id!)
      toast({
        title: "Product deleted",
        description: "Product has been successfully removed",
      })
      onUpdate()
    } catch (error) {
      console.error("[v0] Error deleting product:", error)
      toast({
        title: "Error",
        description: "Failed to delete product",
        variant: "destructive",
      })
    } finally {
      setDeletingProduct(null)
    }
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-48 bg-muted rounded-md mb-4" />
              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
              <div className="h-4 bg-muted rounded w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-semibold mb-2">No products found</p>
          <p className="text-sm text-muted-foreground">Add your first product to get started</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <Card key={product.id} className="overflow-hidden">
            <div className="relative h-48 bg-muted">
              {product.imageUrl ? (
                <Image
                  src={product.imageUrl || "/placeholder.svg"}
                  alt={product.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <span className="text-6xl text-muted-foreground">📦</span>
                </div>
              )}
              {product.stock <= 10 && (
                <Badge variant="destructive" className="absolute top-2 right-2">
                  Low Stock
                </Badge>
              )}
            </div>
            <CardContent className="p-4">
              <div className="mb-2 flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{product.name}</h3>
                  <p className="text-sm text-muted-foreground">₱{product.price.toFixed(2)}</p>
                </div>
              </div>
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Stock:</span>
                <span className={`font-semibold ${product.stock <= 10 ? "text-destructive" : ""}`}>
                  {product.stock}
                </span>
              </div>
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Barcode:</span>
                <span className="font-mono text-xs">{product.barcode}</span>
              </div>
              <Badge variant="outline" className="mb-3">
                {product.category}
              </Badge>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-transparent"
                  onClick={() => setAdjustingProduct(product)}
                >
                  <PackagePlus className="h-3 w-3 mr-1" />
                  Adjust
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-transparent"
                  onClick={() => setHistoryProduct(product)}
                >
                  <History className="h-3 w-3 mr-1" />
                  History
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 bg-transparent"
                  onClick={() => setEditingProduct(product)}
                >
                  <Edit className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive bg-transparent"
                  onClick={() => setDeletingProduct(product)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {editingProduct && (
        <EditProductDialog
          product={editingProduct}
          categories={categories}
          open={!!editingProduct}
          onOpenChange={(open) => !open && setEditingProduct(null)}
          onSuccess={onUpdate}
        />
      )}

      {adjustingProduct && (
        <StockAdjustmentDialog
          product={adjustingProduct}
          open={!!adjustingProduct}
          onOpenChange={(open) => !open && setAdjustingProduct(null)}
          onSuccess={onUpdate}
        />
      )}

      {historyProduct && (
        <InventoryHistoryDialog
          product={historyProduct}
          open={!!historyProduct}
          onOpenChange={(open) => !open && setHistoryProduct(null)}
        />
      )}

      <AlertDialog open={!!deletingProduct} onOpenChange={(open) => !open && setDeletingProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingProduct?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
