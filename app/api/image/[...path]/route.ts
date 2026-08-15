import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { existsSync } from "fs"
import path from "path"

const UPLOAD_DIR = "/var/www/pntos.payroo.xyz/inventory/products/images"

// 1x1 transparent PNG — shown instead of broken image icon when file missing
const PLACEHOLDER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
)

export async function GET(
  _req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const filePath = path.join(UPLOAD_DIR, ...params.path)

    if (!filePath.startsWith(UPLOAD_DIR)) {
      return new NextResponse("Forbidden", { status: 403 })
    }

    if (!existsSync(filePath)) {
      return new NextResponse(PLACEHOLDER, {
        headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
      })
    }

    const buffer = await readFile(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const mime =
      ext === ".png" ? "image/png" :
      ext === ".webp" ? "image/webp" :
      ext === ".gif" ? "image/gif" :
      "image/jpeg"

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch {
    return new NextResponse(PLACEHOLDER, {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    })
  }
}
