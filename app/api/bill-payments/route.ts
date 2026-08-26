import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"
import { randomUUID } from "crypto"

const XENDIT_OTC_CHANNELS = ["CEBUANA", "LBC"]

async function createXenditOTC(
  channelCode: string,
  customerName: string,
  amount: number,
  referenceId: string
) {
  const secretKey = process.env.XENDIT_SECRET_KEY!
  const token = Buffer.from(`${secretKey}:`).toString("base64")

  const res = await fetch("https://api.xendit.co/payment_requests", {
    method: "POST",
    headers: {
      Authorization: `Basic ${token}`,
      "Content-Type": "application/json",
      "api-version": "2022-07-31",
    },
    body: JSON.stringify({
      currency: "PHP",
      amount,
      reference_id: referenceId,
      payment_method: {
        type: "OVER_THE_COUNTER",
        reusability: "ONE_TIME_USE",
        over_the_counter: {
          channel_code: channelCode,
          channel_properties: { customer_name: customerName },
        },
      },
    }),
  })

  return res.json()
}

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
    const { storeId, billerName, accountNumber, amount, serviceFee, notes, customerName } = body

    if (!storeId || !billerName || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const fee = Number(serviceFee) || 0
    const txnRef = `BP-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`
    const channelCode = billerName.toUpperCase()

    let paymentCode: string | null = null
    let xenditPaymentId: string | null = null
    let status = "COMPLETED"

    // For activated Xendit OTC channels, generate a real payment code
    if (XENDIT_OTC_CHANNELS.includes(channelCode)) {
      const xendit = await createXenditOTC(
        channelCode,
        customerName || "Customer",
        Number(amount),
        txnRef
      )

      if (xendit.error_code) {
        return NextResponse.json({ error: xendit.message }, { status: 400 })
      }

      paymentCode = xendit.payment_method?.over_the_counter?.channel_properties?.payment_code ?? null
      xenditPaymentId = xendit.id ?? null
      status = "PENDING"
    }

    const record = await prisma.billPayment.create({
      data: {
        storeId,
        txnRef,
        billerName,
        accountNumber: accountNumber || `ACC-${Date.now()}`,
        amount: Number(amount),
        serviceFee: fee,
        totalAmount: Number(amount) + fee,
        status,
        notes: paymentCode ? `PAYMENT_CODE:${paymentCode}${notes ? ` | ${notes}` : ""}` : (notes || null),
      },
    })

    return NextResponse.json({ data: { ...record, paymentCode, xenditPaymentId } })
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
