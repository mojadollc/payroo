"use client"

import { useState, useEffect } from "react"
import { 
  Plus, 
  Search, 
  LayoutGrid, 
  List as ListIcon, 
  Barcode, 
  Download, 
  Printer, 
  Trash2, 
  Edit,
  Package,
  AlertTriangle,
  XCircle,
  DollarSign,
  RefreshCw,
  Upload,
  FileText,
  CheckCircle2,
  XCircle as XCircleIcon,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { getProducts, deleteProduct, getCategories, updateProduct, bulkAddProducts } from "@/lib/firebase/services"
import { Label } from "@/components/ui/label"
import type { Product, Category } from "@/lib/firebase/types"
import { AddProductDialog } from "@/components/inventory/add-product-dialog"
import { EditProductDialog } from "@/components/inventory/edit-product-dialog"
import { CategoryManager } from "@/components/inventory/category-manager"
import { useBusinessConfig } from "@/hooks/use-business-config"
import { useSubscription } from "@/hooks/use-subscription"

// ── CSV helpers ────────────────────────────────────────────────────────────────

const SAMPLE_CSV_HEADERS = ["name", "barcode", "category", "unit", "cost", "price", "stock", "description"]

const SAMPLE_CSV_ROWS = [
  ["Coca-Cola 1.5L", "4902102141123", "Beverages", "bottle", "55", "70", "24", "Softdrink 1.5 liter"],
  ["Lucky Me Pancit Canton", "4800016010016", "Noodles", "pack", "8", "12", "100", "Original flavor"],
  ["Tide Powder 66g", "4902430153003", "Household", "sachet", "10", "15", "50", "Laundry detergent"],
  ["Marlboro Red", "5000159461048", "Tobacco", "stick", "5", "7", "200", "Per stick"],
  ["Kopiko 3-in-1", "8850006110019", "Beverages", "sachet", "6", "9", "80", "Coffee mix"],
]

function downloadSampleCSV() {
  const rows = [SAMPLE_CSV_HEADERS, ...SAMPLE_CSV_ROWS]
  const csv = rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n")
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = "saripos-bulk-upload-sample.csv"
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
}

interface ParsedRow {
  row: number
  name: string
  barcode: string
  category: string
  unit: string
  cost: number
  price: number
  stock: number
  description: string
  errors: string[]
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  // Detect header row
  const header = lines[0].split(",").map(h => h.replace(/^"|"$/g, "").trim().toLowerCase())
  const nameIdx = header.indexOf("name")
  const barcodeIdx = header.indexOf("barcode")
  const categoryIdx = header.indexOf("category")
  const unitIdx = header.indexOf("unit")
  const costIdx = header.indexOf("cost")
  const priceIdx = header.indexOf("price")
  const stockIdx = header.indexOf("stock")
  const descIdx = header.indexOf("description")

  return lines.slice(1).map((line, i) => {
    // Handle quoted CSV fields
    const cols: string[] = []
    let cur = "", inQ = false
    for (let ci = 0; ci < line.length; ci++) {
      const ch = line[ci]
      if (ch === '"') { inQ = !inQ }
      else if (ch === "," && !inQ) { cols.push(cur.trim()); cur = "" }
      else cur += ch
    }
    cols.push(cur.trim())

    const get = (idx: number) => idx >= 0 ? (cols[idx] ?? "").replace(/^"|"$/g, "").trim() : ""
    const errors: string[] = []
    const name = get(nameIdx)
    const barcode = get(barcodeIdx)
    const cost = parseFloat(get(costIdx))
    const price = parseFloat(get(priceIdx))
    const stock = parseInt(get(stockIdx))

    if (!name) errors.push("Name required")
    if (!barcode) errors.push("Barcode required")
    if (isNaN(cost) || cost < 0) errors.push("Invalid cost")
    if (isNaN(price) || price < 0) errors.push("Invalid price")
    if (isNaN(stock) || stock < 0) errors.push("Invalid stock")

    return {
      row: i + 2,
      name, barcode,
      category: get(categoryIdx) || "Uncategorized",
      unit: get(unitIdx) || "pc",
      cost: isNaN(cost) ? 0 : cost,
      price: isNaN(price) ? 0 : price,
      stock: isNaN(stock) ? 0 : stock,
      description: get(descIdx),
      errors,
    }
  }).filter(r => r.name || r.barcode) // skip blank rows
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const cfg = useBusinessConfig()
  const { features, tier } = useSubscription()
  const canExport = features.exportData && tier !== "basic"
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [selectedProductForBarcode, setSelectedProductForBarcode] = useState<Product | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [restockProduct, setRestockProduct] = useState<Product | null>(null)
  const [restockQty, setRestockQty] = useState("")
  // Bulk upload state
  const [bulkOpen, setBulkOpen] = useState(false)
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [bulkUploading, setBulkUploading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadProducts()
    loadCategories()
  }, [])

  const loadProducts = async () => {
    try {
      const data = await getProducts()
      setProducts(data)
    } catch (error) {
      console.error("Error loading products:", error)
    }
  }

  const loadCategories = async () => {
    try {
      const data = await getCategories()
      setCategories(data)
    } catch (error) {
      console.error("Error loading categories:", error)
    }
  }

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return
    try {
      await deleteProduct(id)
      toast({ title: "Product deleted" })
      loadProducts()
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete product", variant: "destructive" })
    }
  }

  // Filter products
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.barcode.includes(searchTerm)
  )

  // Calculate Stock Value (Cost * Stock)
  const totalStockValue = products.reduce((sum, p) => sum + (p.cost * p.stock), 0)
  const totalItems = products.reduce((sum, p) => sum + p.stock, 0)
  const lowStockCount = products.filter(p => p.stock > 0 && p.stock <= 5).length
  const outOfStockCount = products.filter(p => p.stock === 0).length

  // Barcode Actions
  const getBarcodeUrl = (barcode: string) => 
    `https://bwipjs-api.metafloor.com/?bcid=code128&text=${barcode}&scale=3&includetext&backgroundcolor=ffffff`

  const downloadBarcode = async (product: Product) => {
    try {
      const response = await fetch(getBarcodeUrl(product.barcode))
      const blob = await response.blob()
      const barcodeUrl = URL.createObjectURL(blob)
      const img = new Image()
      img.src = barcodeUrl
      img.onload = () => {
        const padding = 12
        const fontSize = 16
        const canvas = document.createElement("canvas")
        canvas.width = img.width
        canvas.height = img.height + fontSize + padding * 2
        const ctx = canvas.getContext("2d")!
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.font = `bold ${fontSize}px sans-serif`
        ctx.fillStyle = "#000000"
        ctx.textAlign = "center"
        ctx.fillText(product.name, canvas.width / 2, fontSize + padding)
        ctx.drawImage(img, 0, fontSize + padding * 2)
        const link = document.createElement("a")
        link.href = canvas.toDataURL("image/png")
        link.download = `${product.name}-barcode.png`
        link.click()
      }
    } catch (e) {
      toast({ title: "Error", description: "Failed to download barcode", variant: "destructive" })
    }
  }

  const printBarcode = (product: Product) => {
    const url = getBarcodeUrl(product.barcode)
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(`
        <html>
          <body style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100vh;margin:0;font-family:sans-serif;">
            <p style="font-size:16px;font-weight:bold;margin-bottom:8px;">${product.name}</p>
            <img src="${url}" onload="window.print();window.close()" />
          </body>
        </html>
      `)
      win.document.close()
    }
  }

  const handleRestock = async () => {
    if (!restockProduct) return
    const qty = parseInt(restockQty)
    if (isNaN(qty)) return
    try {
      await updateProduct(restockProduct.id!, { stock: restockProduct.stock + qty })
      toast({ title: "Stock updated", description: `${restockProduct.name}: ${restockProduct.stock} → ${restockProduct.stock + qty}` })
      setRestockProduct(null)
      setRestockQty("")
      loadProducts()
    } catch {
      toast({ title: "Error", description: "Failed to update stock", variant: "destructive" })
    }
  }

  const getPriceDisplay = (product: Product) => {
    if (product.onSale && product.salePrice) {
      return (
        <div className="flex items-center gap-1">
          <span className="text-xs line-through text-muted-foreground">₱{product.price}</span>
          <span className="font-bold text-orange-600">₱{product.salePrice}</span>
          <span className="text-xs font-semibold text-white bg-orange-500 px-1 rounded">SALE</span>
        </div>
      )
    }
    return <div className="font-bold">₱{product.price}</div>
  }

  const getStockLabel = (stock: number) => {
    if (stock === 0) return <span className="text-xs font-semibold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">Out of Stock</span>
    if (stock <= 5) return <span className="text-xs font-semibold text-yellow-600 bg-yellow-100 px-1.5 py-0.5 rounded">Low Stock</span>
    return null
  }

  const renderProductList = (list: typeof filteredProducts) => (
    <>
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex items-center border rounded-md">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setViewMode("grid")}
            className="rounded-none rounded-l-md"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setViewMode("list")}
            className="rounded-none rounded-r-md"
          >
            <ListIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {viewMode === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {list.map((product) => (
            <div key={product.id} className="rounded-lg border overflow-hidden bg-card hover:shadow-md transition-shadow">
              <div className="relative w-full aspect-square bg-muted">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <span className="text-2xl">📦</span>
                  </div>
                )}
                {product.stock === 0 && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                    <span className="text-xs font-bold text-destructive">Out of Stock</span>
                  </div>
                )}
                {product.onSale && product.salePrice && product.stock > 0 && (
                  <div className="absolute top-1 left-1 bg-red-500 text-white text-[9px] font-bold px-1 py-0.5 rounded">
                    SALE
                  </div>
                )}
              </div>
              <div className="p-2">
                <div className="font-semibold text-xs truncate" title={product.name}>{product.name}</div>
                <div className="flex items-center justify-between mt-1">
                  {product.onSale && product.salePrice ? (
                    <div className="flex flex-col">
                      <div className="text-sm font-bold text-red-500">₱{product.salePrice}</div>
                      <div className="text-[10px] line-through text-muted-foreground">₱{product.price}</div>
                    </div>
                  ) : (
                    <div className="text-sm font-bold text-primary">₱{product.price}</div>
                  )}
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <div className="text-[10px] text-muted-foreground">Stock: {product.stock}</div>
                  {getStockLabel(product.stock)}
                </div>
                <div className="text-[10px] text-muted-foreground">Cost: ₱{product.cost}</div>
                <div className="flex gap-1 mt-2">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600 hover:bg-blue-50" onClick={() => setEditProduct(product)}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:bg-green-50" onClick={() => { setRestockProduct(product); setRestockQty("") }}>
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-600 hover:bg-gray-50" onClick={() => setSelectedProductForBarcode(product)}>
                    <Barcode className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:bg-red-50 ml-auto" onClick={() => handleDeleteProduct(product.id!)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Barcode</TableHead>
                <TableHead>{cfg.stockLabel}</TableHead>
                <TableHead>{cfg.costLabel}</TableHead>
                <TableHead>{cfg.priceLabel}</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {product.name}
                      {getStockLabel(product.stock)}
                    </div>
                  </TableCell>
                  <TableCell>{product.barcode}</TableCell>
                  <TableCell>{product.stock}</TableCell>
                  <TableCell>₱{product.cost}</TableCell>
                  <TableCell>
                    {product.onSale && product.salePrice ? (
                      <div className="flex items-center gap-1">
                        <span className="text-xs line-through text-muted-foreground">₱{product.price}</span>
                        <span className="font-semibold text-orange-600">₱{product.salePrice}</span>
                        <span className="text-xs font-semibold text-white bg-orange-500 px-1 rounded">SALE</span>
                      </div>
                    ) : (
                      <span>₱{product.price}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" className="text-blue-600" onClick={() => setEditProduct(product)}>
                        <Edit className="h-4 w-4 mr-1" /> Edit
                      </Button>
                      <Button variant="outline" size="sm" className="text-green-600" onClick={() => { setRestockProduct(product); setRestockQty("") }}>
                        <RefreshCw className="h-4 w-4 mr-1" /> Restock
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setSelectedProductForBarcode(product)}>
                        <Barcode className="h-4 w-4 mr-1" /> Barcode
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteProduct(product.id!)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  )

  const handleBulkFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      setParsedRows(parseCSV(text))
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  const handleBulkUpload = async () => {
    const valid = parsedRows.filter(r => r.errors.length === 0)
    if (!valid.length) return
    setBulkUploading(true)
    try {
      await bulkAddProducts(valid.map(r => ({
        name: r.name, barcode: r.barcode, category: r.category,
        unit: r.unit, cost: r.cost, price: r.price, stock: r.stock,
        description: r.description,
      })))
      toast({ title: `✅ Uploaded ${valid.length} product${valid.length > 1 ? "s" : ""}` })
      setBulkOpen(false)
      setParsedRows([])
      loadProducts()
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" })
    } finally {
      setBulkUploading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Inventory</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{cfg.emoji} {cfg.itemLabelPlural}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setParsedRows([]); setBulkOpen(true) }}
              disabled={!canExport}
              title={!canExport ? "Upgrade to Gold plan to use Bulk Upload" : undefined}
              className={!canExport ? "opacity-60 cursor-not-allowed" : ""}
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" /> Bulk
              {!canExport && (
                <span className="ml-1 text-[9px] bg-yellow-100 text-yellow-700 px-1 py-0.5 rounded-full font-semibold">GOLD</span>
              )}
            </Button>
            <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add
            </Button>
          </div>
        </div>
      </div>

      {/* Stock Value Cards - Mobile Friendly 2 Rows */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {/* Row 1 */}
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="h-8 w-8 text-blue-600" />
              <div className="text-right">
                <div className="text-lg font-bold text-blue-700">₱{totalStockValue.toLocaleString(undefined, { minimumFractionDigits: 0 })}</div>
                <div className="text-xs text-blue-600 font-medium">Stock Value</div>
              </div>
            </div>
            <div className="text-xs text-blue-600/80">Based on {cfg.costLabel.toLowerCase()}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Package className="h-8 w-8 text-green-600" />
              <div className="text-right">
                <div className="text-lg font-bold text-green-700">{totalItems}</div>
                <div className="text-xs text-green-600 font-medium">Total Items</div>
              </div>
            </div>
            <div className="text-xs text-green-600/80">{cfg.trackStock ? "Units in stock" : "Active services"}</div>
          </CardContent>
        </Card>

        {/* Row 2 */}
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <LayoutGrid className="h-8 w-8 text-purple-600" />
              <div className="text-right">
                <div className="text-lg font-bold text-purple-700">{products.length}</div>
                <div className="text-xs text-purple-600 font-medium">Products</div>
              </div>
            </div>
            <div className="text-xs text-purple-600/80">{cfg.itemLabelPlural}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-orange-600" />
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-orange-700">{lowStockCount + outOfStockCount}</div>
                <div className="text-xs text-orange-600 font-medium">Alerts</div>
              </div>
            </div>
            <div className="text-xs text-orange-600/80">{lowStockCount} low • {outOfStockCount} out</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="products" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 bg-gray-100 p-1 rounded-lg">
          <TabsTrigger value="products" className="text-sm font-medium">All {cfg.itemLabelPlural}</TabsTrigger>
          <TabsTrigger value="low-stock" className="text-sm font-medium text-yellow-700">Low Stock ({lowStockCount})</TabsTrigger>
          <TabsTrigger value="out-of-stock" className="text-sm font-medium text-red-700 hidden lg:flex">Out of Stock ({outOfStockCount})</TabsTrigger>
          <TabsTrigger value="categories" className="text-sm font-medium hidden lg:flex">Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-6">
          {renderProductList(filteredProducts)}
        </TabsContent>

        <TabsContent value="low-stock" className="space-y-6">
          {renderProductList(filteredProducts.filter(p => p.stock > 0 && p.stock <= 5))}
        </TabsContent>

        <TabsContent value="out-of-stock" className="space-y-6">
          {renderProductList(filteredProducts.filter(p => p.stock === 0))}
        </TabsContent>

        <TabsContent value="categories">
          <CategoryManager categories={categories} onUpdate={loadCategories} />
        </TabsContent>
      </Tabs>

      {editProduct && (
        <EditProductDialog
          product={editProduct}
          categories={categories}
          open={!!editProduct}
          onOpenChange={(open) => !open && setEditProduct(null)}
          onSuccess={() => { setEditProduct(null); loadProducts() }}
        />
      )}

      {/* ── Bulk Upload Dialog ── */}
      <Dialog open={bulkOpen} onOpenChange={open => { setBulkOpen(open); if (!open) setParsedRows([]) }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" /> Bulk Upload Products
            </DialogTitle>
            <DialogDescription>Upload a CSV file to add multiple products at once</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Instructions */}
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
              <p className="text-sm font-semibold flex items-center gap-2"><FileText className="h-4 w-4" /> CSV Format Requirements</p>
              <p className="text-xs text-muted-foreground">
                Your CSV must have these column headers (in any order):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SAMPLE_CSV_HEADERS.map(h => (
                  <code key={h} className="text-xs bg-background border rounded px-1.5 py-0.5">{h}</code>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                <strong>Required:</strong> name, barcode, cost, price, stock &nbsp;·&nbsp;
                <strong>Optional:</strong> category, unit, description
              </p>
              <Button size="sm" variant="outline" onClick={downloadSampleCSV} className="gap-1.5 mt-1">
                <Download className="h-3.5 w-3.5" /> Download Sample CSV
              </Button>
            </div>

            {/* File picker */}
            <div className="space-y-1">
              <Label htmlFor="csv-upload">Select CSV File</Label>
              <Input
                id="csv-upload"
                type="file"
                accept=".csv,text/csv"
                onChange={handleBulkFile}
                className="cursor-pointer"
              />
            </div>

            {/* Preview table */}
            {parsedRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">
                    Preview — {parsedRows.length} row{parsedRows.length > 1 ? "s" : ""} detected
                  </p>
                  <div className="flex gap-2 text-xs">
                    <span className="text-green-600 font-medium">
                      ✓ {parsedRows.filter(r => r.errors.length === 0).length} valid
                    </span>
                    {parsedRows.some(r => r.errors.length > 0) && (
                      <span className="text-red-600 font-medium">
                        ✗ {parsedRows.filter(r => r.errors.length > 0).length} errors
                      </span>
                    )}
                  </div>
                </div>
                <div className="border rounded-md overflow-auto max-h-72">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Barcode</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead>Cost</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedRows.map(r => (
                        <TableRow key={r.row} className={r.errors.length > 0 ? "bg-red-50" : ""}>
                          <TableCell className="text-xs text-muted-foreground">{r.row}</TableCell>
                          <TableCell className="font-medium text-sm">{r.name || <span className="text-red-500 italic">missing</span>}</TableCell>
                          <TableCell className="text-xs">{r.barcode || <span className="text-red-500 italic">missing</span>}</TableCell>
                          <TableCell className="text-xs">{r.category}</TableCell>
                          <TableCell className="text-xs">{r.unit}</TableCell>
                          <TableCell className="text-xs">₱{r.cost}</TableCell>
                          <TableCell className="text-xs">₱{r.price}</TableCell>
                          <TableCell className="text-xs">{r.stock}</TableCell>
                          <TableCell>
                            {r.errors.length === 0
                              ? <Badge className="bg-green-100 text-green-700 border-0 text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />OK</Badge>
                              : <Badge className="bg-red-100 text-red-700 border-0 text-xs" title={r.errors.join(", ")}>
                                  <XCircleIcon className="h-3 w-3 mr-1" />{r.errors[0]}
                                </Badge>
                            }
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {parsedRows.some(r => r.errors.length > 0) && (
                  <p className="text-xs text-muted-foreground">
                    ⚠️ Rows with errors will be skipped. Fix your CSV and re-upload to include them.
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setBulkOpen(false); setParsedRows([]) }}>Cancel</Button>
            <Button
              onClick={handleBulkUpload}
              disabled={parsedRows.filter(r => r.errors.length === 0).length === 0 || bulkUploading}
            >
              {bulkUploading ? "Uploading..." : `Upload ${parsedRows.filter(r => r.errors.length === 0).length} Product${parsedRows.filter(r => r.errors.length === 0).length !== 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restock Dialog */}
      <Dialog open={!!restockProduct} onOpenChange={(open) => !open && setRestockProduct(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
            <DialogDescription>Add or reduce stock quantity</DialogDescription>
          </DialogHeader>
          {restockProduct && (
            <div className="space-y-4 py-2">
              <div>
                <p className="font-semibold">{restockProduct.name}</p>
                <p className="text-sm text-muted-foreground">Current stock: <span className="font-bold">{restockProduct.stock}</span></p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="restock-qty">Adjustment (use negative to reduce)</Label>
                <Input
                  id="restock-qty"
                  type="number"
                  placeholder="e.g. 10 or -3"
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  autoFocus
                />
              </div>
              {restockQty !== "" && !isNaN(parseInt(restockQty)) && (
                <p className="text-sm">New stock: <span className="font-bold">{restockProduct.stock + parseInt(restockQty)}</span></p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setRestockProduct(null)}>Cancel</Button>
                <Button className="flex-1" onClick={handleRestock} disabled={restockQty === "" || isNaN(parseInt(restockQty))}>Confirm</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Barcode Generator Dialog */}
      <Dialog open={!!selectedProductForBarcode} onOpenChange={(open) => !open && setSelectedProductForBarcode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Product Barcode</DialogTitle>
            <DialogDescription>View, print, or download barcode</DialogDescription>
          </DialogHeader>
          {selectedProductForBarcode && (
            <div className="flex flex-col items-center gap-6 py-4">
              <div className="text-center">
                <h3 className="font-bold text-lg">{selectedProductForBarcode.name}</h3>
                <p className="text-sm text-muted-foreground">{selectedProductForBarcode.barcode}</p>
              </div>
              
              <div className="border p-4 rounded-lg bg-white">
                <img 
                  src={getBarcodeUrl(selectedProductForBarcode.barcode)} 
                  alt="Barcode" 
                  className="max-w-full h-auto"
                />
              </div>

              <div className="flex gap-2 w-full">
                <Button className="flex-1" variant="outline" onClick={() => printBarcode(selectedProductForBarcode)}>
                  <Printer className="mr-2 h-4 w-4" /> Print
                </Button>
                <Button className="flex-1" onClick={() => downloadBarcode(selectedProductForBarcode)}>
                  <Download className="mr-2 h-4 w-4" /> Download
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
