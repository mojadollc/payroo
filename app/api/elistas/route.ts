import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")
  if (!userId) return NextResponse.json({ data: [] })
  const data = await prisma.elista.findMany({ where: { userId }, orderBy: { createdAt: "desc" } })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...rest } = body
    if (id) {
      const updated = await prisma.elista.update({ where: { id }, data: { title: rest.title, items: rest.items, updatedAt: new Date() } })
      return NextResponse.json({ data: updated })
    }
    const created = await prisma.elista.create({
      data: {
        userId: rest.userId,
        storeId: rest.storeId ?? "",
        title: rest.title,
        items: rest.items,
      }
    })
    return NextResponse.json({ data: created })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  await prisma.elista.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
