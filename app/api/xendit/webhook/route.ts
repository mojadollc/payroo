import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

const WEBHOOK_TOKEN = process.env.XENDIT_WEBHOOK_TOKEN || ""

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("x-callback-token")
    if (token !== WEBHOOK_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { reference_id, status, id, failure_code } = body

    if (!reference_id || !status) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    }

    const upperStatus = status.toUpperCase()
    const normalizedStatus =
      ["COMPLETED", "SUCCEEDED", "SUCCESS", "SETTLED", "PAID"].includes(upperStatus) ? "COMPLETED" :
      ["FAILED", "CANCELLED", "VOIDED", "REJECTED", "EXPIRED"].includes(upperStatus) ? "FAILED" :
      "PENDING"

    const txn = await prisma.cashinTransaction.findUnique({ where: { txnId: reference_id } })
    if (txn) {
      await prisma.cashinTransaction.update({
        where: { txnId: reference_id },
        data: {
          status: normalizedStatus,
          xenditRawStatus: upperStatus,
          webhookReceivedAt: new Date(),
          ...(failure_code && { failureCode: failure_code }),
        },
      })
    } else {
      console.warn(`Xendit webhook: txn ${reference_id} not found`)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error("Xendit webhook error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
