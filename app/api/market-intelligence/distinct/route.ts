import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function GET() {
  const rows = await prisma.marketData.findMany({ select: { city: true, region: true, category: true, businessType: true, productName: true } })
  return NextResponse.json({
    data: {
      cities: [...new Set(rows.map(r => r.city).filter(Boolean))].sort(),
      regions: [...new Set(rows.map(r => r.region).filter(Boolean))].sort(),
      categories: [...new Set(rows.map(r => r.category).filter(Boolean))].sort(),
      businessTypes: [...new Set(rows.map(r => r.businessType).filter(Boolean))].sort(),
      products: [...new Set(rows.map(r => r.productName).filter(Boolean))].sort(),
    }
  })
}
