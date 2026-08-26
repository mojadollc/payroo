import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const secretKey = process.env.XENDIT_SECRET_KEY
  if (!secretKey) {
    return NextResponse.json({ error: "XENDIT_SECRET_KEY not configured" }, { status: 500 })
  }

  const { searchParams } = req.nextUrl
  const params = new URLSearchParams()

  const allowed = ["id", "biller", "category", "country", "availability_status", "requires_inquiry", "limit", "cursor"]
  for (const key of allowed) {
    const val = searchParams.get(key)
    if (val) params.set(key, val)
  }

  const url = `https://api.xendit.co/bill-payments/v1/product?${params.toString()}`

  const token = Buffer.from(`${secretKey}:`).toString("base64")

  const res = await fetch(url, {
    headers: {
      Authorization: `Basic ${token}`,
      accept: "application/json",
    },
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
