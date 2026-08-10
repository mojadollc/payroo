import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get("storeId")
  if (!storeId) return NextResponse.json({ error: "Missing storeId" }, { status: 400 })
  const from = req.nextUrl.searchParams.get("from")
  const to = req.nextUrl.searchParams.get("to")
  const where: any = { storeId }
  if (from && to) {
    const start = new Date(from); start.setHours(0, 0, 0, 0)
    const end = new Date(to); end.setHours(23, 59, 59, 999)
    where.createdAt = { gte: start, lte: end }
  }
  const items = await prisma.sale.findMany({ where, include: { items: true }, orderBy: { createdAt: "desc" } })
  return NextResponse.json({ data: items })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, storeId, total, profit, paymentMethod, status, items } = body

    const sale = await prisma.$transaction(async (tx) => {
      const created = await tx.sale.create({
        data: {
          id,
          storeId,
          total,
          profit: profit ?? 0,
          paymentMethod,
          status: status ?? "completed",
          items: {
            create: (items ?? []).map((item: any) => ({
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

      // Deduct stock and log inventory transactions
      for (const item of items ?? []) {
        const product = await tx.product.findUnique({ where: { id: item.productId } })
        if (!product) continue
        const newStock = product.stock - item.quantity
        await tx.product.update({ where: { id: item.productId }, data: { stock: newStock } })
        await tx.inventoryTransaction.create({
          data: {
            storeId,
            productId: item.productId,
            productName: item.productName,
            type: "sale",
            quantity: -item.quantity,
            previousStock: product.stock,
            newStock,
            notes: "Sale transaction",
          },
        })
      }

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
