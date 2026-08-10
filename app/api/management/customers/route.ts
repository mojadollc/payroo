import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function GET() {
  const data = await prisma.customerSubscription.findMany({ orderBy: { createdAt: "desc" } })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, createdAt, updatedAt, plan, ...rest } = body
    // Convert date strings to Date objects
    if (rest.startDate && typeof rest.startDate === "string") rest.startDate = new Date(rest.startDate)
    if (rest.endDate && typeof rest.endDate === "string") rest.endDate = new Date(rest.endDate)
    if (id) {
      const updated = await prisma.customerSubscription.update({ where: { id }, data: rest })
      return NextResponse.json({ data: updated })
    }
    const created = await prisma.customerSubscription.create({ data: rest })
    return NextResponse.json({ data: created })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  await prisma.customerSubscription.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
