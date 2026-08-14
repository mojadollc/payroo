import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { existsSync } from "fs"
import path from "path"

const UPLOAD_DIR =
  process.env.UPLOAD_DIR ||
  path.join(process.cwd(), "uploads")

export async function GET(
  _req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const filePath = path.join(UPLOAD_DIR, ...params.path)

    // Prevent path traversal
    if (!filePath.startsWith(UPLOAD_DIR)) {
      return new NextResponse("Forbidden", { status: 403 })
    }

    if (!existsSync(filePath)) {
      return new NextResponse("Not found", { status: 404 })
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
  } catch (err: any) {
    return new NextResponse("Error", { status: 500 })
  }
}
