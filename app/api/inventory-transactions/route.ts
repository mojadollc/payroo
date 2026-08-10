import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get("storeId")
  const productId = req.nextUrl.searchParams.get("productId")
  if (!storeId) return NextResponse.json({ error: "Missing storeId" }, { status: 400 })
  const where: any = { storeId }
  if (productId) where.productId = productId
  const items = await prisma.inventoryTransaction.findMany({ where, orderBy: { createdAt: "desc" } })
  return NextResponse.json({ data: items })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, storeId, productId, productName, type, quantity, previousStock, newStock, notes } = body

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryTransaction.create({
        data: { id, storeId, productId, productName, type, quantity, previousStock, newStock, notes },
      })
      await tx.product.update({ where: { id: productId }, data: { stock: newStock } })
      return item
    })

    return NextResponse.json({ data: result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
