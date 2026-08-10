import { NextRequest, NextResponse } from "next/server"

// Elistas are user-specific shopping lists stored client-side.
// This stub exists so the offline sync engine has a valid endpoint to call.
// If you add an Elista model to Prisma later, replace this with Prisma calls.

export async function GET() {
  return NextResponse.json({ data: [] })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    // No-op server side — elistas are client-only for now
    return NextResponse.json({ data: { id: body.id ?? `elista_${Date.now()}` } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
