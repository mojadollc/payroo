import { NextResponse } from "next/server"

// Static logo map — HitPay doesn't have a logos endpoint,
// so we use known CDN / public SVG sources
const LOGO_MAP: Record<string, string> = {
  gcash:      "https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/GCash_logo.svg/200px-GCash_logo.svg.png",
  paymaya:    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Maya_logo.svg/200px-Maya_logo.svg.png",
  shopeepay:  "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/Shopee.svg/200px-Shopee.svg.png",
  grabpay:    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Grab_logo_2019.svg/200px-Grab_logo_2019.svg.png",
  bpi:        "/wallets/bpi.svg",
  unionbank:  "/wallets/unionbank.svg",
  chinabank:  "/wallets/chinabank.svg",
  rcbc:       "/wallets/rcbc.svg",
  bdo:        "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/BDO_Unibank_logo.svg/200px-BDO_Unibank_logo.svg.png",
  metrobank:  "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Metrobank_logo.svg/200px-Metrobank_logo.svg.png",
  landbank:   "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Land_Bank_of_the_Philippines_logo.svg/200px-Land_Bank_of_the_Philippines_logo.svg.png",
  pnb:        "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Philippine_National_Bank_logo.svg/200px-Philippine_National_Bank_logo.svg.png",
  instapay:   "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/InstaPay_logo.svg/200px-InstaPay_logo.svg.png",
  pesonet:    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/PESONet_logo.svg/200px-PESONet_logo.svg.png",
}

const COLOR_MAP: Record<string, string> = {
  gcash:      "#007DFF",
  paymaya:    "#00A651",
  shopeepay:  "#EE4D2D",
  grabpay:    "#00B14F",
  bpi:        "#C8102E",
  unionbank:  "#003087",
  chinabank:  "#C8102E",
  rcbc:       "#003087",
  bdo:        "#003087",
  metrobank:  "#003087",
  landbank:   "#006400",
  pnb:        "#003087",
  instapay:   "#0066CC",
  pesonet:    "#003087",
}

// Known HitPay payout payment_method values for PH
const ALL_CHANNELS = [
  { id: "gcash",     label: "GCash",      type: "wallet" },
  { id: "paymaya",   label: "Maya",       type: "wallet" },
  { id: "shopeepay", label: "ShopeePay",  type: "wallet" },
  { id: "grabpay",   label: "GrabPay",    type: "wallet" },
  { id: "bpi",       label: "BPI",        type: "bank" },
  { id: "unionbank", label: "UnionBank",  type: "bank" },
  { id: "bdo",       label: "BDO",        type: "bank" },
  { id: "metrobank", label: "Metrobank",  type: "bank" },
  { id: "chinabank", label: "China Bank", type: "bank" },
  { id: "rcbc",      label: "RCBC",       type: "bank" },
  { id: "landbank",  label: "Landbank",   type: "bank" },
  { id: "pnb",       label: "PNB",        type: "bank" },
]

export async function GET() {
  const apiKey = process.env.HITPAY_API_KEY
  const apiUrl = process.env.HITPAY_API_URL ?? "https://api.hit-pay.com/v1"

  // Try to fetch available channels from HitPay
  // HitPay exposes GET /v1/payment-methods for available methods
  let available: string[] | null = null
  if (apiKey) {
    try {
      const res = await fetch(`${apiUrl}/payment-methods?currency=PHP`, {
        headers: { "X-BUSINESS-API-KEY": apiKey },
        next: { revalidate: 300 },
      })
      if (res.ok) {
        const data = await res.json()
        // Response is array of { name, display_name } or similar
        if (Array.isArray(data)) {
          available = data.map((m: any) => (m.name ?? m.id ?? "").toLowerCase())
        }
      }
    } catch { /* fall through to static list */ }
  }

  const channels = ALL_CHANNELS
    .filter(ch => !available || available.includes(ch.id))
    .map(ch => ({
      ...ch,
      logo: LOGO_MAP[ch.id] ?? null,
      color: COLOR_MAP[ch.id] ?? "#666",
    }))

  return NextResponse.json({ channels })
}
