import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get("storeId")
  if (!storeId) return NextResponse.json({ error: "Missing storeId" }, { status: 400 })
  let item = await prisma.loyaltySettings.findUnique({ where: { storeId } })
  if (!item) item = await prisma.loyaltySettings.create({ data: { storeId, minRedeemCoins: 100, coinValuePeso: 1 } })
  return NextResponse.json({ data: item })
}

export async function POST(req: NextRequest) {
  try {
    const { storeId, minRedeemCoins, coinValuePeso } = await req.json()
    const item = await prisma.loyaltySettings.upsert({
      where: { storeId },
      update: { minRedeemCoins, coinValuePeso },
      create: { storeId, minRedeemCoins, coinValuePeso },
    })
    return NextResponse.json({ data: item })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
