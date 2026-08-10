import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get("storeId")
  if (!storeId) return NextResponse.json({ error: "Missing storeId" }, { status: 400 })
  const items = await prisma.inventoryTransaction.findMany({ where: { storeId }, orderBy: { createdAt: "desc" } })
  return NextResponse.json({ data: items })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, storeId, productId, productName, type, quantity, previousStock, newStock, notes } = body
    const item = await prisma.inventoryTransaction.create({
      data: { id, storeId, productId, productName, type, quantity, previousStock, newStock, notes },
    })
    return NextResponse.json({ data: item })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
