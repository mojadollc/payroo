import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function POST(req: NextRequest) {
  try {
    const { customerId, customerName, coins } = await req.json()
    await prisma.$transaction(async (tx) => {
      const customer = await tx.loyaltyCustomer.findUnique({ where: { id: customerId } })
      if (!customer) throw new Error("Customer not found")
      if (customer.coins < coins) throw new Error("Insufficient coins")
      await tx.loyaltyCustomer.update({
        where: { id: customerId },
        data: { coins: customer.coins - coins, totalRedeemed: customer.totalRedeemed + coins },
      })
      await tx.loyaltyTransaction.create({
        data: { customerId, customerName, type: "redeem", coins },
      })
    })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
