import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

const DEFAULTS = {
  xenditFlatFee: 10, xenditVatRate: 0.12, adminChargeRate: 0.01,
  sellerCashinRate: 0.02, gcashCashinRate: 0.02, gcashCashoutRate: 0.02,
  mayaCashinRate: 0.02, mayaCashoutRate: 0.02,
  eloadFeeType: "flat", eloadFeeValue: 5,
}

export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get("storeId")
  if (!storeId) return NextResponse.json({ error: "Missing storeId" }, { status: 400 })
  let item = await prisma.commissionSettings.findUnique({ where: { storeId } })
  if (!item) {
    item = await prisma.commissionSettings.create({ data: { storeId, ...DEFAULTS } })
  }
  return NextResponse.json({ data: item })
}

export async function POST(req: NextRequest) {
  try {
    const { storeId, ...data } = await req.json()
    const item = await prisma.commissionSettings.upsert({
      where: { storeId },
      update: data,
      create: { storeId, ...DEFAULTS, ...data },
    })
    return NextResponse.json({ data: item })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
