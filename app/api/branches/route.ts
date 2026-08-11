import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function GET(req: NextRequest) {
  const mainExternalId = req.nextUrl.searchParams.get("mainExternalId")
  if (!mainExternalId) return NextResponse.json({ error: "Missing mainExternalId" }, { status: 400 })
  const branches = await prisma.storeBranch.findMany({
    where: { mainExternalId, isActive: true },
    orderBy: { branchName: "asc" },
  })
  return NextResponse.json({ data: branches })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { mainExternalId, branchExternalId, branchName, address, phone, ownerPin } = body

    if (!branchExternalId || branchExternalId.length < 4 || branchExternalId.length > 8)
      return NextResponse.json({ error: "Branch Store ID must be 4–8 characters" }, { status: 400 })
    if (branchExternalId === mainExternalId)
      return NextResponse.json({ error: "Branch Store ID cannot be the same as the main store" }, { status: 400 })
    if (!branchName?.trim())
      return NextResponse.json({ error: "Branch name is required" }, { status: 400 })

    // Check uniqueness
    const existing = await prisma.storeBranch.findUnique({ where: { branchExternalId } })
    if (existing) return NextResponse.json({ error: "This Store ID is already registered as a branch" }, { status: 400 })

    const existingSub = await prisma.customerSubscription.findUnique({ where: { externalId: branchExternalId } })
    if (existingSub) return NextResponse.json({ error: "This Store ID is already in use. Choose another." }, { status: 400 })

    // Get main subscription to inherit settings
    const mainSub = await prisma.customerSubscription.findUnique({ where: { externalId: mainExternalId } })

    // Create branch record
    const branch = await prisma.storeBranch.create({
      data: { mainExternalId, branchExternalId, branchName: branchName.trim(), address: address?.trim() || "", phone: phone?.trim() || "" },
    })

    // Create branch subscription inheriting from main
    await prisma.customerSubscription.create({
      data: {
        ownerName: mainSub?.ownerName || "Branch Owner",
        ownerEmail: mainSub?.ownerEmail || "",
        storeName: branchName.trim(),
        businessType: mainSub?.businessType || "retail",
        phone: phone?.trim() || mainSub?.phone || "",
        planId: mainSub?.planId || null,
        tier: (mainSub?.tier as any) || "basic",
        status: "active",
        startDate: mainSub?.startDate || new Date(),
        endDate: mainSub?.endDate || null,
        features: mainSub?.features || { pos: true, inventory: true, ewallet: true, reports: true, loyalty: false, utang: false, aiRestock: false, multiUser: true, exportData: false, marketIntelligence: false, delivery: false },
        externalId: branchExternalId,
        parentExternalId: mainExternalId,
        notes: `Branch of ${mainExternalId}`,
      },
    })

    // Create store settings for branch
    await prisma.storeSetting.upsert({
      where: { storeId: branchExternalId },
      update: { name: branchName.trim(), address: address?.trim() || "", phone: phone?.trim() || "" },
      create: { storeId: branchExternalId, name: branchName.trim(), address: address?.trim() || "", phone: phone?.trim() || "", businessType: mainSub?.businessType || "retail" },
    })

    // Create owner user for branch if PIN provided
    if (ownerPin?.trim()) {
      const username = `branch-${branchExternalId}`
      const exists = await prisma.storeUser.findFirst({ where: { externalId: branchExternalId, username } })
      if (!exists) {
        await prisma.storeUser.create({
          data: { externalId: branchExternalId, name: `${branchName.trim()} Owner`, username, pin: ownerPin.trim(), role: "owner", isActive: true },
        })
      }
    }

    return NextResponse.json({ data: branch })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, ...data } = await req.json()
    const branch = await prisma.storeBranch.update({ where: { id }, data })
    return NextResponse.json({ data: branch })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
