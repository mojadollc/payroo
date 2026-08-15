import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"
import { existsSync } from "fs"
import path from "path"

function getUploadDir() {
  return process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads")
}

// GET /api/fix-images?secret=<ADMIN_PIN>
// Scans all products with imageUrl, checks if file exists on disk.
// - Fixes absolute localhost URLs → relative paths
// - Nulls out imageUrls where the file is missing (broken forever)
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret")
  if (secret !== process.env.NEXT_PUBLIC_ADMIN_PIN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const products = await prisma.product.findMany({
    where: { imageUrl: { not: null } },
    select: { id: true, imageUrl: true, name: true },
  })

  const broken: string[] = []
  const fixed: string[] = []

  for (const p of products) {
    if (!p.imageUrl) continue

    let relativePath = p.imageUrl

    // Strip absolute origin → relative
    try {
      const parsed = new URL(p.imageUrl)
      if (parsed.pathname.startsWith("/api/image/")) {
        relativePath = parsed.pathname
      }
    } catch { /* already relative */ }

    if (!relativePath.startsWith("/api/image/")) continue

    const filePart = relativePath.replace("/api/image/", "")
    const filePath = path.join(getUploadDir(), ...filePart.split("/"))

    if (!existsSync(filePath)) {
      // File missing on disk — null the imageUrl so DefaultProductImage shows
      await prisma.product.update({ where: { id: p.id }, data: { imageUrl: null } })
      broken.push(`${p.name} → nulled (file missing: ${filePath})`)
    } else if (p.imageUrl !== relativePath) {
      // Fix absolute URL to relative
      await prisma.product.update({ where: { id: p.id }, data: { imageUrl: relativePath } })
      fixed.push(`${p.name} → ${relativePath}`)
    }
  }

  return NextResponse.json({
    message: `Done. ${broken.length} broken nulled, ${fixed.length} URLs normalised.`,
    broken,
    fixed,
  })
}
