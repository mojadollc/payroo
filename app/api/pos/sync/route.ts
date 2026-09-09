import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"
import { normaliseImageUrl } from "@/lib/image-url"
import { getProductCache, setProductCache, invalidateProductCache } from "@/lib/db/product-cache"

const POS_SELECT = {
  id: true, name: true, barcode: true, category: true,
  price: true, cost: true, stock: true, imageUrl: true,
  unit: true, onSale: true, salePrice: true, variants: true,
  updatedAt: true,
} as const

function fix(p: any) {
  if (p?.imageUrl) p.imageUrl = normaliseImageUrl(p.imageUrl)
  return p
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  const storeId = p.get("storeId")
  if (!storeId) return NextResponse.json({ error: "Missing storeId" }, { status: 400 })

  const since = parseInt(p.get("since") || "0")
  const sinceDate = since > 0 ? new Date(since) : null
  const syncTimestamp = Date.now()

  // ── Full catalog (since=0 or missing) ─────────────────────────────────────
  if (!sinceDate) {
    const cached = getProductCache(storeId)
    if (cached) {
      return NextResponse.json(
        { updated: cached, deleted: [], syncTimestamp },
        { headers: { "Cache-Control": "private, no-store", "X-Cache": "HIT" } }
      )
    }

    const items = await prisma.product.findMany({
      where: { storeId },
      orderBy: { name: "asc" },
      select: POS_SELECT,
    })
    const result = items.map(fix)
    setProductCache(storeId, result)

    return NextResponse.json(
      { updated: result, deleted: [], syncTimestamp },
      { headers: { "Cache-Control": "private, no-store", "X-Cache": "MISS" } }
    )
  }

  // ── Incremental (since > 0) ────────────────────────────────────────────────
  const [updated, deletedRows] = await Promise.all([
    // Products updated/created since last sync
    prisma.product.findMany({
      where: { storeId, updatedAt: { gt: sinceDate } },
      orderBy: { updatedAt: "asc" },
      select: POS_SELECT,
    }),
    // Products deleted since last sync — from the deletion log
    prisma.deletedProduct.findMany({
      where: { storeId, deletedAt: { gt: sinceDate } },
      select: { id: true },
    }),
  ])

  const deleted = deletedRows.map(r => r.id)

  // Invalidate server cache if anything changed
  if (updated.length > 0 || deleted.length > 0) {
    invalidateProductCache(storeId)
  }

  return NextResponse.json(
    { updated: updated.map(fix), deleted, syncTimestamp },
    { headers: { "Cache-Control": "private, no-store" } }
  )
}
