import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get("storeId")
  if (!storeId) return NextResponse.json({ error: "Missing storeId" }, { status: 400 })
  const items = await prisma.sale.findMany({ where: { storeId }, include: { items: true }, orderBy: { createdAt: "desc" } })
  return NextResponse.json({ data: items })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, storeId, total, profit, paymentMethod, status, items } = body
    const sale = await prisma.sale.create({
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
    return NextResponse.json({ data: sale })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
