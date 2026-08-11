import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function GET(req: NextRequest) {
  const affiliateId = req.nextUrl.searchParams.get("affiliateId")
  if (!affiliateId) return NextResponse.json({ error: "Missing affiliateId" }, { status: 400 })
  const items = await prisma.affiliateEarning.findMany({ where: { affiliateId }, orderBy: { createdAt: "desc" } })
  return NextResponse.json({ data: items })
}
