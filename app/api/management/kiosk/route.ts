import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function GET() {
  const [kiosk, commissions, transactions] = await Promise.all([
    prisma.kioskSettings.findFirst(),
    prisma.commissionSettings.findFirst(),
    prisma.cashinTransaction.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
  ])
  return NextResponse.json({ kiosk, commissions, transactions })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, ...data } = body

    if (type === "channels") {
      const existing = await prisma.kioskSettings.findFirst()
      if (existing) {
        await prisma.kioskSettings.update({ where: { id: existing.id }, data: { enabledChannels: data.enabledChannels } })
      } else {
        await prisma.kioskSettings.create({ data: { enabledChannels: data.enabledChannels } })
      }
    }

    if (type === "fees") {
      await prisma.commissionSettings.updateMany({
        data: { xenditFlatFee: data.xenditFlatFee, adminChargeRate: data.adminChargeRate },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
