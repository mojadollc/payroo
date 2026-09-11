"use client"

/**
 * VirtualProductGrid
 *
 * CSS-based virtual scroll — renders only the rows in the viewport.
 * No external dependency. Works with any column count.
 *
 * Strategy:
 *   - Measure container height once (ResizeObserver).
 *   - Compute which rows are visible from scrollTop.
 *   - Render a spacer div above + below visible rows so the scrollbar
 *     reflects the full list height without DOM nodes for every item.
 *
 * Perf: 500 products → ~20 DOM nodes instead of 500.
 */

import { useRef, useState, useEffect, useCallback, memo } from "react"
import { DefaultProductImage } from "@/components/ui/default-product-image"
import { MobileCard } from "@/components/mobile-app-shell"
import type { PosProduct } from "@/lib/pos/product-store"

const COLS = 2
const ROW_HEIGHT = 220 // px — approximate card height (image + text)
const OVERSCAN = 3    // extra rows above/below viewport

interface Props {
  products: PosProduct[]
  onAdd: (product: PosProduct) => void
}

const ProductCard = memo(function ProductCard({
  product, idx, onAdd,
}: { product: PosProduct; idx: number; onAdd: (p: PosProduct) => void }) {
  const outOfStock = product.stock <= 0
  return (
    <MobileCard
      onClick={() => !outOfStock && onAdd(product)}
      className={outOfStock ? "opacity-50" : ""}
    >
      <div className="relative aspect-square bg-muted/40">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
            loading={idx < 8 ? "eager" : "lazy"}
            decoding={idx < 8 ? "sync" : "async"}
            fetchPriority={idx < 4 ? "high" : "auto"}
            width={200}
            height={200}
          />
        ) : (
          <DefaultProductImage />
        )}
        {outOfStock && (
          <div className="absolute inset-0 bg-background/90 flex items-center justify-center">
            <span className="text-xs font-bold text-destructive">Out of Stock</span>
          </div>
        )}
        {product.onSale && product.salePrice && !outOfStock && (
          <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
            SALE
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="font-semibold text-[13px] truncate mb-0.5 tracking-tight" title={product.name}>
          {product.name}
        </div>
        {product.variants && (product.variants as any[]).length > 0 && (
          <p className="text-[10px] text-primary font-medium mb-0.5">
            {(product.variants as any[]).map((v: any) => v.name).join(", ")}
          </p>
        )}
        {product.onSale && product.salePrice ? (
          <div className="flex items-center gap-1.5">
            <div className="text-[15px] font-bold text-orange-500">₱{product.salePrice.toFixed(2)}</div>
            <div className="text-[11px] line-through text-muted-foreground">₱{product.price.toFixed(2)}</div>
          </div>
        ) : (
          <div className="text-[15px] font-bold text-primary">₱{product.price.toFixed(2)}</div>
        )}
        <div className="text-[10px] text-muted-foreground mt-1 font-medium">{product.stock} in stock</div>
      </div>
    </MobileCard>
  )
})

export function VirtualProductGrid({ products, onAdd }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(600)

  // Observe container height changes
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setContainerHeight(entry.contentRect.height)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop((e.target as HTMLDivElement).scrollTop)
  }, [])

  const totalRows = Math.ceil(products.length / COLS)
  const totalHeight = totalRows * ROW_HEIGHT

  const firstVisibleRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const visibleRowCount = Math.ceil(containerHeight / ROW_HEIGHT) + OVERSCAN * 2
  const lastVisibleRow = Math.min(totalRows - 1, firstVisibleRow + visibleRowCount)

  const paddingTop = firstVisibleRow * ROW_HEIGHT
  const paddingBottom = Math.max(0, (totalRows - lastVisibleRow - 1) * ROW_HEIGHT)

  const visibleProducts: PosProduct[] = []
  for (let row = firstVisibleRow; row <= lastVisibleRow; row++) {
    for (let col = 0; col < COLS; col++) {
      const idx = row * COLS + col
      if (idx < products.length) visibleProducts.push(products[idx])
    }
  }

  if (products.length === 0) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-2xl overflow-hidden border border-border/40 bg-white">
            <div className="aspect-square relative overflow-hidden bg-gray-100">
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
            </div>
            <div className="p-3 space-y-2">
              <div className="h-3 rounded w-3/4 relative overflow-hidden bg-gray-100">
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
              </div>
              <div className="h-4 rounded w-1/2 relative overflow-hidden bg-gray-100">
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite_0.1s] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      className="overflow-y-auto"
      style={{ height: "calc(100vh - 220px)", minHeight: 400 }}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <div style={{ paddingTop, paddingBottom }}>
          <div className="grid grid-cols-2 gap-3">
            {visibleProducts.map((product, i) => {
              const globalIdx = firstVisibleRow * COLS + i
              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  idx={globalIdx}
                  onAdd={onAdd}
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
