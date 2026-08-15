import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { randomUUID } from "crypto"

function getUploadDir() {
  return process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads")
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get("file") as File | null
    let productId = (form.get("productId") as string | null)?.trim()

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })
    if (!file.size) return NextResponse.json({ error: "Empty file" }, { status: 400 })

    // Guard against undefined/empty productId
    if (!productId || productId === "undefined" || productId === "null") {
      productId = `prod_${randomUUID()}`
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    if (!buffer.length) return NextResponse.json({ error: "Empty buffer" }, { status: 400 })

    const safeId = productId.replace(/[^a-zA-Z0-9_-]/g, "_")
    const uploadDir = getUploadDir()
    const dir = path.join(uploadDir, "products", safeId)

    await mkdir(dir, { recursive: true })

    const filename = `main_${Date.now()}.jpg`
    const filePath = path.join(dir, filename)
    await writeFile(filePath, buffer)

    // Verify file was actually written
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: "File write failed" }, { status: 500 })
    }

    const url = `/api/image/products/${safeId}/${filename}`
    console.log(`[upload] saved ${buffer.length} bytes → ${filePath} → ${url}`)
    return NextResponse.json({ url, productId: safeId })
  } catch (err: any) {
    console.error("[upload] error:", err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
