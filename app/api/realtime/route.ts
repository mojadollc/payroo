import { NextRequest } from "next/server"
import createSubscriber from "pg-listen"

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

  const subscriber = createSubscriber({ connectionString: process.env.DATABASE_URL! })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      subscriber.notifications.on("*", (payload: string, channel: string) => {
        try {
          const parsed = JSON.parse(payload)
          if (parsed.storeId === storeId) {
            send({ channel, ...parsed })
          }
        } catch {}
      })

      await subscriber.connect()
      for (const ch of CHANNELS) await subscriber.listenTo(ch)

      // heartbeat every 25s to keep connection alive
      const heartbeat = setInterval(() => {
        try { controller.enqueue(encoder.encode(": ping\n\n")) } catch {}
      }, 25_000)

      req.signal.addEventListener("abort", async () => {
        clearInterval(heartbeat)
        await subscriber.close()
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
