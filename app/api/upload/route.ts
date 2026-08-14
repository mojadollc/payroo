import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"

// Persistent upload dir OUTSIDE the Next.js build folder so deploys never wipe it.
// On VPS: /var/www/uploads/payroo/products/
// Locally: <project_root>/uploads/products/
const UPLOAD_DIR =
  process.env.UPLOAD_DIR ||
  path.join(process.cwd(), "uploads")

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get("file") as File | null
    const productId = form.get("productId") as string | null

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })
    if (!productId) return NextResponse.json({ error: "No productId provided" }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())

    // Sanitise productId so it can't escape the directory
    const safeId = productId.replace(/[^a-zA-Z0-9_-]/g, "_")
    const dir = path.join(UPLOAD_DIR, "products", safeId)

    if (!existsSync(dir)) await mkdir(dir, { recursive: true })

    const filename = "main.jpg"
    await writeFile(path.join(dir, filename), buffer)

    // Return the URL that the /api/image route will serve
    const url = `${BASE_URL}/api/image/products/${safeId}/${filename}`
    return NextResponse.json({ url })
  } catch (err: any) {
    console.error("[upload] error:", err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
