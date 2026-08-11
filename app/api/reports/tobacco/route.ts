import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

const TOBACCO_KEYWORDS = ["cigarette", "tobacco", "cigarro", "cigar", "vape", "e-cig", "nicotine", "marlboro", "winston", "philip morris", "fortune", "hope", "champion", "camel", "menthol"]

function isTobacco(name: string, category: string) {
  const haystack = `${name} ${category}`.toLowerCase()
  return TOBACCO_KEYWORDS.some(k => haystack.includes(k))
}

export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get("storeId")
  if (!storeId) return NextResponse.json({ error: "Missing storeId" }, { status: 400 })

  const from = req.nextUrl.searchParams.get("from")
  const to = req.nextUrl.searchParams.get("to")

  const dateFilter: any = {}
  if (from && to) {
    const start = new Date(from); start.setHours(0, 0, 0, 0)
    const end = new Date(to); end.setHours(23, 59, 59, 999)
    dateFilter.createdAt = { gte: start, lte: end }
  }

  // 1. Get all tobacco products for this store
  const allProducts = await prisma.product.findMany({ where: { storeId } })
  const tobaccoProducts = allProducts.filter(p => isTobacco(p.name, p.category))
  const tobaccoIds = tobaccoProducts.map(p => p.id)

  if (tobaccoIds.length === 0) {
    return NextResponse.json({
      data: {
        grossIncome: [],
        netIncome: [],
        quantitiesSold: [],
        costCapital: [],
        totals: { gross: 0, net: 0, qtySold: 0, stockValue: 0 },
      },
    })
  }

  // 2. Get sale items for tobacco products within date range
  const saleItems = await prisma.saleItem.findMany({
    where: {
      productId: { in: tobaccoIds },
      sale: { storeId, status: { not: "voided" }, ...dateFilter },
    },
    include: { sale: { select: { createdAt: true, status: true } } },
  })

  // 3. Aggregate per product
  const productMap = new Map<string, {
    productId: string
    productName: string
    category: string
    qtySold: number
    grossIncome: number
    netIncome: number
    currentStock: number
    cost: number
  }>()

  for (const p of tobaccoProducts) {
    productMap.set(p.id, {
      productId: p.id,
      productName: p.name,
      category: p.category,
      qtySold: 0,
      grossIncome: 0,
      netIncome: 0,
      currentStock: p.stock,
      cost: p.cost,
    })
  }

  for (const item of saleItems) {
    const entry = productMap.get(item.productId)
    if (!entry) continue
    entry.qtySold += item.quantity
    entry.grossIncome += item.subtotal
    entry.netIncome += (item.price - item.cost) * item.quantity
  }

  const rows = Array.from(productMap.values()).sort((a, b) => b.grossIncome - a.grossIncome)

  const totals = rows.reduce(
    (acc, r) => ({
      gross: acc.gross + r.grossIncome,
      net: acc.net + r.netIncome,
      qtySold: acc.qtySold + r.qtySold,
      stockValue: acc.stockValue + r.currentStock * r.cost,
    }),
    { gross: 0, net: 0, qtySold: 0, stockValue: 0 }
  )

  return NextResponse.json({
    data: {
      grossIncome: rows.map(r => ({ productId: r.productId, productName: r.productName, category: r.category, value: r.grossIncome })),
      netIncome: rows.map(r => ({ productId: r.productId, productName: r.productName, category: r.category, value: r.netIncome })),
      quantitiesSold: rows.map(r => ({ productId: r.productId, productName: r.productName, category: r.category, value: r.qtySold })),
      costCapital: rows.map(r => ({ productId: r.productId, productName: r.productName, category: r.category, stock: r.currentStock, cost: r.cost, value: r.currentStock * r.cost })),
      totals,
    },
  })
}
