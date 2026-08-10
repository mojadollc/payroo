import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function GET() {
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
    const created = await prisma.affiliate.create({ data: rest })
    return NextResponse.json({ data: created })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
