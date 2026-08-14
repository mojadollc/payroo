import { NextRequest, NextResponse } from "next/server"

const GBITS_API_URL = process.env.GBITS_API_URL || "https://api.gbits.ph"
const GBITS_BUSINESS_ID = process.env.GBITS_BUSINESS_ID!
const GBITS_BUSINESS_CODE = process.env.GBITS_BUSINESS_CODE!
const GBITS_USERNAME = process.env.GBITS_USERNAME!
const GBITS_PASSWORD = process.env.GBITS_PASSWORD!
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

let cachedToken: string | null = null

async function authenticate(): Promise<string> {
  const r = await fetch(`${GBITS_API_URL}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": UA },
    body: JSON.stringify({ username: GBITS_USERNAME, password: GBITS_PASSWORD }),
  })
  const data = await r.json()
  if (data.errorCode !== 0) throw new Error(data.message || "Gbits auth failed")
  cachedToken = data.content.accessToken
  return cachedToken!
}

async function gbitsGet(path: string): Promise<any> {
  if (!cachedToken) cachedToken = await authenticate()
  const r = await fetch(`${GBITS_API_URL}${path}`, {
    headers: { Authorization: cachedToken, Accept: "application/json", "User-Agent": UA },
  })
  if (r.status === 401) {
    cachedToken = await authenticate()
    const retry = await fetch(`${GBITS_API_URL}${path}`, {
      headers: { Authorization: cachedToken, Accept: "application/json", "User-Agent": UA },
    })
    return retry.json()
  }
  return r.json()
}

function generateTxnId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "")
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let rand = ""
  for (let i = 0; i < 6; i++) rand += chars[Math.floor(Math.random() * chars.length)]
  return `${GBITS_BUSINESS_CODE}${date}${rand}`
}

function mapSkus(skus: any[]) {
  return skus
    .filter((s) => s.skuStatus === true)
    .map((s) => ({
      promoId: s.promoId, name: s.skuName, network: s.serviceGroup,
      service: s.service, category: s.category, amount: s.amount,
      description: s.description, validity: s.validity,
      addressType: s.addressType, addressMin: s.addressMin, addressMax: s.addressMax,
    }))
    .sort((a, b) => a.amount - b.amount)
}

const ALLOWED_STORE_ID = "8807"

export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get("storeId")
  if (storeId !== ALLOWED_STORE_ID) {
    return NextResponse.json({ error: "E-Load is not available for your store." }, { status: 403 })
  }
  try {
    const action = req.nextUrl.searchParams.get("action")
    const txnId = req.nextUrl.searchParams.get("txnId")

    if (action === "status" && txnId) {
      const data = await gbitsGet(`/eload/status/${txnId}`)
      const status = data.content?.status
      if (status === "success") return NextResponse.json({ status: "completed", txnId })
      if (status === "failed") return NextResponse.json({ status: "failed", error: data.content?.description || "Failed" })
      return NextResponse.json({ status: "pending", txnId })
    }

    if (action === "balance") {
      const data = await gbitsGet(`/account/balance/${GBITS_BUSINESS_ID}`)
      const balance = data.content?.balance ?? data.content?.availableBalance ?? null
      return NextResponse.json({ balance })
    }

    const data = await gbitsGet(`/eload/sku/${GBITS_BUSINESS_ID}`)
    const products = mapSkus(data.content || [])
    return NextResponse.json({ products })
  } catch (error: any) {
    console.error("eload GET error:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { promoId, address, amount, storeId } = await req.json()
    if (storeId !== ALLOWED_STORE_ID) {
      return NextResponse.json({ error: "E-Load is not available for your store." }, { status: 403 })
    }
    if (!promoId || !address) return NextResponse.json({ error: "promoId and address are required" }, { status: 400 })

    if (!cachedToken) cachedToken = await authenticate()

    const txnId = generateTxnId()
    const params = new URLSearchParams({ promoId: String(promoId), address, transactionId: txnId })
    if (amount) params.append("amount", String(amount))

    const r = await fetch(`${GBITS_API_URL}/eload/buy?${params.toString()}`, {
      method: "POST",
      headers: { Authorization: cachedToken, Accept: "application/json", "User-Agent": UA },
    })
    const result = await r.json()

    if (result.errorCode === 0) {
      const gbitsRef = result.content?.referenceId || result.content?.transactionId || txnId
      return NextResponse.json({ status: "completed", txnId: gbitsRef, localTxnId: txnId })
    }
    if (result.errorCode === 105) return NextResponse.json({ status: "pending", txnId })
    return NextResponse.json(
      { status: "failed", txnId, error: result.content?.description || result.message || "Failed" },
      { status: 422 }
    )
  } catch (error: any) {
    console.error("eload POST error:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
