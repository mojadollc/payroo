import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get("storeId")
  const items = await prisma.loyaltyRule.findMany()
  return NextResponse.json({ data: items })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, productId, productName, buyQty, earnCoins } = body
    const item = await prisma.loyaltyRule.upsert({
      where: { productId: productId ?? "" },
      update: { buyQty, earnCoins, productName },
      create: { id, productId, productName: productName || "", buyQty, earnCoins },
    })
    return NextResponse.json({ data: item })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  await prisma.loyaltyRule.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
