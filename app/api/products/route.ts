import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get("storeId")
  if (!storeId) return NextResponse.json({ error: "Missing storeId" }, { status: 400 })
  const items = await prisma.product.findMany({ where: { storeId } })
  return NextResponse.json({ data: items })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, storeId, name, price, cost, stock, category, barcode, imageUrl, description, unit, onSale, salePrice, sku, weight, dimensions, shippingClass, variants } = body
    const item = await prisma.product.upsert({
      where: { id: id ?? "" },
      update: { name, price, cost, stock, category, barcode, imageUrl, description, unit, onSale, salePrice, sku, weight, dimensions, shippingClass, variants },
      create: { id, storeId, name, price, cost: cost ?? 0, stock: stock ?? 0, category: category ?? "", barcode: barcode ?? "", imageUrl, description, unit, onSale: onSale ?? false, salePrice, sku, weight, dimensions, shippingClass, variants },
    })
    return NextResponse.json({ data: item })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...data } = body
    const item = await prisma.product.update({ where: { id }, data })
    return NextResponse.json({ data: item })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  await prisma.product.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
