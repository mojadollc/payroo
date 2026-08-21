import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const apiKey = process.env.HITPAY_API_KEY
  const apiUrl = process.env.HITPAY_API_URL ?? "https://api.hit-pay.com/v1"

  if (!apiKey) return NextResponse.json({ error: "HitPay not configured" }, { status: 500 })

  try {
    const { channel, accountNumber, accountName, amount, purpose } = await req.json()

    if (!channel || !accountNumber || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }
    if (amount < 1) {
      return NextResponse.json({ error: "Minimum payout is ₱1" }, { status: 400 })
    }

    // Map channel to HitPay transfer_method
    // Wallets (GCash, Maya, etc.) use phone_number as account_number
    // Banks use bank account number
    const walletChannels = ["gcash", "paymaya", "shopeepay", "grabpay"]
    const isWallet = walletChannels.includes(channel)

    const beneficiary: Record<string, any> = {
      country: "ph",
      transfer_method: isWallet ? channel : "bank_transfer",
      transfer_type: "local",
      currency: "php",
      holder_type: "individual",
      holder_name: accountName || "Customer",
      account_number: accountNumber,
    }

    // For bank transfers, add the rail (instapay/pesonet) and purpose
    if (!isWallet) {
      // Auto-select rail based on amount: instapay for ≤50000, pesonet for >50000
      beneficiary.transfer_type = amount <= 50000 ? "instapay" : "pesonet"
    }

    const body = {
      source_currency: "php",
      payment_amount: amount,
      purpose: purpose || "Cash-in payout",
      beneficiary,
    }

    console.log("[hitpay/payout] request body:", JSON.stringify(body))

    const res = await fetch(`${apiUrl}/transfers`, {
      method: "POST",
      headers: {
        "X-BUSINESS-API-KEY": apiKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(body),
    })

    const resText = await res.text()
    console.log(`[hitpay/payout] HTTP ${res.status} raw body:`, resText)

    let data: any = null
    try { data = JSON.parse(resText) } catch {}

    if (!res.ok) {
      const raw = data?.message ?? data?.error ?? data?.errors ?? (data ? JSON.stringify(data) : `HTTP ${res.status}`)
      const status = res.status
      let friendly: string
      if (status === 401 || status === 403) friendly = "Invalid HitPay API key. Please check your credentials."
      else if (typeof raw === "string" && (raw.toLowerCase().includes("insufficient") || raw.toLowerCase().includes("balance"))) friendly = "Insufficient HitPay wallet balance. Please top up your HitPay account."
      else if (typeof raw === "string" && raw.toLowerCase().includes("minimum")) friendly = "Amount is below the minimum allowed by HitPay."
      else if (typeof raw === "string" && raw.toLowerCase().includes("duplicate")) friendly = "Duplicate transaction detected. Please wait before retrying."
      else friendly = typeof raw === "string" ? raw : JSON.stringify(raw)
      return NextResponse.json({ error: friendly, raw, status }, { status })
    }

    return NextResponse.json({ ok: true, payout: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
