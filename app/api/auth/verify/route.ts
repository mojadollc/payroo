import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

// Lightweight endpoint — just returns updatedAt for a user id.
// Used by the client to detect PIN/account changes and force re-login.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  const user = await prisma.storeUser.findUnique({
    where: { id },
    select: { updatedAt: true, isActive: true },
  })

  if (!user) return NextResponse.json({ valid: false })

  return NextResponse.json({
    valid: user.isActive,
    ts: user.updatedAt.getTime(),
  }, {
    headers: { "Cache-Control": "no-store" },
  })
}
