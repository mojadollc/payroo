"use client"

import type React from "react"

import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import type { Category } from "@/lib/firebase/types"
import { useToast } from "@/hooks/use-toast"
import { getStoreId } from "@/lib/store-id"

interface CategoryManagerProps {
  categories: Category[]
  onUpdate: () => void
}

export function CategoryManager({ categories = [], onUpdate }: CategoryManagerProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null)
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    name: "",
    description: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Category name is required",
        variant: "destructive",
      })
      return
    }

    setIsAdding(true)
    try {
      const storeId = getStoreId()
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, name: formData.name.trim(), description: formData.description.trim() }),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Failed to add category")
      toast({ title: "Success", description: "Category has been added successfully" })
      setFormData({ name: "", description: "" })
      onUpdate()
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to add category", variant: "destructive" })
    } finally {
      setIsAdding(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingCategory) return

    try {
      await fetch(`/api/categories?id=${deletingCategory.id}`, { method: "DELETE" })
      toast({ title: "Success", description: "Category has been deleted successfully" })
      onUpdate()
    } catch (error) {
      console.error("[v0] Error deleting category:", error)
      toast({ title: "Error", description: "Failed to delete category", variant: "destructive" })
    } finally {
      setDeletingCategory(null)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <h3 className="mb-4 text-lg font-semibold">Add New Category</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="category-name">Category Name *</Label>
                <Input
                  id="category-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category-description">Description</Label>
                <Input
                  id="category-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>
            <Button type="submit" disabled={isAdding} className="gap-2">
              <Plus className="h-4 w-4" />
              {isAdding ? "Adding..." : "Add Category"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <Card key={category.id}>
            <CardContent className="p-4">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h4 className="font-semibold">{category.name}</h4>
                  {category.description && <p className="text-sm text-muted-foreground mt-1">{category.description}</p>}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive -mr-2"
                  onClick={() => setDeletingCategory(category)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!deletingCategory} onOpenChange={(open) => !open && setDeletingCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingCategory?.name}"? This action cannot be undone.
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
    </div>
  )
}
