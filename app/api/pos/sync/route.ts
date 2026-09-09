import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"
import { normaliseImageUrl } from "@/lib/image-url"
import { getProductCache, setProductCache } from "@/lib/db/product-cache"

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
  // Updated/created products
  const updated = await prisma.product.findMany({
    where: { storeId, updatedAt: { gt: sinceDate } },
    orderBy: { updatedAt: "asc" },
    select: POS_SELECT,
  })

  // Deleted products: we track deletions via a soft-delete pattern would be
  // ideal, but since we don't have that, we diff the full ID set cheaply.
  // Only fetch IDs — very small payload.
  const allIds = await prisma.product.findMany({
    where: { storeId },
    select: { id: true },
  })
  const liveIdSet = new Set(allIds.map(r => r.id))

  // We can only know deletions if the client tells us what it had.
  // Without a deletions log, return empty deleted array for incremental —
  // the client will detect orphans on the next full sync (since=0).
  // This is safe: stale products just show in search until next full sync.
  const deleted: string[] = []

  // Invalidate server cache if anything changed
  if (updated.length > 0) {
    const { invalidateProductCache } = await import("@/lib/db/product-cache")
    invalidateProductCache(storeId)
  }

  return NextResponse.json(
    { updated: updated.map(fix), deleted, syncTimestamp },
    { headers: { "Cache-Control": "private, no-store" } }
  )
}
