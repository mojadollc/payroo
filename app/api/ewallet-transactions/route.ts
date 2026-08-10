import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get("storeId")
  if (!storeId) return NextResponse.json({ error: "Missing storeId" }, { status: 400 })
  const items = await prisma.eWalletTransaction.findMany({ where: { storeId }, orderBy: { createdAt: "desc" } })
  return NextResponse.json({ data: items })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, storeId, type, provider, amount, commission, commissionRate, profit, customerName, customerNumber, referenceNumber, status } = body
    const item = await prisma.eWalletTransaction.create({
      data: { id, storeId, type, provider, amount, commission, commissionRate, profit, customerName, customerNumber, referenceNumber: referenceNumber ?? "", status: status ?? "completed" },
    })
    return NextResponse.json({ data: item })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  await prisma.eWalletTransaction.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
