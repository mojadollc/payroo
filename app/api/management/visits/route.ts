import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function GET() {
  const data = await prisma.siteVisit.findMany({ orderBy: { createdAt: "desc" }, take: 500 })
  return NextResponse.json({ data })
}
