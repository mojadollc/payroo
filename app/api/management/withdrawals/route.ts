import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function GET() {
  const data = await prisma.affiliateWithdrawal.findMany({ orderBy: { createdAt: "desc" } })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  try {
    const { id, status, notes, affiliateId, amount } = await req.json()
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

    await prisma.affiliateWithdrawal.update({ where: { id }, data: { status, notes: notes || "" } })

    // If approved, deduct from wallet; if rejected, refund
    if (status === "approved") {
      await prisma.affiliate.update({
        where: { id: affiliateId },
        data: { walletBalance: { decrement: amount }, totalWithdrawn: { increment: amount } },
      })
    } else if (status === "rejected") {
      await prisma.affiliate.update({
        where: { id: affiliateId },
        data: { walletBalance: { increment: amount } },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
