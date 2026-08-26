import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get("storeId")
  const search = req.nextUrl.searchParams.get("search")
  // Cross-store name search for utang network warning
  if (search) {
    const items = await prisma.utangRecord.findMany({
      where: { status: { in: ["active", "partial"] }, customerName: { contains: search, mode: "insensitive" } },
      orderBy: { createdAt: "desc" },
      take: 50,
    })
    return NextResponse.json({ data: items })
  }
  if (!storeId) return NextResponse.json({ error: "Missing storeId" }, { status: 400 })
  const items = await prisma.utangRecord.findMany({ where: { storeId }, orderBy: { createdAt: "desc" } })
  return NextResponse.json({ data: items })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, storeId, storeName, customerName, customerPhone, totalAmount, amountPaid, balance, status, dueDate, notes, items } = body

    const record = await prisma.$transaction(async (tx) => {
      // Create utang record
      const created = await tx.utangRecord.create({
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

      // Deduct stock for each item that has a productId
      for (const item of items ?? []) {
        if (!item.productId) continue
        const product = await tx.product.findUnique({ where: { id: item.productId } })
        if (!product) continue
        const newStock = Math.max(0, product.stock - item.quantity)
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
            notes: `Utang - ${customerName}`,
          },
        })
      }

      // Create a sale record for utang so it appears in reports
      const profit = (items ?? []).reduce((sum: number, item: any) => {
        const cost = item.cost ?? 0
        return sum + (item.price - cost) * item.quantity
      }, 0)
      await tx.sale.create({
        data: {
          storeId,
          total: totalAmount,
          profit,
          paymentMethod: "utang",
          status: "completed",
          utangCustomerName: customerName,
          utangId: created.id,
          items: {
            create: (items ?? []).filter((item: any) => item.productId).map((item: any) => ({
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              price: item.price,
              cost: item.cost ?? 0,
              subtotal: item.subtotal,
            })),
          },
        },
      })

      return created
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
