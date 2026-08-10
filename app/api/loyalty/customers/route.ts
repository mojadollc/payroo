import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get("storeId")
  const qrCode = req.nextUrl.searchParams.get("qrCode")
  if (!storeId) return NextResponse.json({ error: "Missing storeId" }, { status: 400 })
  if (qrCode) {
    const item = await prisma.loyaltyCustomer.findFirst({ where: { qrCode } })
    return NextResponse.json({ data: item })
  }
  const items = await prisma.loyaltyCustomer.findMany({ where: { storeId }, orderBy: { name: "asc" } })
  return NextResponse.json({ data: items })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, storeId, name, phone, coins, totalEarned, totalRedeemed, qrCode } = body
    const item = await prisma.loyaltyCustomer.upsert({
      where: { id: id ?? "" },
      update: { name, phone, coins, totalEarned, totalRedeemed },
      create: {
        id,
        storeId,
        name,
        phone: phone || "",
        coins: coins ?? 0,
        totalEarned: totalEarned ?? 0,
        totalRedeemed: totalRedeemed ?? 0,
        qrCode: qrCode || `loyalty-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      },
    })
    return NextResponse.json({ data: item })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  await prisma.loyaltyCustomer.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
