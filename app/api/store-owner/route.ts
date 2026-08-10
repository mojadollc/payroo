import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function GET(req: NextRequest) {
  const externalId = req.nextUrl.searchParams.get("externalId")
  if (!externalId) return NextResponse.json({ error: "Missing externalId" }, { status: 400 })

  try {
    const owner = await prisma.storeUser.findFirst({
      where: { externalId, role: "owner", isActive: true },
    })
    if (!owner) return NextResponse.json({ data: null })
    return NextResponse.json({ data: owner })
  } catch (err) {
    console.error("store-owner API error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
