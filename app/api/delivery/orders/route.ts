import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get("storeId")
  if (!storeId) return NextResponse.json({ error: "Missing storeId" }, { status: 400 })
  const items = await prisma.deliveryOrder.findMany({ where: { storeId }, orderBy: { createdAt: "desc" } })
  return NextResponse.json({ data: items })
}

export async function POST(req: NextRequest) {
  try {
    const { storeId, storeName, customerName, customerPhone, customerAddress, items, total, deliveryFee, status, notes } = await req.json()
    const order = await prisma.deliveryOrder.create({
      data: { storeId, storeName, customerName, customerPhone, customerAddress, items, total, deliveryFee: deliveryFee ?? 0, status: status ?? "pending", notes },
    })
    return NextResponse.json({ data: order })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, status } = await req.json()
    const order = await prisma.deliveryOrder.update({ where: { id }, data: { status } })
    return NextResponse.json({ data: order })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
