import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { existsSync } from "fs"
import path from "path"

function getUploadDir() {
  return process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads")
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const filePath = path.join(getUploadDir(), ...params.path)
    const uploadDir = getUploadDir()

    // Prevent path traversal
    if (!filePath.startsWith(uploadDir)) {
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
