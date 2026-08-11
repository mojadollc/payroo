import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function GET() {
  const items = await prisma.deliverySetting.findMany({ where: { enabled: true } })
  return NextResponse.json({ data: items })
}
