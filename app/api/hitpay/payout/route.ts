import { NextRequest, NextResponse } from "next/server"

// HitPay payout channel mapping
// Ref: https://docs.hitpayapp.com/apis/guide/payouts
export const HITPAY_CHANNELS: Record<string, { label: string; type: "wallet" | "bank" | "otc" }> = {
  gcash:      { label: "GCash",      type: "wallet" },
  paymaya:    { label: "Maya",       type: "wallet" },
  shopeepay:  { label: "ShopeePay", type: "wallet" },
  grabpay:    { label: "GrabPay",   type: "wallet" },
  bpi:        { label: "BPI",        type: "bank" },
  unionbank:  { label: "UnionBank",  type: "bank" },
  chinabank:  { label: "China Bank", type: "bank" },
  rcbc:       { label: "RCBC",       type: "bank" },
  bdo:        { label: "BDO",        type: "bank" },
  metrobank:  { label: "Metrobank",  type: "bank" },
  landbank:   { label: "Landbank",   type: "bank" },
  pnb:        { label: "PNB",        type: "bank" },
  instapay:   { label: "InstaPay",   type: "bank" },
  pesonet:    { label: "PESONet",    type: "bank" },
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.HITPAY_API_KEY
  const apiUrl = process.env.HITPAY_API_URL ?? "https://api.hit-pay.com/v1"

  if (!apiKey) return NextResponse.json({ error: "HitPay not configured" }, { status: 500 })

  try {
    const { channel, accountNumber, accountName, amount, purpose, email } = await req.json()

    if (!channel || !accountNumber || !amount) {
      return NextResponse.json({ error: "Missing required fields: channel, accountNumber, amount" }, { status: 400 })
    }
    if (!HITPAY_CHANNELS[channel]) {
      return NextResponse.json({ error: `Unsupported channel: ${channel}` }, { status: 400 })
    }
    if (amount < 1) {
      return NextResponse.json({ error: "Minimum payout is ₱1" }, { status: 400 })
    }

    const body: Record<string, any> = {
      amount: String(amount),
      currency: "PHP",
      payment_method: channel,
      phone_number: accountNumber,
      name: accountName || "Customer",
      purpose: purpose || "Cash-in payout",
    }
    if (email) body.email = email

    const res = await fetch(`${apiUrl}/payouts`, {
      method: "POST",
      headers: {
        "X-BUSINESS-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    const resText = await res.text()
    console.error(`[hitpay/payout] HTTP ${res.status} raw body:`, resText)
    let data: any = null
    try { data = JSON.parse(resText) } catch {}

    if (!res.ok) {
      const raw = data?.message ?? data?.error ?? data?.errors ?? (data ? JSON.stringify(data) : `HTTP ${res.status}`)
      const status = res.status
      console.error(`[hitpay/payout] HTTP ${status}:`, raw, data)
      let friendly: string
      if (status === 401 || status === 403) friendly = "Invalid HitPay API key. Please check your credentials."
      else if (typeof raw === "string" && (raw.toLowerCase().includes("insufficient") || raw.toLowerCase().includes("balance"))) friendly = "Insufficient HitPay wallet balance. Please top up your HitPay account."
      else if (typeof raw === "string" && (raw.toLowerCase().includes("minimum") || (raw.toLowerCase().includes("amount") && !raw.toLowerCase().includes("account")))) friendly = "Amount is below the minimum allowed by HitPay."
      else if (typeof raw === "string" && (raw.toLowerCase().includes("account") || raw.toLowerCase().includes("invalid") || raw.toLowerCase().includes("phone"))) friendly = "Invalid account number or mobile number. Please double-check and try again."
      else if (typeof raw === "string" && (raw.toLowerCase().includes("channel") || raw.toLowerCase().includes("method"))) friendly = "This payment channel is currently unavailable. Try a different one."
      else if (typeof raw === "string" && raw.toLowerCase().includes("limit")) friendly = "Transaction limit exceeded. Please try a smaller amount."
      else if (typeof raw === "string" && raw.toLowerCase().includes("duplicate")) friendly = "Duplicate transaction detected. Please wait before retrying."
      else friendly = typeof raw === "string" ? raw : JSON.stringify(raw)
      return NextResponse.json({ error: friendly, raw, status }, { status })
    }

    return NextResponse.json({ ok: true, payout: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
