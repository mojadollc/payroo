import { NextRequest, NextResponse } from "next/server"

const GBITS_API_URL = process.env.GBITS_API_URL || "https://api.gbits.ph"
const GBITS_BUSINESS_ID = process.env.GBITS_BUSINESS_ID!
const GBITS_BUSINESS_CODE = process.env.GBITS_BUSINESS_CODE!
const GBITS_USERNAME = process.env.GBITS_USERNAME!
const GBITS_PASSWORD = process.env.GBITS_PASSWORD!

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

let _token: string | null = null
let _tokenExpiry = 0

async function getToken(): Promise<string> {
  if (_token && Date.now() < _tokenExpiry) return _token
  const res = await fetch(`${GBITS_API_URL}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": UA },
    body: JSON.stringify({ username: GBITS_USERNAME, password: GBITS_PASSWORD }),
  })
  const data = await res.json()
  if (data.errorCode !== 0) throw new Error(data.message || "Gbits auth failed")
  _token = data.content.accessToken
  _tokenExpiry = Date.now() + 50 * 60 * 1000
  return _token!
}

async function gbitsGet(path: string) {
  const token = await getToken()
  const res = await fetch(`${GBITS_API_URL}${path}`, {
    headers: { Authorization: token, Accept: "application/json", "User-Agent": UA },
  })
  return res.json()
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
      promoId: s.promoId,
      name: s.skuName,
      network: s.serviceGroup,
      service: s.service,
      category: s.category,
      amount: s.amount,
      description: s.description,
      validity: s.validity,
      addressType: s.addressType,
      addressMin: s.addressMin,
      addressMax: s.addressMax,
    }))
    .sort((a, b) => a.amount - b.amount)
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get("action")
  const txnId = searchParams.get("txnId")

  // GET /api/eload?action=status&txnId=xxx
  if (action === "status" && txnId) {
    try {
      const data = await gbitsGet(`/eload/status/${txnId}`)
      const status = data.content?.status
      if (status === "success") return NextResponse.json({ status: "completed", txnId })
      if (status === "failed") return NextResponse.json({ status: "failed", error: data.content?.description || "Failed" })
      return NextResponse.json({ status: "pending", txnId })
    } catch (err: any) {
      return NextResponse.json({ status: "unknown", error: err.message }, { status: 500 })
    }
  }

  // GET /api/eload — fetch all products
  try {
    const data = await gbitsGet(`/eload/sku/${GBITS_BUSINESS_ID}`)
    const products = mapSkus(data.content || [])
    return NextResponse.json({ products })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { promoId, address, amount } = await req.json()
    if (!promoId || !address) {
      return NextResponse.json({ error: "promoId and address are required" }, { status: 400 })
    }

    const txnId = generateTxnId()
    const token = await getToken()

    const params = new URLSearchParams({ promoId: String(promoId), address, transactionId: txnId })
    if (amount) params.append("amount", String(amount))

    const res = await fetch(`${GBITS_API_URL}/eload/buy?${params.toString()}`, {
      method: "POST",
      headers: { Authorization: token, Accept: "application/json", "User-Agent": UA },
    })
    const result = await res.json()

    if (result.errorCode === 0) {
      // Gbits returns their own reference in content
      const gbitsRef = result.content?.referenceId || result.content?.transactionId || txnId
      return NextResponse.json({ status: "completed", txnId: gbitsRef, localTxnId: txnId })
    }
    if (result.errorCode === 105) {
      return NextResponse.json({ status: "pending", txnId, message: "Processing" })
    }

    return NextResponse.json({
      status: "failed",
      txnId,
      error: result.content?.description || result.message || "Transaction failed",
    }, { status: 422 })
  } catch (err: any) {
    return NextResponse.json({ status: "failed", error: err.message }, { status: 500 })
  }
}
