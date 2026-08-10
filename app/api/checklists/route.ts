import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 })
  const data = await prisma.checklist.findMany({ where: { userId }, orderBy: { createdAt: "desc" } })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...rest } = body
    if (id) {
      const updated = await prisma.checklist.update({ where: { id }, data: rest })
      return NextResponse.json({ data: updated })
    }
    const created = await prisma.checklist.create({ data: rest })
    return NextResponse.json({ data: created })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  await prisma.checklist.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
