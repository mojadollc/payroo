import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get("storeId")
  if (!storeId) return NextResponse.json({ error: "Missing storeId" }, { status: 400 })
  const items = await prisma.utangRecord.findMany({ where: { storeId }, orderBy: { createdAt: "desc" } })
  return NextResponse.json({ data: items })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, storeId, storeName, customerName, customerPhone, totalAmount, amountPaid, balance, status, dueDate, notes, items } = body
    const record = await prisma.utangRecord.create({
      data: {
        id,
        storeId,
        storeName,
        customerName,
        customerPhone,
        totalAmount,
        amountPaid: amountPaid ?? 0,
        balance,
        status: status ?? "active",
        dueDate: dueDate ? new Date(dueDate) : null,
        notes,
        items: {
          create: (items ?? []).map((item: any) => ({
            id: item.id,
            productName: item.productName,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.subtotal,
          })),
        },
      },
    })
    return NextResponse.json({ data: record })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...data } = body
    if (data.dueDate) data.dueDate = new Date(data.dueDate)
    const record = await prisma.utangRecord.update({ where: { id }, data })
    return NextResponse.json({ data: record })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  await prisma.utangRecord.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
