import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function POST(req: NextRequest) {
  try {
    const { storeId, pin } = await req.json()
    if (!storeId || !pin) return NextResponse.json({ error: "Missing fields" }, { status: 400 })

    const user = await prisma.storeUser.findFirst({
      where: { externalId: storeId.trim(), pin: pin.trim(), isActive: true },
    })

    if (!user) return NextResponse.json({ error: "Invalid Store ID or PIN." }, { status: 401 })

    return NextResponse.json({ user })
  } catch (err) {
    console.error("staff login error:", err)
    return NextResponse.json({ error: "Login failed. Please try again." }, { status: 500 })
  }
}
