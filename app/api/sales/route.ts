import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"
import { startOfDayPH, endOfDayPH } from "@/lib/ph-time"

export async function GET(req: NextRequest) {
  try {
    const storeId = req.nextUrl.searchParams.get("storeId")
    if (!storeId) return NextResponse.json({ error: "Missing storeId" }, { status: 400 })
    const from = req.nextUrl.searchParams.get("from")
    const to = req.nextUrl.searchParams.get("to")
    const summary = req.nextUrl.searchParams.get("summary") === "1"
    const where: any = { storeId }
    if (from && to) {
      where.createdAt = { gte: startOfDayPH(from), lte: endOfDayPH(to) }
    }
    if (summary) {
      const rows = await prisma.sale.findMany({
        where,
        select: { total: true, status: true },
      })
      return NextResponse.json({ data: rows }, { headers: { "Cache-Control": "private, max-age=60" } })
    }
    const items = await prisma.sale.findMany({ where, include: { items: true }, orderBy: { createdAt: "desc" }, take: 500 })
    return NextResponse.json({ data: items }, { headers: { "Cache-Control": "no-store" } })
  } catch (err: any) {
    console.error("[sales GET]", err.message)
    return NextResponse.json({ error: err.message, data: [] }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, storeId, total, profit, paymentMethod, status, items } = body

    // Batch-fetch all products in one query instead of N individual findUnique calls
    const productIds: string[] = (items ?? []).map((i: any) => i.productId).filter(Boolean)
    const existingProducts = productIds.length
      ? await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, stock: true } })
      : []
    const stockMap = new Map(existingProducts.map(p => [p.id, p.stock]))

    // Only include items whose productId actually exists — prevents FK violation
    // when cart was loaded from a stale localStorage/IDB cache
    const validItems = (items ?? []).filter((item: any) => stockMap.has(item.productId))
    const skippedItems = (items ?? []).filter((item: any) => !stockMap.has(item.productId))
    if (skippedItems.length > 0) {
      console.warn(`[sales POST] Skipped ${skippedItems.length} items with missing productIds:`, skippedItems.map((i: any) => i.productId))
    }

    if (validItems.length === 0) {
      return NextResponse.json({ error: "No valid products found in cart. Please refresh the POS and try again." }, { status: 400 })
    }

    // Recalculate total from valid items only if some were skipped
    const effectiveTotal = skippedItems.length > 0
      ? validItems.reduce((sum: number, i: any) => sum + i.subtotal, 0)
      : total
    const effectiveProfit = skippedItems.length > 0
      ? validItems.reduce((sum: number, i: any) => sum + (i.price - (i.cost ?? 0)) * i.quantity, 0)
      : (profit ?? 0)

    const sale = await prisma.$transaction(async (tx) => {
      const created = await tx.sale.create({
        data: {
          id,
          storeId,
          total: effectiveTotal,
          profit: effectiveProfit,
          paymentMethod,
          status: status ?? "completed",
          items: {
            create: validItems.map((item: any) => ({
              id: item.id,
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              price: item.price,
              cost: item.cost ?? 0,
              subtotal: item.subtotal,
              selectedVariants: item.selectedVariants,
            })),
          },
        },
      })

      // Batch update all product stocks in parallel
      await Promise.all(
        validItems.map(async (item: any) => {
          const prevStock = stockMap.get(item.productId)
          if (prevStock === undefined) return
          const newStock = prevStock - item.quantity
          await tx.product.update({ where: { id: item.productId }, data: { stock: newStock } })
          await tx.inventoryTransaction.create({
            data: {
              storeId,
              productId: item.productId,
              productName: item.productName,
              type: "sale",
              quantity: -item.quantity,
              previousStock: prevStock,
              newStock,
              notes: "Sale transaction",
            },
          })
        })
      )

      return created
    })

    return NextResponse.json({ data: sale })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...data } = body
    const sale = await prisma.sale.update({ where: { id }, data })
    return NextResponse.json({ data: sale })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
