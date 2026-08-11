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
import { offlineGetProducts, offlineGetCategories } from "@/lib/offline/services"
import { isOnline } from "@/lib/offline/sync-engine"
import { Label } from "@/components/ui/label"
import type { Product, Category } from "@/lib/firebase/types"
import { getStoreId } from "@/lib/store-id"
import { AddProductDialog } from "@/components/inventory/add-product-dialog"
import { EditProductDialog } from "@/components/inventory/edit-product-dialog"
import { CategoryManager } from "@/components/inventory/category-manager"
import { DefaultProductImage } from "@/components/ui/default-product-image"
import { MobileAppShell, MobileCard, MobileSectionHeader } from "@/components/mobile-app-shell"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { FloatingActionButton } from "@/components/ui/floating-action-button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  const [activeTab, setActiveTab] = useState("products")
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 20
  const { toast } = useToast()

  useEffect(() => {
    loadProducts()
    loadCategories()
  }, [])

  const loadProducts = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) return
      const res = await fetch(`/api/products?storeId=${storeId}`)
      const { data } = await res.json()
      if (data?.length > 0) setProducts(data)
    } catch (error) {
      console.error("Error loading products:", error)
      const offline = await offlineGetProducts()
      if (offline.length > 0) setProducts(offline)
    }
  }

  const loadCategories = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) return
      const res = await fetch(`/api/categories?storeId=${storeId}`)
      const { data } = await res.json()
      if (data?.length > 0) setCategories(data)
    } catch (error) {
      console.error("Error loading categories:", error)
      const offline = await offlineGetCategories()
      if (offline.length > 0) setCategories(offline)
    }
  }

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return
    const prev = products
    setProducts(p => p.filter(x => x.id !== id))
    try {
      const res = await fetch(`/api/products?id=${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed")
      toast({ title: "Product deleted" })
    } catch (error) {
      setProducts(prev)
      toast({ title: "Error", description: "Failed to delete product", variant: "destructive" })
    }
  }

  // Filter products
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.barcode.includes(searchTerm)
  )

  // Pagination helper
  const paginate = (list: typeof filteredProducts) => {
    const total = Math.ceil(list.length / PAGE_SIZE)
    const page = Math.min(currentPage, total || 1)
    return { items: list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), total, page }
  }

  // Calculate Stock Value (Cost * Stock)
  const totalStockValue = products.reduce((sum, p) => sum + (p.cost * p.stock), 0)
  const totalItems = products.reduce((sum, p) => sum + p.stock, 0)
  const lowStockCount = products.filter(p => p.stock > 0 && p.stock <= 5).length
  const outOfStockCount = products.filter(p => p.stock === 0).length

  // Barcode Actions
  const getBarcodeUrl = (barcode: string) => 
    `https://bwipjs-api.metafloor.com/?bcid=code128&text=${barcode}&scale=3&includetext&backgroundcolor=ffffff`

  const getStoreName = () => localStorage.getItem("storeName") || "MY STORE"

  // Generate a single price tag HTML
  const priceTagHTML = (product: Product) => {
    const storeName = getStoreName().toUpperCase()
    const barcodeImg = getBarcodeUrl(product.barcode)
    const price = product.onSale && product.salePrice ? product.salePrice : product.price
    return `
      <div class="tag">
        <div class="store-name">${storeName}</div>
        <div class="product-name">${product.name}</div>
        <img class="barcode-img" src="${barcodeImg}" />
        <div class="barcode-num">${product.barcode}</div>
        <div class="price">PRICE: ₱${price.toFixed(2)}</div>
      </div>
    `
  }

  const tagStyles = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; }
    .tags-container { display: flex; flex-wrap: wrap; gap: 4px; padding: 4px; }
    .tag {
      width: 48mm; height: 30mm;
      border: 1px solid #ccc;
      padding: 2mm 3mm;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      page-break-inside: avoid;
      overflow: hidden;
    }
    .store-name { font-size: 7px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 1px; }
    .product-name { font-size: 8px; font-weight: 600; text-align: center; line-height: 1.2; max-height: 20px; overflow: hidden; margin-bottom: 2px; }
    .barcode-img { height: 18px; max-width: 90%; object-fit: contain; }
    .barcode-num { font-size: 7px; font-family: monospace; margin-top: 1px; }
    .price { font-size: 10px; font-weight: bold; margin-top: 2px; }
    @media print {
      body { margin: 0; }
      .tag { border: 1px dashed #999; }
      .no-print { display: none; }
    }
  `

  const printSingleTag = (product: Product) => {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<html><head><style>${tagStyles}</style></head><body>
      <div class="tags-container">${priceTagHTML(product)}</div>
      <script>window.onload=()=>{window.print();window.close()}<\/script>
    </body></html>`)
    win.document.close()
  }

  const printBatchTags = (productList: Product[]) => {
    const win = window.open('', '_blank')
    if (!win) return
    const tags = productList.map(p => priceTagHTML(p)).join('')
    win.document.write(`<html><head><style>${tagStyles}</style></head><body>
      <div class="tags-container">${tags}</div>
      <script>window.onload=()=>{window.print();window.close()}<\/script>
    </body></html>`)
    win.document.close()
  }

  const downloadBarcode = async (product: Product) => {
    try {
      const response = await fetch(getBarcodeUrl(product.barcode))
      const blob = await response.blob()
      const barcodeUrl = URL.createObjectURL(blob)
      const img = new Image()
      img.src = barcodeUrl
      img.onload = () => {
        const storeName = getStoreName().toUpperCase()
        const price = product.onSale && product.salePrice ? product.salePrice : product.price
        const W = 380, H = 240
        const canvas = document.createElement("canvas")
        canvas.width = W; canvas.height = H
        const ctx = canvas.getContext("2d")!
        // Background
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, W, H)
        // Border
        ctx.strokeStyle = "#000"
        ctx.lineWidth = 2
        ctx.strokeRect(1, 1, W - 2, H - 2)
        // Store name
        ctx.font = "bold 14px Arial"
        ctx.fillStyle = "#000"
        ctx.textAlign = "center"
        ctx.fillText(storeName, W / 2, 22)
        // Product name
        ctx.font = "bold 16px Arial"
        ctx.fillText(product.name.length > 30 ? product.name.slice(0, 30) + "..." : product.name, W / 2, 44)
        // Barcode image
        const bW = Math.min(img.width, W - 40)
        const bH = Math.min(img.height, 70)
        ctx.drawImage(img, (W - bW) / 2, 56, bW, bH)
        // Barcode number
        ctx.font = "12px monospace"
        ctx.fillText(product.barcode, W / 2, 56 + bH + 16)
        // Price
        ctx.font = "bold 22px Arial"
        ctx.fillText(`PRICE: ₱${price.toFixed(2)}`, W / 2, 56 + bH + 44)
        // Download
        const link = document.createElement("a")
        link.href = canvas.toDataURL("image/png")
        link.download = `${product.name}-pricetag.png`
        link.click()
      }
    } catch (e) {
      toast({ title: "Error", description: "Failed to download barcode", variant: "destructive" })
    }
  }

  // For batch print dialog
  const [showBatchPrint, setShowBatchPrint] = useState(false)
  const [batchCategory, setBatchCategory] = useState("all")

  const handleRestock = async () => {
    if (!restockProduct) return
    const qty = parseInt(restockQty)
    if (isNaN(qty)) return
    try {
      const newStock = restockProduct.stock + qty
      await fetch("/api/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: restockProduct.id, stock: newStock }),
      })
      toast({ title: "Stock updated", description: `${restockProduct.name}: ${restockProduct.stock} → ${newStock}` })
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

  const PaginationBar = ({ total, page, onChange }: { total: number; page: number; onChange: (p: number) => void }) => {
    if (total <= 1) return null
    return (
      <div className="flex items-center justify-center gap-1 pt-2">
        <button
          onClick={() => onChange(1)}
          disabled={page === 1}
          className="px-2 py-1 text-xs rounded border disabled:opacity-40 hover:bg-muted transition-colors"
        >«</button>
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="px-2 py-1 text-xs rounded border disabled:opacity-40 hover:bg-muted transition-colors"
        >‹</button>
        {Array.from({ length: total }, (_, i) => i + 1)
          .filter(p => p === 1 || p === total || Math.abs(p - page) <= 1)
          .reduce<(number | "...")[]>((acc, p, i, arr) => {
            if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push("...")
            acc.push(p)
            return acc
          }, [])
          .map((p, i) =>
            p === "..." ? (
              <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
            ) : (
              <button
                key={p}
                onClick={() => onChange(p as number)}
                className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                  p === page ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
                }`}
              >{p}</button>
            )
          )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === total}
          className="px-2 py-1 text-xs rounded border disabled:opacity-40 hover:bg-muted transition-colors"
        >›</button>
        <button
          onClick={() => onChange(total)}
          disabled={page === total}
          className="px-2 py-1 text-xs rounded border disabled:opacity-40 hover:bg-muted transition-colors"
        >»</button>
        <span className="ml-2 text-xs text-muted-foreground">{page}/{total}</span>
      </div>
    )
  }

  const renderProductList = (list: typeof filteredProducts) => {
    const { items, total, page } = paginate(list)
    return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
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
          {items.map((product) => (
            <div key={product.id} className="rounded-lg border overflow-hidden bg-card hover:shadow-md transition-shadow">
              <div className="relative w-full h-28 sm:h-32 bg-muted">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                ) : (
                  <DefaultProductImage />
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
              {items.map((product) => (
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
      <PaginationBar total={total} page={page} onChange={(p) => { setCurrentPage(p); window.scrollTo({ top: 0, behavior: "smooth" }) }} />
      {list.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          Showing {Math.min((page - 1) * PAGE_SIZE + 1, list.length)}–{Math.min(page * PAGE_SIZE, list.length)} of {list.length} products
        </p>
      )}
    </>
    )
  }

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
      const storeId = getStoreId()
      await Promise.all(valid.map(r =>
        fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storeId, name: r.name, barcode: r.barcode, category: r.category,
            unit: r.unit, cost: r.cost, price: r.price, stock: r.stock,
            description: r.description,
          }),
        })
      ))
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

  const tabProducts = {
    products: filteredProducts,
    "low-stock": filteredProducts.filter(p => p.stock > 0 && p.stock <= 5),
    "out-of-stock": filteredProducts.filter(p => p.stock === 0),
  } as Record<string, typeof filteredProducts>

  // Reset page when search or tab changes
  const handleSearchChange = (val: string) => { setSearchTerm(val); setCurrentPage(1) }
  const handleTabChange = (val: string) => { setActiveTab(val); setCurrentPage(1) }

  return (
    <MobileAppShell
      title="Inventory"
      subtitle={`${cfg.emoji} ${cfg.itemLabelPlural}`}
      headerAction={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setParsedRows([]); setBulkOpen(true) }}
            disabled={!canExport}
            title={!canExport ? "Upgrade to Gold plan to use Bulk Upload" : undefined}
            className={!canExport ? "opacity-60 cursor-not-allowed h-9" : "h-9"}
          >
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline ml-1.5">Bulk</span>
            {!canExport && (
              <span className="ml-1 text-[9px] bg-yellow-100 text-yellow-700 px-1 py-0.5 rounded-full font-semibold">GOLD</span>
            )}
          </Button>
          <Button size="sm" className="h-9" onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline ml-1.5">Add</span>
          </Button>
        </div>
      }
    >
      {/* ── Mobile View ── */}
      <div className="md:hidden space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <MobileCard className="p-3 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="p-1.5 bg-blue-500 rounded-md"><DollarSign className="h-3.5 w-3.5 text-white" /></div>
              <span className="text-[11px] text-muted-foreground">Stock Value</span>
            </div>
            <div className="text-[15px] font-bold text-blue-600 truncate">₱{totalStockValue.toLocaleString("en-PH")}</div>
          </MobileCard>

          <MobileCard className="p-3 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="p-1.5 bg-green-500 rounded-md"><Package className="h-3.5 w-3.5 text-white" /></div>
              <span className="text-[11px] text-muted-foreground">Total Items</span>
            </div>
            <div className="text-[15px] font-bold text-green-600 truncate">{totalItems.toLocaleString()}</div>
          </MobileCard>

          <MobileCard className="p-3 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="p-1.5 bg-purple-500 rounded-md"><LayoutGrid className="h-3.5 w-3.5 text-white" /></div>
              <span className="text-[11px] text-muted-foreground">Products</span>
            </div>
            <div className="text-[15px] font-bold text-purple-600 truncate">{products.length.toLocaleString()}</div>
          </MobileCard>

          <MobileCard className="p-3 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="p-1.5 bg-orange-500 rounded-md"><AlertTriangle className="h-3.5 w-3.5 text-white" /></div>
              <span className="text-[11px] text-muted-foreground">Alerts</span>
            </div>
            <div className="text-[15px] font-bold text-orange-600 truncate">{lowStockCount + outOfStockCount}</div>
            <div className="text-[11px] text-orange-600/80 mt-0.5">{lowStockCount} low • {outOfStockCount} out</div>
          </MobileCard>
        </div>

        {/* Tab Filter */}
        <Select value={activeTab} onValueChange={handleTabChange}>
          <SelectTrigger className="w-full h-12 rounded-xl border-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="products">All {cfg.itemLabelPlural}</SelectItem>
            <SelectItem value="low-stock">Low Stock ({lowStockCount})</SelectItem>
            <SelectItem value="out-of-stock">Out of Stock ({outOfStockCount})</SelectItem>
            <SelectItem value="categories">Categories</SelectItem>
          </SelectContent>
        </Select>

        {/* Search */}
        {activeTab !== "categories" && (
          <MobileCard className="bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200">
            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10 h-12 text-base rounded-xl border-2 border-yellow-300 bg-white"
                />
              </div>
            </div>
          </MobileCard>
        )}

        {/* Product List / Categories */}
        {activeTab === "categories" ? (
          <MobileCard>
            <div className="p-3">
              <CategoryManager categories={categories} onUpdate={loadCategories} />
            </div>
          </MobileCard>
        ) : (() => {
          const mobileList = tabProducts[activeTab] ?? filteredProducts
          const { items: mobileItems, total: mobileTotal, page: mobilePage } = paginate(mobileList)
          return (
          <div>
            <MobileSectionHeader title={activeTab === "products" ? `All ${cfg.itemLabelPlural}` : activeTab === "low-stock" ? "Low Stock" : "Out of Stock"} />
            <div className="grid grid-cols-2 gap-3">
              {mobileItems.map((product) => (
                <MobileCard key={product.id}>
                  <div className="relative h-28 bg-muted">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                    ) : (
                      <DefaultProductImage />
                    )}
                    {product.stock === 0 && (
                      <div className="absolute inset-0 bg-background/90 flex items-center justify-center">
                        <span className="text-sm font-bold text-destructive">Out of Stock</span>
                      </div>
                    )}
                    {product.onSale && product.salePrice && product.stock > 0 && (
                      <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-lg shadow-lg">SALE</div>
                    )}
                    {product.stock > 0 && product.stock <= 5 && (
                      <div className="absolute top-2 right-2 bg-yellow-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-lg">LOW</div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="font-semibold text-sm truncate mb-1" title={product.name}>{product.name}</div>
                    {product.onSale && product.salePrice ? (
                      <div className="flex items-center gap-1.5">
                        <div className="text-base font-bold text-red-500">₱{product.salePrice}</div>
                        <div className="text-xs line-through text-muted-foreground">₱{product.price}</div>
                      </div>
                    ) : (
                      <div className="text-base font-bold text-primary">₱{product.price}</div>
                    )}
                    <div className="text-xs text-muted-foreground mt-0.5">Stock: {product.stock} • Cost: ₱{product.cost}</div>
                    <div className="flex gap-1 mt-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50 rounded-lg" onClick={() => setEditProduct(product)}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:bg-green-50 rounded-lg" onClick={() => { setRestockProduct(product); setRestockQty("") }}>
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-600 hover:bg-gray-50 rounded-lg" onClick={() => setSelectedProductForBarcode(product)}>
                        <Barcode className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50 rounded-lg ml-auto" onClick={() => handleDeleteProduct(product.id!)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </MobileCard>
              ))}
            </div>
            <PaginationBar total={mobileTotal} page={mobilePage} onChange={(p) => { setCurrentPage(p); window.scrollTo({ top: 0, behavior: "smooth" }) }} />
            {mobileList.length > 0 && (
              <p className="text-center text-xs text-muted-foreground pt-1">
                Showing {Math.min((mobilePage - 1) * PAGE_SIZE + 1, mobileList.length)}–{Math.min(mobilePage * PAGE_SIZE, mobileList.length)} of {mobileList.length}
              </p>
            )}
          </div>
          )
        })()}
      </div>

      {/* ── Desktop View ── */}
      <div className="hidden md:block space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="h-8 w-8 text-blue-600" />
                <div className="text-right">
                  <div className="text-lg font-bold text-blue-700">₱{totalStockValue.toLocaleString()}</div>
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
          <TabsList className="grid w-full grid-cols-4 bg-gray-100 p-1 rounded-lg">
            <TabsTrigger value="products" className="text-sm font-medium">All {cfg.itemLabelPlural}</TabsTrigger>
            <TabsTrigger value="low-stock" className="text-sm font-medium text-yellow-700">Low Stock ({lowStockCount})</TabsTrigger>
            <TabsTrigger value="out-of-stock" className="text-sm font-medium text-red-700">Out of Stock ({outOfStockCount})</TabsTrigger>
            <TabsTrigger value="categories" className="text-sm font-medium">Categories</TabsTrigger>
          </TabsList>
          <TabsContent value="products" className="space-y-6">{renderProductList(filteredProducts)}</TabsContent>
          <TabsContent value="low-stock" className="space-y-6">{renderProductList(filteredProducts.filter(p => p.stock > 0 && p.stock <= 5))}</TabsContent>
          <TabsContent value="out-of-stock" className="space-y-6">{renderProductList(filteredProducts.filter(p => p.stock === 0))}</TabsContent>
          <TabsContent value="categories"><CategoryManager categories={categories} onUpdate={loadCategories} /></TabsContent>
        </Tabs>
      </div>

      {/* Floating Add Button (Mobile) */}
      <FloatingActionButton
        icon={<Plus className="h-7 w-7" />}
        label="Add Product"
        onClick={() => setIsAddDialogOpen(true)}
      />

      {/* ── Dialogs (shared) ── */}
      <AddProductDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        categories={categories}
        onSuccess={() => { setIsAddDialogOpen(false); loadProducts(); loadCategories() }}
      />

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

      {/* Barcode Price Tag Dialog */}
      <Dialog open={!!selectedProductForBarcode} onOpenChange={(open) => !open && setSelectedProductForBarcode(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Price Tag</DialogTitle>
            <DialogDescription>Supermarket-style barcode sticker</DialogDescription>
          </DialogHeader>
          {selectedProductForBarcode && (
            <div className="space-y-4 py-2">
              {/* Preview */}
              <div className="border-2 border-dashed rounded-lg p-3 bg-white text-center space-y-1">
                <p className="text-[10px] font-bold tracking-wide uppercase">{(localStorage.getItem("storeName") || "MY STORE").toUpperCase()}</p>
                <p className="text-[12px] font-semibold truncate">{selectedProductForBarcode.name}</p>
                <img src={getBarcodeUrl(selectedProductForBarcode.barcode)} alt="Barcode" className="mx-auto h-10 object-contain" />
                <p className="text-[10px] font-mono">{selectedProductForBarcode.barcode}</p>
                <p className="text-[14px] font-bold">PRICE: ₱{(selectedProductForBarcode.onSale && selectedProductForBarcode.salePrice ? selectedProductForBarcode.salePrice : selectedProductForBarcode.price).toFixed(2)}</p>
              </div>

              <div className="flex gap-2">
                <Button className="flex-1" variant="outline" size="sm" onClick={() => printSingleTag(selectedProductForBarcode)}>
                  <Printer className="mr-1.5 h-3.5 w-3.5" /> Print
                </Button>
                <Button className="flex-1" size="sm" onClick={() => downloadBarcode(selectedProductForBarcode)}>
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Download
                </Button>
              </div>

              <Button variant="outline" size="sm" className="w-full" onClick={() => { setSelectedProductForBarcode(null); setShowBatchPrint(true) }}>
                <Printer className="mr-1.5 h-3.5 w-3.5" /> Print All / By Category
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Batch Print Dialog */}
      <Dialog open={showBatchPrint} onOpenChange={setShowBatchPrint}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Batch Print Price Tags</DialogTitle>
            <DialogDescription>Print barcode stickers for multiple products (48mm × 30mm size)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={batchCategory} onValueChange={setBatchCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products ({products.length})</SelectItem>
                  {[...new Set(products.map(p => p.category))].sort().map(cat => (
                    <SelectItem key={cat} value={cat}>{cat} ({products.filter(p => p.category === cat).length})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-[12px] text-muted-foreground">
              This will print {batchCategory === "all" ? products.length : products.filter(p => p.category === batchCategory).length} price tag stickers. Recommended sticker size: 48mm × 30mm.
            </p>
            <Button className="w-full" onClick={() => {
              const list = batchCategory === "all" ? products : products.filter(p => p.category === batchCategory)
              printBatchTags(list)
              setShowBatchPrint(false)
            }}>
              <Printer className="mr-2 h-4 w-4" /> Print {batchCategory === "all" ? products.length : products.filter(p => p.category === batchCategory).length} Tags
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MobileAppShell>
  )
}
