import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get("storeId")
  if (!storeId) return NextResponse.json({ error: "Missing storeId" }, { status: 400 })
  const item = await prisma.deliverySetting.findUnique({ where: { storeId } })
  return NextResponse.json({ data: item })
}

export async function POST(req: NextRequest) {
  try {
    const { storeId, ...data } = await req.json()
    const item = await prisma.deliverySetting.upsert({
      where: { storeId },
      update: data,
      create: { storeId, ...data },
    })
    return NextResponse.json({ data: item })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
