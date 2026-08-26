import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function GET(req: NextRequest) {
  const utangId = req.nextUrl.searchParams.get("utangId")
  if (!utangId) return NextResponse.json({ error: "Missing utangId" }, { status: 400 })
  const items = await prisma.utangPayment.findMany({ where: { utangId }, orderBy: { createdAt: "desc" } })
  return NextResponse.json({ data: items })
}

export async function POST(req: NextRequest) {
  try {
    const { utangId, customerName, amount, method, referenceNumber, newBalance } = await req.json()
    const result = await prisma.$transaction(async (tx) => {
      // Record the payment
      const payment = await tx.utangPayment.create({
        data: { utangId, customerName, amount, method, referenceNumber },
      })
      const status = newBalance <= 0 ? "settled" : "partial"
      await tx.utangRecord.update({
        where: { id: utangId },
        data: { balance: Math.max(0, newBalance), amountPaid: { increment: amount }, status },
      })

      // Create a sale record for the payment with the original utang items
      const utang = await tx.utangRecord.findUnique({
        where: { id: utangId },
        include: { items: true },
      })
      if (utang) {
        await tx.sale.create({
          data: {
            storeId: utang.storeId,
            total: amount,
            profit: 0,
            paymentMethod: method,
            status: "completed",
            utangCustomerName: customerName,
            utangId,
            items: {
              create: utang.items.map((item) => ({
                productName: item.productName,
                quantity: item.quantity,
                price: item.price,
                cost: 0,
                subtotal: item.subtotal,
              })),
            },
          },
        })
      }

      return payment
    })
    return NextResponse.json({ data: result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
