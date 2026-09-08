import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get("storeId")
  if (!storeId) return NextResponse.json({ error: "Missing storeId" }, { status: 400 })
  const item = await prisma.storeSettings.findUnique({ where: { storeId } })
  return NextResponse.json({ data: item })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { storeId, ...data } = body

    // Parse lat/lng as floats if provided as strings
    if (data.latitude !== undefined) data.latitude = data.latitude !== null ? parseFloat(data.latitude) : null
    if (data.longitude !== undefined) data.longitude = data.longitude !== null ? parseFloat(data.longitude) : null

    const item = await prisma.storeSettings.upsert({
      where: { storeId },
      update: data,
      create: { storeId, ...data },
    })
    return NextResponse.json({ data: item })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
