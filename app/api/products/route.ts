import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  const storeId = p.get("storeId")
  const barcode = p.get("barcode")
  if (!storeId) return NextResponse.json({ error: "Missing storeId" }, { status: 400 })

  if (barcode) {
    const item = await prisma.product.findFirst({ where: { storeId, barcode } })
    return NextResponse.json({ data: item })
  }

  const search = p.get("search")?.trim() || ""
  const filter = p.get("filter") || "all"
  const hasPagination = p.has("page")
  const page = Math.max(1, parseInt(p.get("page") || "1"))
  const limit = Math.min(500, Math.max(1, parseInt(p.get("limit") || "20")))

  const where: any = { storeId }
  if (search) where.OR = [
    { name: { contains: search, mode: "insensitive" } },
    { barcode: { contains: search } },
  ]
  if (filter === "low-stock") where.stock = { gt: 0, lte: 5 }
  else if (filter === "out-of-stock") where.stock = 0

  // No pagination param = return ALL products (POS, offline cache, etc.)
  if (!hasPagination) {
    const items = await prisma.product.findMany({ where, orderBy: { name: "asc" } })
    return NextResponse.json({ data: items })
  }

  // Run page items + stats in one round-trip
  const [total, items, stats] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, name: true, barcode: true, category: true, price: true,
        cost: true, stock: true, imageUrl: true, unit: true,
        onSale: true, salePrice: true, description: true,
      },
    }),
    // Stats only on first page / no filter to avoid extra queries on every paginate
    page === 1 && !search && filter === "all"
      ? prisma.product.aggregate({
          where: { storeId },
          _sum: { stock: true },
          _count: { id: true },
        })
      : null,
  ])

  let statsPayload = null
  if (stats) {
    const [lowStock, outOfStock, stockValueRows] = await Promise.all([
      prisma.product.count({ where: { storeId, stock: { gt: 0, lte: 5 } } }),
      prisma.product.count({ where: { storeId, stock: 0 } }),
      prisma.product.findMany({ where: { storeId }, select: { cost: true, stock: true } }),
    ])
    statsPayload = {
      productCount: stats._count.id,
      totalItems: stats._sum.stock ?? 0,
      stockValue: stockValueRows.reduce((s, p) => s + p.cost * p.stock, 0),
      lowStock,
      outOfStock,
    }
  }

  return NextResponse.json({
    data: items,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    ...(statsPayload ? { stats: statsPayload } : {}),
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, storeId, name, price, cost, stock, category, barcode, imageUrl, description, unit, onSale, salePrice, sku, weight, dimensions, shippingClass, variants } = body
    const item = await prisma.product.upsert({
      where: { id: id ?? "" },
      update: { name, price, cost, stock, category, barcode, imageUrl, description, unit, onSale, salePrice, sku, weight, dimensions, shippingClass, variants },
      create: { id, storeId, name, price, cost: cost ?? 0, stock: stock ?? 0, category: category ?? "", barcode: barcode ?? "", imageUrl, description, unit, onSale: onSale ?? false, salePrice, sku, weight, dimensions, shippingClass, variants },
    })
    return NextResponse.json({ data: item })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...data } = body
    const item = await prisma.product.update({ where: { id }, data })
    return NextResponse.json({ data: item })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  await prisma.product.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
