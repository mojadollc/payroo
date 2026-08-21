import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"

// Xendit v3 Payouts — Philippines (GCash, Maya, banks via InstaPay/PESONet)
// Docs: https://docs.xendit.co/docs/integration-payouts
// Amounts are in minor units (PHP 100.00 → 10000)

const WALLET_CHANNELS: Record<string, string> = {
  gcash:     "PH_GCASH",
  paymaya:   "PH_PAYMAYA",
  shopeepay: "PH_SHOPEEPAY",
  grabpay:   "PH_GRABPAY",
}

const BANK_CHANNELS: Record<string, string> = {
  bpi:       "PH_BPI",
  bdo:       "PH_BDO",
  unionbank: "PH_UBP",
  metrobank: "PH_MBTC",
  chinabank: "PH_CHINABANK",
  rcbc:      "PH_RCBC",
  landbank:  "PH_LANDBANK",
  pnb:       "PH_PNB",
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.XENDIT_SECRET_KEY
  if (!apiKey) return NextResponse.json({ error: "Xendit not configured" }, { status: 500 })

  try {
    const { channel, accountNumber, accountName, amount, purpose } = await req.json()

    if (!channel || !accountNumber || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }
    if (amount < 1) {
      return NextResponse.json({ error: "Minimum payout is ₱1" }, { status: 400 })
    }

    const isWallet = channel in WALLET_CHANNELS
    const isBank = channel in BANK_CHANNELS

    if (!isWallet && !isBank) {
      return NextResponse.json({ error: `Unsupported channel: ${channel}` }, { status: 400 })
    }

    const routingValue = isWallet ? WALLET_CHANNELS[channel] : BANK_CHANNELS[channel]

    // Normalize phone: strip leading 0, add 63 prefix → digits only (E.164 without +)
    const normalizePhone = (num: string) => {
      const digits = num.replace(/\D/g, "")
      if (digits.startsWith("63")) return digits
      if (digits.startsWith("0")) return "63" + digits.slice(1)
      return "63" + digits
    }

    const accountNum = isWallet ? normalizePhone(accountNumber) : accountNumber.replace(/\D/g, "")

    // Split name into given_name / surname
    const nameParts = (accountName || "Customer").trim().split(/\s+/)
    const given_name = nameParts[0]
    const surname = nameParts.length > 1 ? nameParts.slice(1).join(" ") : given_name

    // Minor units: PHP 100.00 → 10000
    const destinationAmount = Math.round(amount * 100)

    const body = {
      reference_id: randomUUID(),
      recipient: {
        type: "INDIVIDUAL",
        given_name,
        surname,
        relationship: "CUSTOMER",
        account_details: {
          currency: "PHP",
          account_country: "PH",
          account_holder_name: accountName || "Customer",
          account_number: accountNum,
          routing_type_1: isWallet ? "WALLET" : "MOBILE_NO",
          routing_value_1: routingValue,
        },
        address: { country: "PH", city: "Manila", street_line_1: "N/A" },
      },
      payout_details: {
        source_currency: "PHP",
        destination_currency: "PHP",
        destination_amount: destinationAmount,
      },
      source_of_fund: "BUSINESS_REVENUE",
      purpose_code: "OTHER",
      description: purpose || "Cash-in payout",
    }

    console.log("[xendit/payout] request body:", JSON.stringify(body))

    const res = await fetch("https://api.xendit.co/v3/payouts", {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(apiKey + ":").toString("base64"),
        "Content-Type": "application/json",
        "Api-version": "2025-09-01",
        "Idempotency-key": body.reference_id,
      },
      body: JSON.stringify(body),
    })

    const resText = await res.text()
    console.log(`[xendit/payout] HTTP ${res.status} raw:`, resText)

    let data: any = null
    try { data = JSON.parse(resText) } catch {}

    if (!res.ok) {
      const msg = data?.message ?? data?.error_code ?? `HTTP ${res.status}`
      const errors = data?.errors ? ` (${data.errors.join(", ")})` : ""
      let friendly: string
      if (res.status === 401 || res.status === 403) friendly = "Xendit API key invalid or missing MONEY-OUT permission."
      else if (typeof msg === "string" && msg.toLowerCase().includes("insufficient")) friendly = "Insufficient Xendit balance. Please top up your account."
      else if (typeof msg === "string" && msg.toLowerCase().includes("invalid_destination")) friendly = "Invalid account number or mobile number."
      else friendly = msg + errors
      return NextResponse.json({ error: friendly, raw: data }, { status: res.status })
    }

    return NextResponse.json({ ok: true, payout: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
