import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.toLowerCase() || ""
  if (!q) return NextResponse.json({ data: [] })
  const stores = await prisma.deliverySetting.findMany({ where: { enabled: true } })
  const results: { product: any; store: any }[] = []
  for (const store of stores) {
    if (!store.enabledProductIds?.length) continue
    const products = await prisma.product.findMany({
      where: { storeId: store.storeId, id: { in: store.enabledProductIds as string[] } },
    })
    for (const p of products) {
      if (p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)) {
        results.push({ product: p, store })
      }
    }
  }
  return NextResponse.json({ data: results })
}
