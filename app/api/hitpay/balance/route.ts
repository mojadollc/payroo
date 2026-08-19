import { NextResponse } from "next/server"

export async function GET() {
  const apiKey = process.env.HITPAY_API_KEY
  const apiUrl = process.env.HITPAY_API_URL ?? "https://api.hit-pay.com/v1"

  if (!apiKey) return NextResponse.json({ error: "HitPay not configured" }, { status: 500 })

  try {
    const res = await fetch(`${apiUrl}/wallet-balances`, {
      headers: { "X-BUSINESS-API-KEY": apiKey, "Content-Type": "application/json" },
      next: { revalidate: 30 },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json({ error: err.message ?? "Failed to fetch balance" }, { status: res.status })
    }
    const data = await res.json()
    // HitPay returns array of wallet balances per currency
    // We want PHP balance
    const php = Array.isArray(data)
      ? data.find((w: any) => w.currency?.toUpperCase() === "PHP")
      : data
    return NextResponse.json({ balance: php?.balance ?? php?.available_balance ?? 0, raw: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
