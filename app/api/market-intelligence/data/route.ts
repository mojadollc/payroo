import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const city = searchParams.get("city") || undefined
  const region = searchParams.get("region") || undefined
  const category = searchParams.get("category") || undefined
  const businessType = searchParams.get("businessType") || undefined
  const month = searchParams.get("month") || undefined
  const productName = searchParams.get("productName") || undefined

  const where: any = {}
  if (city) where.city = city
  if (region) where.region = region
  if (category) where.category = category
  if (businessType) where.businessType = businessType
  if (month) where.month = month
  if (productName) where.productName = productName

  const rows = await prisma.marketData.findMany({ where, orderBy: { createdAt: "desc" }, take: 2000 })

  // Top products
  const prodMap = new Map<string, { productName: string; category: string; totalQty: number; totalRevenue: number; city: string }>()
  for (const r of rows) {
    const ex = prodMap.get(r.productName)
    if (ex) { ex.totalQty += r.quantity; ex.totalRevenue += r.revenue }
    else prodMap.set(r.productName, { productName: r.productName, category: r.category, totalQty: r.quantity, totalRevenue: r.revenue, city: r.city })
  }
  const topProducts = Array.from(prodMap.values()).sort((a, b) => b.totalQty - a.totalQty).slice(0, 15)

  // Hourly sales
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, totalQty: 0, totalRevenue: 0 }))
  for (const r of rows) hours[r.hour].totalQty += r.quantity

  // City breakdown
  const cityMap = new Map<string, { city: string; region: string; totalQty: number; totalRevenue: number }>()
  for (const r of rows) {
    const ex = cityMap.get(r.city)
    if (ex) { ex.totalQty += r.quantity; ex.totalRevenue += r.revenue }
    else cityMap.set(r.city, { city: r.city, region: r.region, totalQty: r.quantity, totalRevenue: r.revenue })
  }
  const cityBreakdown = Array.from(cityMap.values()).sort((a, b) => b.totalQty - a.totalQty)

  return NextResponse.json({ data: { topProducts, hourlySales: hours, cityBreakdown } })
}
