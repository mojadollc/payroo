import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

const ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN || "superadmin2024"

export async function POST(req: NextRequest) {
  try {
    const { adminPin, externalId, newPin } = await req.json()

    if (adminPin !== ADMIN_PIN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!externalId) {
      return NextResponse.json({ error: "Missing externalId" }, { status: 400 })
    }

    const sub = await prisma.customerSubscription.findFirst({
      where: { externalId },
    })

    if (!sub) {
      return NextResponse.json({ error: `No subscription found for store ID: ${externalId}` }, { status: 404 })
    }

    const existingOwner = await prisma.storeUser.findFirst({
      where: { externalId, role: "owner" },
    })

    const ownerPin = newPin?.trim() || String(Math.floor(100000 + Math.random() * 900000))
    const username = sub.ownerName.trim().split(" ")[0].toLowerCase().replace(/[^a-z0-9]/g, "")

    if (existingOwner) {
      // Update PIN on existing owner
      await prisma.storeUser.update({
        where: { id: existingOwner.id },
        data: { pin: ownerPin, isActive: true },
      })
      return NextResponse.json({
        success: true,
        action: "updated",
        storeId: externalId,
        pin: ownerPin,
        username: existingOwner.username,
        ownerName: sub.ownerName,
        ownerEmail: sub.ownerEmail,
      })
    }

    // Create missing owner record
    await prisma.storeUser.create({
      data: { externalId, name: sub.ownerName, username, pin: ownerPin, role: "owner", isActive: true },
    })

    // Also ensure subscription is active
    if (sub.status !== "active") {
      const now = new Date()
      const endDate = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
      await prisma.customerSubscription.update({
        where: { id: sub.id },
        data: { status: "active", startDate: now, endDate },
      })
    }

    return NextResponse.json({
      success: true,
      action: "created",
      storeId: externalId,
      pin: ownerPin,
      username,
      ownerName: sub.ownerName,
      ownerEmail: sub.ownerEmail,
    })
  } catch (err: any) {
    console.error("repair-account error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
