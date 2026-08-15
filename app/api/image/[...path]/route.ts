import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { existsSync } from "fs"
import path from "path"

function getUploadDir() {
  return process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads")
}

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
    const filePath = path.join(getUploadDir(), ...params.path)
    const uploadDir = getUploadDir()

    if (!filePath.startsWith(uploadDir)) {
      return new NextResponse("Forbidden", { status: 403 })
    }

    if (!existsSync(filePath)) {
      // Return transparent placeholder instead of broken image icon
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
