import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { randomUUID } from "crypto"

const UPLOAD_DIR = "/var/www/pntos.payroo.xyz/inventory/products/images"

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get("file") as File | null
    let productId = (form.get("productId") as string | null)?.trim()

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })
    if (!file.size) return NextResponse.json({ error: "Empty file" }, { status: 400 })

    if (!productId || productId === "undefined" || productId === "null") {
      productId = `prod_${randomUUID()}`
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    if (!buffer.length) return NextResponse.json({ error: "Empty buffer" }, { status: 400 })

    // Clean productId for filename — add timestamp so re-uploads bust the cache
    const safeId = productId.replace(/[^a-zA-Z0-9_-]/g, "_")
    const filename = `${safeId}_${Date.now()}.jpg`
    const filePath = path.join(UPLOAD_DIR, filename)

    // Ensure directory exists
    await mkdir(UPLOAD_DIR, { recursive: true })

    // Write file
    await writeFile(filePath, buffer)

    // Verify file was written
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: "File write failed" }, { status: 500 })
    }

    // Public URL path (served by /api/image/...)
    const url = `/api/image/${filename}`

    console.log(`[upload] saved ${buffer.length} bytes → ${filePath}`)

    return NextResponse.json({ url, productId: safeId })
  } catch (err: any) {
    console.error("[upload] error:", err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
