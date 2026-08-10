import { NextRequest } from "next/server"
import { Client } from "pg"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CHANNELS = [
  "products_changed",
  "sales_changed",
  "utang_records_changed",
  "ewallet_transactions_changed",
]

export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get("storeId")
  if (!storeId) return new Response("Missing storeId", { status: 400 })

  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  for (const ch of CHANNELS) await client.query(`LISTEN "${ch}"`)

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      client.on("notification", (msg) => {
        try {
          const payload = JSON.parse(msg.payload ?? "{}")
          if (payload.storeId === storeId) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ channel: msg.channel, ...payload })}\n\n`)
            )
          }
        } catch {}
      })

      const heartbeat = setInterval(() => {
        try { controller.enqueue(encoder.encode(": ping\n\n")) } catch {}
      }, 25_000)

      req.signal.addEventListener("abort", async () => {
        clearInterval(heartbeat)
        await client.end()
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
