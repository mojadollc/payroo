import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { planId, planName, planPrice, ownerName, ownerEmail, storeName, phone, businessType, referralCode } = body

    if (!planId || !planName || planPrice === undefined || planPrice === null || !ownerName || !ownerEmail || !storeName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const secretKey = process.env.XENDIT_SECRET_KEY
    if (!secretKey) return NextResponse.json({ error: "Payment gateway not configured" }, { status: 500 })

    // Deduplication
    const existing = await prisma.customerSubscription.findMany({ where: { ownerEmail } })
    for (const sub of existing) {
      if (sub.status === "active" && sub.endDate && sub.endDate > new Date()) {
        return NextResponse.json(
          { error: "You already have an active subscription. Please wait until it expires or contact support." },
          { status: 409 }
        )
      }
      if (sub.status === "pending" && sub.planId === planId && sub.xenditPaymentUrl) {
        return NextResponse.json({ invoiceUrl: sub.xenditPaymentUrl, invoiceId: sub.xenditInvoiceId, externalId: sub.externalId })
      }
      if (sub.status === "pending") {
        await prisma.customerSubscription.delete({ where: { id: sub.id } })
      }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const externalId = String(Math.floor(100000 + Math.random() * 900000))

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } })
    const planTier = (plan?.tier ?? "basic") as any
    const planFeatures = (plan?.features ?? {}) as any

    // Create Xendit invoice
    const xenditRes = await fetch("https://api.xendit.co/v2/invoices", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(secretKey + ":").toString("base64")}`,
      },
      body: JSON.stringify({
        external_id: externalId,
        amount: planPrice,
        description: `POS Subscription — ${planName} Plan (1 month)`,
        invoice_duration: 86400,
        customer: { given_names: ownerName, email: ownerEmail, mobile_number: phone || undefined },
        customer_notification_preference: {
          invoice_created: ["email"],
          invoice_reminder: ["email"],
          invoice_paid: ["email"],
        },
        success_redirect_url: `${appUrl}/payment/success?ext=${externalId}`,
        failure_redirect_url: `${appUrl}/payment/failed?ext=${externalId}`,
        currency: "PHP",
        items: [{ name: `${planName} Plan — Monthly Subscription`, quantity: 1, price: planPrice, category: "Software Subscription" }],
      }),
    })

    if (!xenditRes.ok) {
      const err = await xenditRes.json()
      return NextResponse.json({ error: err.message || "Failed to create invoice" }, { status: 502 })
    }

    const invoice = await xenditRes.json()

    await prisma.customerSubscription.create({
      data: {
        externalId,
        ownerName,
        ownerEmail,
        storeName,
        businessType: businessType || "retail",
        phone: phone || "",
        planId,
        tier: planTier,
        features: planFeatures,
        status: "pending",
        xenditInvoiceId: invoice.id,
        xenditPaymentStatus: "PENDING",
        xenditPaymentUrl: invoice.invoice_url,
        referralCode: referralCode || "",
        notes: `Awaiting payment. Invoice: ${invoice.id}`,
      },
    })

    return NextResponse.json({ invoiceUrl: invoice.invoice_url, invoiceId: invoice.id, externalId })
  } catch (err) {
    console.error("create-invoice error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
