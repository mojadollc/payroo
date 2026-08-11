import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function GET(req: NextRequest) {
  const customerId = req.nextUrl.searchParams.get("customerId")
  if (!customerId) return NextResponse.json({ error: "Missing customerId" }, { status: 400 })
  const items = await prisma.loyaltyTransaction.findMany({ where: { customerId }, orderBy: { createdAt: "desc" } })
  return NextResponse.json({ data: items })
}
