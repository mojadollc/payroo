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
    const { external_id, status, id, failure_code } = body

    // ── Cashin disbursement webhook ──────────────────────────────────────────
    const txn = await prisma.cashinTransaction.findUnique({ where: { txnId: external_id } })
    if (txn) {
      const upperStatus = status?.toUpperCase() ?? ""
      const normalizedStatus =
        ["COMPLETED", "SUCCEEDED", "SUCCESS", "SETTLED", "PAID"].includes(upperStatus) ? "COMPLETED" :
        ["FAILED", "CANCELLED", "VOIDED", "REJECTED", "EXPIRED"].includes(upperStatus) ? "FAILED" :
        "PENDING"
      await prisma.cashinTransaction.update({
        where: { txnId: external_id },
        data: {
          status: normalizedStatus,
          xenditRawStatus: upperStatus,
          webhookReceivedAt: new Date(),
          ...(failure_code && { failureCode: failure_code }),
        },
      })
      return NextResponse.json({ received: true })
    }

    // ── Subscription invoice webhook ─────────────────────────────────────────
    const upperStatus = status?.toUpperCase() ?? ""
    const isPaid = ["PAID", "COMPLETED", "SUCCEEDED", "SUCCESS", "SETTLED"].includes(upperStatus)

    const sub = await prisma.customerSubscription.findFirst({ where: { externalId: external_id } })
    if (sub && isPaid && sub.status !== "active") {
      const now = new Date()
      const endDate = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
      const ownerPin = String(Math.floor(100000 + Math.random() * 900000))
      const username = sub.ownerName.trim().split(" ")[0].toLowerCase().replace(/[^a-z0-9]/g, "")

      await prisma.$transaction(async (tx) => {
        await tx.customerSubscription.update({
          where: { id: sub.id },
          data: {
            status: "active",
            xenditPaymentStatus: "PAID",
            xenditInvoiceId: id ?? sub.xenditInvoiceId,
            startDate: now,
            endDate,
          },
        })

        const existingOwner = await tx.storeUser.findFirst({ where: { externalId: external_id, role: "owner" } })
        if (!existingOwner) {
          await tx.storeUser.create({
            data: { externalId: external_id, name: sub.ownerName, username, pin: ownerPin, role: "owner", isActive: true },
          })
        }
      })

      // Send welcome email
      try {
        const plan = await prisma.subscriptionPlan.findUnique({ where: { id: sub.planId } })
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/send-welcome`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ownerName: sub.ownerName,
            ownerEmail: sub.ownerEmail,
            storeName: sub.storeName,
            storeId: external_id,
            ownerPin,
            planName: plan?.name ?? "Subscription",
            planPrice: plan?.price ?? 0,
            appUrl: process.env.NEXT_PUBLIC_APP_URL,
          }),
        })
      } catch (err) {
        console.error("Failed to send welcome email after payment:", err)
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error("Xendit webhook error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
