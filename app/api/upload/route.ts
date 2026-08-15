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

    // Guard against undefined/empty productId — generate a stable one
    if (!productId || productId === "undefined" || productId === "null") {
      productId = `prod_${randomUUID()}`
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const safeId = productId.replace(/[^a-zA-Z0-9_-]/g, "_")
    const dir = path.join(getUploadDir(), "products", safeId)

    if (!existsSync(dir)) await mkdir(dir, { recursive: true })

    // Timestamp in filename busts browser cache on re-upload
    const filename = `main_${Date.now()}.jpg`
    await writeFile(path.join(dir, filename), buffer)

    // Relative URL — works on any host/port/domain
    const url = `/api/image/products/${safeId}/${filename}`
    return NextResponse.json({ url, productId: safeId })
  } catch (err: any) {
    console.error("[upload] error:", err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
