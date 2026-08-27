import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

const GBITS_API_URL = process.env.GBITS_API_URL || "https://api.gbits.ph"
const GBITS_BUSINESS_ID = process.env.GBITS_BUSINESS_ID!
const GBITS_BUSINESS_CODE = process.env.GBITS_BUSINESS_CODE!
const GBITS_USERNAME = process.env.GBITS_USERNAME!
const GBITS_PASSWORD = process.env.GBITS_PASSWORD!
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

let cachedToken: string | null = null
let tokenExpiresAt: number = 0

function getTokenExpiry(token: string): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString())
    return (payload.exp || 0) * 1000 // convert to ms
  } catch {
    return 0
  }
}

function isTokenValid(): boolean {
  if (!cachedToken) return false
  // Refresh 5 minutes before actual expiry
  return Date.now() < tokenExpiresAt - 5 * 60 * 1000
}

async function authenticate(): Promise<string> {
  const r = await fetch(`${GBITS_API_URL}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": UA },
    body: JSON.stringify({ username: GBITS_USERNAME, password: GBITS_PASSWORD }),
  })
  const data = await r.json()
  if (data.errorCode !== 0) throw new Error(data.message || "Gbits auth failed")
  cachedToken = data.content.accessToken
  tokenExpiresAt = getTokenExpiry(cachedToken!)
  console.log("[eload] authenticated, token expires at:", new Date(tokenExpiresAt).toISOString())
  return cachedToken!
}

async function getToken(): Promise<string> {
  if (!isTokenValid()) await authenticate()
  return cachedToken!
}

async function gbitsGet(path: string): Promise<any> {
  const token = await getToken()
  const r = await fetch(`${GBITS_API_URL}${path}`, {
    headers: { Authorization: token, Accept: "application/json", "User-Agent": UA },
  })
  if (r.status === 401) {
    cachedToken = null
    const freshToken = await authenticate()
    const retry = await fetch(`${GBITS_API_URL}${path}`, {
      headers: { Authorization: freshToken, Accept: "application/json", "User-Agent": UA },
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

async function saveBalanceToDB(storeId: string, balance: number) {
  try {
    await prisma.commissionSettings.upsert({
      where: { storeId },
      update: { gbitsBalance: balance, gbitsBalanceAt: new Date() },
      create: {
        storeId,
        gbitsBalance: balance,
        gbitsBalanceAt: new Date(),
        xenditFlatFee: 10,
        xenditVatRate: 0.12,
        adminChargeRate: 0.01,
        sellerCashinRate: 0.02,
        gcashCashinRate: 0.02,
        gcashCashoutRate: 0.02,
        mayaCashinRate: 0.02,
        mayaCashoutRate: 0.02,
        eloadFeeType: "flat",
        eloadFeeValue: 5,
      },
    })
    console.log("[eload] balance saved to DB:", balance, "for storeId:", storeId)
  } catch (e) {
    console.error("[eload] failed to save balance to DB:", e)
  }
}

async function fetchGbitsBalance(): Promise<number | null> {
  // GBits has no dedicated balance endpoint (all return errorCode 4).
  // Balance is only available in the buy transaction response (content.balance).
  // This function intentionally returns null — balance is set from buy responses only.
  return null
}

// SKU cache: avoid hitting Gbits on every page load
let skuCache: { products: any[]; at: number } | null = null
const SKU_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function mapSkus(skus: any[]) {
  // Gbits returns strictly boolean true/false for skuStatus
  const active = skus.filter(s => s.skuStatus === true)
  console.log(`[eload] Gbits total: ${skus.length}, active (skuStatus=true): ${active.length}, inactive: ${skus.length - active.length}`)
  return active
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
  const storeId = req.nextUrl.searchParams.get("storeId")
  if (!storeId) {
    return NextResponse.json({ error: "Missing storeId" }, { status: 400 })
  }
  try {
    const action = req.nextUrl.searchParams.get("action")
    const txnId = req.nextUrl.searchParams.get("txnId")

    if (action === "status" && txnId) {
      const data = await gbitsGet(`/eload/status/${txnId}`)
      const raw = (data.content?.status || "").toLowerCase()
      if (["success", "completed", "successful"].includes(raw))
        return NextResponse.json({ status: "completed", txnId, balance: data.content?.balance ?? null })
      if (["failed", "failure", "cancelled", "canceled", "rejected"].includes(raw))
        return NextResponse.json({ status: "failed", error: data.content?.description || data.message || "Transaction failed" })
      return NextResponse.json({ status: "pending", txnId })
    }

    if (action === "balance") {
      const settings = await prisma.commissionSettings.findUnique({ where: { storeId } })
      return NextResponse.json({ balance: settings?.gbitsBalance ?? null })
    }

    // SKU fetch — force=true bypasses cache (used by refresh button)
    const force = action === "refresh-skus"
    if (force) skuCache = null

    if (!force && skuCache && Date.now() - skuCache.at < SKU_CACHE_TTL) {
      return NextResponse.json({ products: skuCache.products, balance: null })
    }

    const skuData = await gbitsGet(`/eload/sku/${GBITS_BUSINESS_ID}`)
    if (skuData.errorCode !== 0) {
      console.error("[eload] SKU fetch error:", skuData.message)
      // Return cached data if available even if stale, rather than empty
      if (skuCache) return NextResponse.json({ products: skuCache.products, balance: null })
    }
    const products = mapSkus(skuData.errorCode === 0 ? skuData.content || [] : [])
    skuCache = { products, at: Date.now() }
    console.log(`[eload] fetched ${products.length} active SKUs from Gbits (force=${force})`)
    return NextResponse.json({ products, balance: null })
  } catch (error: any) {
    console.error("eload GET error:", error.message)
    // Return stale cache on error rather than failing
    if (skuCache) return NextResponse.json({ products: skuCache.products, balance: null })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { promoId, address, amount, storeId } = await req.json()
    if (!storeId) {
      return NextResponse.json({ error: "Missing storeId" }, { status: 400 })
    }
    if (!address || !amount) return NextResponse.json({ error: "address and amount are required" }, { status: 400 })

    const token = await getToken()
    const txnId = generateTxnId()
    const params = new URLSearchParams({ address, transactionId: txnId })
    if (promoId) {
      params.append("promoId", String(promoId))
    } else {
      params.append("amount", String(amount))
    }

    let r = await fetch(`${GBITS_API_URL}/eload/buy?${params.toString()}`, {
      method: "POST",
      headers: { Authorization: token, Accept: "application/json", "User-Agent": UA },
    })
    if (r.status === 401) {
      cachedToken = null
      const freshToken = await authenticate()
      r = await fetch(`${GBITS_API_URL}/eload/buy?${params.toString()}`, {
        method: "POST",
        headers: { Authorization: freshToken, Accept: "application/json", "User-Agent": UA },
      })
    }
    const result = await r.json()
    console.log("[eload] buy response:", JSON.stringify(result))

    if (result.errorCode === 0) {
      const gbitsRef = result.content?.transactionId || txnId
      const balanceAfter = result.content?.balance ?? result.content?.remainingBalance ?? result.content?.walletBalance ?? null
      console.log("[eload] buy success, content keys:", Object.keys(result.content || {}), "balance:", balanceAfter)
      if (balanceAfter != null) await saveBalanceToDB(storeId, balanceAfter)
      return NextResponse.json({ status: "completed", txnId: gbitsRef, localTxnId: txnId, balance: balanceAfter })
    }
    if (result.errorCode === 105) {
      const gbitsRef = result.content?.transactionId || txnId
      const balanceAfter = result.content?.balance ?? null
      if (balanceAfter != null) await saveBalanceToDB(storeId, balanceAfter)
      return NextResponse.json({ status: "pending", txnId, gbitsRef, balance: balanceAfter })
    }
    return NextResponse.json(
      { status: "failed", txnId, error: result.content?.description || result.message || `GBits error ${result.errorCode}` },
      { status: 422 }
    )
  } catch (error: any) {
    console.error("eload POST error:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
