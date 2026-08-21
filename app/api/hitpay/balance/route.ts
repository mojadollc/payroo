import { NextResponse } from "next/server"

export async function GET() {
  const provider = (process.env.PAYOUT_PROVIDER ?? "xendit").toLowerCase()

  try {
    if (provider === "hitpay") {
      const apiKey = process.env.HITPAY_API_KEY
      const apiUrl = process.env.HITPAY_API_URL ?? "https://api.hit-pay.com"
      if (!apiKey) return NextResponse.json({ error: "HitPay not configured" }, { status: 500 })

      const res = await fetch(`${apiUrl}/v1/wallet-balances`, {
        headers: { "X-BUSINESS-API-KEY": apiKey },
        next: { revalidate: 30 },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return NextResponse.json({ error: err.message ?? "Failed to fetch balance" }, { status: res.status })
      }
      const data = await res.json()
      const php = Array.isArray(data)
        ? data.find((w: any) => w.currency?.toUpperCase() === "PHP")
        : data
      return NextResponse.json({ balance: php?.balance ?? php?.available_balance ?? 0, provider: "hitpay", raw: data })
    }

    // Xendit
    const apiKey = process.env.XENDIT_SECRET_KEY
    if (!apiKey) return NextResponse.json({ error: "Xendit not configured" }, { status: 500 })

    const res = await fetch("https://api.xendit.co/balance", {
      headers: { "Authorization": "Basic " + Buffer.from(apiKey + ":").toString("base64") },
      next: { revalidate: 30 },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json({ error: err.message ?? "Failed to fetch balance" }, { status: res.status })
    }
    const data = await res.json()
    // Xendit returns { balance: number } in PHP (account currency)
    return NextResponse.json({ balance: data.balance ?? 0, provider: "xendit", raw: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
