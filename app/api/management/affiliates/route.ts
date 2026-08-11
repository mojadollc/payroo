import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email")
  if (email) {
    const item = await prisma.affiliate.findUnique({ where: { email } })
    return NextResponse.json({ data: item })
  }
  const data = await prisma.affiliate.findMany({ orderBy: { createdAt: "desc" } })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, createdAt, updatedAt, earnings, withdrawals, ...rest } = body
    if (id) {
      const updated = await prisma.affiliate.update({ where: { id }, data: rest })
      return NextResponse.json({ data: updated })
    }
    // Upsert by email
    const existing = await prisma.affiliate.findUnique({ where: { email: rest.email } })
    if (existing) return NextResponse.json({ data: existing })
    const referralCode = `mjd-${Math.random().toString(36).slice(2, 8)}`
    const created = await prisma.affiliate.create({
      data: { ...rest, referralCode, walletBalance: 0, totalEarned: 0, totalWithdrawn: 0, totalReferrals: 0, isActive: true },
    })
    return NextResponse.json({ data: created })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
