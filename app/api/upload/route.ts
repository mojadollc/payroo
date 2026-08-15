import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"

function getUploadDir() {
  return process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads")
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get("file") as File | null
    const productId = form.get("productId") as string | null

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })
    if (!productId) return NextResponse.json({ error: "No productId provided" }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())

    const safeId = productId.replace(/[^a-zA-Z0-9_-]/g, "_")
    const dir = path.join(getUploadDir(), "products", safeId)

    if (!existsSync(dir)) await mkdir(dir, { recursive: true })

    // Add timestamp to bust cache on re-upload
    const filename = `main_${Date.now()}.jpg`
    await writeFile(path.join(dir, filename), buffer)

    // Store relative URL — works on any host/port/domain
    const url = `/api/image/products/${safeId}/${filename}`
    return NextResponse.json({ url })
  } catch (err: any) {
    console.error("[upload] error:", err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
