import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"

// Switch provider via PAYOUT_PROVIDER env var: "xendit" (default) | "hitpay"
// HitPay requires the Transfers feature to be enabled on your account.

// ── Xendit channel maps ───────────────────────────────────────────────────────
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

// ── HitPay channel map (wallet key → HitPay payment_instrument) ───────────────
// Philippines supported: gcash, paymaya (maya), grabpay + banks via instapay/pesonet
const HITPAY_CHANNELS: Record<string, string> = {
  gcash:     "gcash",
  paymaya:   "paymaya",
  maya:      "paymaya",
  grabpay:   "grabpay",
  bpi:       "bpi",
  bdo:       "bdo",
  unionbank: "unionbank",
  metrobank: "metrobank",
  rcbc:      "rcbc",
  chinabank: "chinabank",
  landbank:  "landbank",
  pnb:       "pnb",
}

// Wallet channels that use phone number as account_number
const HITPAY_WALLET_CHANNELS = new Set(["gcash", "paymaya", "maya", "grabpay"])

const normalizePhone = (num: string) => {
  const digits = num.replace(/\D/g, "")
  if (digits.startsWith("63")) return "+" + digits
  if (digits.startsWith("0")) return "+63" + digits.slice(1)
  return "+63" + digits
}

async function payoutXendit(
  apiKey: string,
  { channel, accountNumber, accountName, amount, purpose }: Record<string, any>
) {
  const isWallet = channel in WALLET_CHANNELS
  const isBank   = channel in BANK_CHANNELS
  if (!isWallet && !isBank)
    return NextResponse.json({ error: `Unsupported channel: ${channel}` }, { status: 400 })

  const routingValue = isWallet ? WALLET_CHANNELS[channel] : BANK_CHANNELS[channel]
  const accountNum   = isWallet
    ? normalizePhone(accountNumber).replace("+", "")   // digits-only E.164
    : accountNumber.replace(/\D/g, "")

  const nameParts  = (accountName || "Customer").trim().split(/\s+/)
  const given_name = nameParts[0]
  const surname    = nameParts.length > 1 ? nameParts.slice(1).join(" ") : given_name
  const refId      = randomUUID()

  const body = {
    reference_id: refId,
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
      destination_amount: Math.round(amount * 100),
    },
    source_of_fund: "BUSINESS_REVENUE",
    purpose_code: "OTHER",
    description: purpose || "Cash-in payout",
  }

  console.log("[xendit/payout] body:", JSON.stringify(body))

  const res = await fetch("https://api.xendit.co/v3/payouts", {
    method: "POST",
    headers: {
      "Authorization":  "Basic " + Buffer.from(apiKey + ":").toString("base64"),
      "Content-Type":   "application/json",
      "Api-version":    "2025-09-01",
      "Idempotency-key": refId,
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  console.log(`[xendit/payout] HTTP ${res.status}:`, text)
  let data: any = null
  try { data = JSON.parse(text) } catch {}

  if (!res.ok) {
    const msg = data?.message ?? data?.error_code ?? `HTTP ${res.status}`
    const errors = data?.errors ? ` (${data.errors.join(", ")})` : ""
    let friendly: string
    if (res.status === 401 || res.status === 403) friendly = "Xendit API key invalid or missing MONEY-OUT permission."
    else if (String(msg).toLowerCase().includes("insufficient")) friendly = "Insufficient Xendit balance. Please top up your account."
    else if (String(msg).toLowerCase().includes("invalid_destination")) friendly = "Invalid account number or mobile number."
    else friendly = msg + errors
    return NextResponse.json({ error: friendly, raw: data }, { status: res.status })
  }
  return NextResponse.json({ ok: true, provider: "xendit", payout: data })
}

async function payoutHitPay(
  apiKey: string,
  apiUrl: string,
  { channel, accountNumber, accountName, amount, purpose, beneficiaryId }: Record<string, any>
) {
  // HitPay flow: if beneficiaryId provided → use directly, else create beneficiary first
  let beneId = beneficiaryId

  if (!beneId) {
    if (!(channel in HITPAY_CHANNELS))
      return NextResponse.json({ error: `Unsupported HitPay channel: ${channel}` }, { status: 400 })

    const beneBody = {
      name:               accountName || "Customer",
      payment_instrument: HITPAY_CHANNELS[channel],
      account_number:     HITPAY_WALLET_CHANNELS.has(channel)
        ? normalizePhone(accountNumber)
        : accountNumber.replace(/\D/g, ""),
    }

    console.log("[hitpay/payout] create beneficiary:", JSON.stringify(beneBody))

    const beneRes = await fetch(`${apiUrl}/beneficiaries`, {
      method: "POST",
      headers: { "X-BUSINESS-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(beneBody),
    })
    const beneText = await beneRes.text()
    console.log(`[hitpay/payout] beneficiary HTTP ${beneRes.status}:`, beneText)
    let beneData: any = null
    try { beneData = JSON.parse(beneText) } catch {}

    if (!beneRes.ok) {
      const msg = beneData?.message ?? `HTTP ${beneRes.status}`
      if (beneRes.status === 403) return NextResponse.json({ error: "HitPay Transfers feature not enabled on this account. Contact support@hit-pay.com." }, { status: 403 })
      return NextResponse.json({ error: msg, raw: beneData }, { status: beneRes.status })
    }
    beneId = beneData.id
  }

  const transferBody = {
    beneficiary_id: beneId,
    amount:         String(amount.toFixed(2)),
    currency:       "PHP",
    purpose:        purpose || "Cash-in payout",
  }

  console.log("[hitpay/payout] create transfer:", JSON.stringify(transferBody))

  const txRes = await fetch(`${apiUrl}/transfers`, {
    method: "POST",
    headers: { "X-BUSINESS-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(transferBody),
  })
  const txText = await txRes.text()
  console.log(`[hitpay/payout] transfer HTTP ${txRes.status}:`, txText)
  let txData: any = null
  try { txData = JSON.parse(txText) } catch {}

  if (!txRes.ok) {
    const msg = txData?.message ?? `HTTP ${txRes.status}`
    if (txRes.status === 403) return NextResponse.json({ error: "HitPay Transfers feature not enabled on this account. Contact support@hit-pay.com." }, { status: 403 })
    return NextResponse.json({ error: msg, raw: txData }, { status: txRes.status })
  }
  return NextResponse.json({ ok: true, provider: "hitpay", payout: txData })
}

export async function POST(req: NextRequest) {
  const provider = (process.env.PAYOUT_PROVIDER ?? "xendit").toLowerCase()

  try {
    const body = await req.json()
    const { channel, accountNumber, amount } = body

    if (!channel || !accountNumber || !amount)
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    if (amount < 1)
      return NextResponse.json({ error: "Minimum payout is ₱1" }, { status: 400 })

    if (provider === "hitpay") {
      const apiKey = process.env.HITPAY_API_KEY
      const apiUrl = (process.env.HITPAY_API_URL ?? "https://api.hit-pay.com/v1").replace(/\/+$/, "")
      if (!apiKey) return NextResponse.json({ error: "HitPay not configured" }, { status: 500 })
      return payoutHitPay(apiKey, apiUrl, body)
    }

    // default: xendit
    const apiKey = process.env.XENDIT_SECRET_KEY
    if (!apiKey) return NextResponse.json({ error: "Xendit not configured" }, { status: 500 })
    return payoutXendit(apiKey, body)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
