import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function GET() {
  const data = await prisma.subscriptionPlan.findMany({ orderBy: { price: "asc" } })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, updatedAt, ...rest } = body
    if (id) {
      const updated = await prisma.subscriptionPlan.update({ where: { id }, data: rest })
      return NextResponse.json({ data: updated })
    }
    const created = await prisma.subscriptionPlan.create({ data: rest })
    return NextResponse.json({ data: created })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  await prisma.subscriptionPlan.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
