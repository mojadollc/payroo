import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"
import { randomUUID } from "crypto"

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  const storeId = p.get("storeId")
  if (!storeId) return NextResponse.json({ error: "Missing storeId" }, { status: 400 })

  const from = p.get("from")
  const to = p.get("to")
  const where: any = { storeId }
  if (from || to) {
    where.createdAt = {}
    if (from) where.createdAt.gte = new Date(from)
    if (to) where.createdAt.lte = new Date(to)
  }

  const data = await prisma.billPayment.findMany({ where, orderBy: { createdAt: "desc" } })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { storeId, billerName, accountNumber, amount, serviceFee, notes } = body

    if (!storeId || !billerName || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const fee = Number(serviceFee) || 0
    const txnRef = `BP-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`

    const record = await prisma.billPayment.create({
      data: {
        storeId,
        txnRef,
        billerName,
        accountNumber: accountNumber || `ACC-${Date.now()}`,
        amount: Number(amount),
        serviceFee: fee,
        totalAmount: Number(amount) + fee,
        notes: notes || null,
      },
    })

    return NextResponse.json({ data: record })
  } catch (err: any) {
    console.error("[bill-payments] POST error:", err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  try {
    await prisma.billPayment.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
