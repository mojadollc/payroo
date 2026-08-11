import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function GET(req: NextRequest) {
  const externalId = req.nextUrl.searchParams.get("externalId")
  if (!externalId) return NextResponse.json({ error: "Missing externalId" }, { status: 400 })
  const items = await prisma.storeUser.findMany({ where: { externalId }, orderBy: { createdAt: "asc" } })
  return NextResponse.json({ data: items })
}

export async function POST(req: NextRequest) {
  try {
    const { externalId, name, username, pin, role, isActive, allowedFeatures, permissions } = await req.json()
    const existing = await prisma.storeUser.findFirst({ where: { externalId, username } })
    if (existing) return NextResponse.json({ error: "Username already exists in this store." }, { status: 400 })
    const item = await prisma.storeUser.create({
      data: { externalId, name, username, pin, role, isActive: isActive ?? true, allowedFeatures, permissions },
    })
    return NextResponse.json({ data: item })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, ...data } = await req.json()
    const item = await prisma.storeUser.update({ where: { id }, data })
    return NextResponse.json({ data: item })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  await prisma.storeUser.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
