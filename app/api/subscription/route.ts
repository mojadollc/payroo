import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function GET(req: NextRequest) {
  const externalId = req.nextUrl.searchParams.get("externalId")
  const mainId = req.nextUrl.searchParams.get("mainId")

  if (!externalId) return NextResponse.json({ error: "Missing externalId" }, { status: 400 })

  try {
    let sub = await prisma.customerSubscription.findFirst({
      where: { externalId },
      orderBy: { createdAt: "desc" },
    })

    // Branch fallback: inherit HQ plan if branch has no active sub
    if ((!sub || sub.status !== "active") && mainId && mainId !== externalId) {
      const mainSub = await prisma.customerSubscription.findFirst({
        where: { externalId: mainId },
        orderBy: { createdAt: "desc" },
      })
      if (mainSub && mainSub.status === "active") {
        sub = mainSub
      }
    }

    if (!sub) return NextResponse.json({ data: null })

    return NextResponse.json({
      data: {
        status: sub.status,
        tier: sub.tier,
        features: sub.features,
        storeName: sub.storeName,
        businessType: sub.businessType,
        ownerName: sub.ownerName,
        ownerEmail: sub.ownerEmail,
        endDate: sub.endDate?.toISOString() ?? null,
        externalId: sub.externalId,
      },
    })
  } catch (err) {
    console.error("subscription API error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
