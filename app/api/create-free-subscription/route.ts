import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function POST(req: NextRequest) {
  try {
    const { planId, planName, ownerName, ownerEmail, storeName, phone, businessType, referralCode } = await req.json()

    if (!planId || !planName || !ownerName || !ownerEmail || !storeName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Block if already has an active non-expired subscription
    const existing = await prisma.customerSubscription.findMany({
      where: { ownerEmail },
      orderBy: { createdAt: "desc" },
      take: 5,
    })

    for (const sub of existing) {
      if (sub.status === "active" && sub.endDate && sub.endDate > new Date()) {
        return NextResponse.json(
          { error: "You already have an active subscription. Please wait until it expires or contact support." },
          { status: 409 }
        )
      }
      if (sub.status === "pending") {
        await prisma.customerSubscription.delete({ where: { id: sub.id } })
      }
    }

    const externalId = String(Math.floor(100000 + Math.random() * 900000))

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } })
    const planTier = (plan?.tier ?? "basic") as any
    const planFeatures = (plan?.features ?? {}) as any

    const now = new Date()
    const endDate = new Date(now.getFullYear() + 10, now.getMonth(), now.getDate())

    const ownerPin = String(Math.floor(100000 + Math.random() * 900000))
    const username = ownerName.trim().split(" ")[0].toLowerCase().replace(/[^a-z0-9]/g, "")

    await prisma.$transaction(async (tx) => {
      await tx.customerSubscription.create({
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
          status: "active",
          xenditPaymentStatus: "PAID",
          referralCode: referralCode || "",
          startDate: now,
          endDate,
          notes: "FREE plan subscription - no payment required",
        },
      })

      const existingOwner = await tx.storeUser.findFirst({ where: { externalId, role: "owner" } })
      if (!existingOwner) {
        await tx.storeUser.create({
          data: { externalId, name: ownerName, username, pin: ownerPin, role: "owner", isActive: true },
        })
      }
    })

    // Send welcome email with credentials
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/send-welcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerName, ownerEmail, storeName,
          storeId: externalId,
          ownerPin,
          planName: plan?.name ?? planName,
          planPrice: 0,
          appUrl: process.env.NEXT_PUBLIC_APP_URL,
        }),
      })
    } catch (err) {
      console.error("Failed to send welcome email:", err)
    }

    if (referralCode) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/credit-affiliate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ referralCode, referredEmail: ownerEmail, referredStoreName: storeName, planName, planPrice: 0 }),
        })
      } catch (err) {
        console.error("Failed to credit affiliate:", err)
      }
    }

    return NextResponse.json({ success: true, externalId, message: "FREE subscription created successfully" })
  } catch (err) {
    console.error("create-free-subscription error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
