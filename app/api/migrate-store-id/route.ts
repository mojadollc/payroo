import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function POST(req: NextRequest) {
  try {
    const { oldExternalId, ownerEmail } = await req.json()

    if (!oldExternalId && !ownerEmail) {
      return NextResponse.json({ error: "Provide oldExternalId or ownerEmail" }, { status: 400 })
    }

    const sub = await prisma.customerSubscription.findFirst({
      where: ownerEmail ? { ownerEmail } : { externalId: oldExternalId },
    })

    if (!sub) return NextResponse.json({ error: "Subscription not found" }, { status: 404 })

    if (/^\d{6}$/.test(sub.externalId)) {
      return NextResponse.json({ externalId: sub.externalId, message: "Already has a friendly ID" })
    }

    const newId = String(Math.floor(100000 + Math.random() * 900000))
    const currentId = sub.externalId

    await prisma.$transaction([
      prisma.customerSubscription.update({
        where: { id: sub.id },
        data: { externalId: newId, oldExternalId: currentId },
      }),
      prisma.storeUser.updateMany({
        where: { externalId: currentId },
        data: { externalId: newId },
      }),
    ])

    return NextResponse.json({ externalId: newId, oldExternalId: currentId, message: "Store ID migrated successfully" })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
