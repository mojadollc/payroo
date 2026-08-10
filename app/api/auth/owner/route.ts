import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function POST(req: NextRequest) {
  try {
    const { email, pin } = await req.json()
    if (!email || !pin) return NextResponse.json({ error: "Missing fields" }, { status: 400 })

    const sub = await prisma.customerSubscription.findFirst({
      where: { ownerEmail: email.toLowerCase().trim() },
      orderBy: { createdAt: "desc" },
    })

    if (!sub) return NextResponse.json({ error: "Email not found. Please check and try again." }, { status: 404 })

    if (sub.status === "pending") return NextResponse.json({ error: "Your payment is still being processed. Please wait a few minutes and try again." }, { status: 403 })
    if (sub.status !== "active") return NextResponse.json({ error: `Your subscription is ${sub.status}. Please renew or contact support.` }, { status: 403 })
    if (sub.endDate && sub.endDate < new Date()) return NextResponse.json({ error: "Your subscription has expired. Please renew to continue." }, { status: 403 })

    const owner = await prisma.storeUser.findFirst({
      where: { externalId: sub.externalId, role: "owner", pin: pin.trim(), isActive: true },
    })

    if (!owner) return NextResponse.json({ error: "Incorrect PIN. Please try again." }, { status: 401 })

    return NextResponse.json({ user: owner, subscription: { ...sub, endDate: sub.endDate?.toISOString() ?? null, startDate: sub.startDate?.toISOString() ?? null, createdAt: sub.createdAt?.toISOString() ?? null, updatedAt: sub.updatedAt?.toISOString() ?? null } })
  } catch (err) {
    console.error("owner login error:", err)
    return NextResponse.json({ error: "Login failed. Please try again." }, { status: 500 })
  }
}
