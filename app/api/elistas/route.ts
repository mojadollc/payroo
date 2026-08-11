import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")
  if (!userId) return NextResponse.json({ data: [] })
  try {
    const data = await prisma.$queryRaw`
      SELECT id, "userId", title, items, "createdAt", "updatedAt"
      FROM elistas
      WHERE "userId" = ${userId}
      ORDER BY "createdAt" DESC
    `
    return NextResponse.json({ data })
  } catch (err: any) {
    console.error("[elistas GET]", err.message)
    return NextResponse.json({ data: [] })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, title, items, userId } = body
    const itemsJson = JSON.stringify(items)

    if (id) {
      // Update existing
      await prisma.$executeRaw`
        UPDATE elistas
        SET title = ${title}, items = ${itemsJson}::jsonb, "updatedAt" = NOW()
        WHERE id = ${id}
      `
      return NextResponse.json({ data: { id, title, items } })
    }

    // Create new
    const newId = crypto.randomUUID()
    await prisma.$executeRaw`
      INSERT INTO elistas (id, "userId", title, items, "createdAt", "updatedAt")
      VALUES (${newId}, ${userId}, ${title}, ${itemsJson}::jsonb, NOW(), NOW())
    `
    return NextResponse.json({ data: { id: newId, userId, title, items } })
  } catch (err: any) {
    console.error("[elistas POST]", err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  try {
    await prisma.$executeRaw`DELETE FROM elistas WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("[elistas DELETE]", err.message)
    // Any error on delete — treat as ok (record may already be gone)
    return NextResponse.json({ ok: true })
  }
}
