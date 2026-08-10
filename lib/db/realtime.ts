"use client"

type ChangePayload = {
  channel: string
  action: "INSERT" | "UPDATE" | "DELETE"
  storeId: string
}

type Unsubscribe = () => void

const TABLE_CHANNELS: Record<string, string> = {
  products: "products_changed",
  sales: "sales_changed",
  utang: "utang_records_changed",
  ewallet: "ewallet_transactions_changed",
}

let es: EventSource | null = null
let listeners: Map<string, Set<(p: ChangePayload) => void>> = new Map()
let currentStoreId: string | null = null

function getOrCreateEventSource(storeId: string) {
  if (es && currentStoreId === storeId) return
  if (es) es.close()

  currentStoreId = storeId
  es = new EventSource(`/api/realtime?storeId=${encodeURIComponent(storeId)}`)

  es.onmessage = (event) => {
    try {
      const payload: ChangePayload = JSON.parse(event.data)
      const handlers = listeners.get(payload.channel)
      handlers?.forEach((fn) => fn(payload))
    } catch {}
  }

  es.onerror = () => {
    // browser auto-reconnects EventSource
  }
}

function subscribe(channel: string, storeId: string, handler: (p: ChangePayload) => void): Unsubscribe {
  getOrCreateEventSource(storeId)
  if (!listeners.has(channel)) listeners.set(channel, new Set())
  listeners.get(channel)!.add(handler)

  return () => {
    listeners.get(channel)?.delete(handler)
  }
}

export function subscribeToProducts(storeId: string, onChange: (p: ChangePayload) => void): Unsubscribe {
  return subscribe(TABLE_CHANNELS.products, storeId, onChange)
}

export function subscribeToSales(storeId: string, onChange: (p: ChangePayload) => void): Unsubscribe {
  return subscribe(TABLE_CHANNELS.sales, storeId, onChange)
}

export function subscribeToUtang(storeId: string, onChange: (p: ChangePayload) => void): Unsubscribe {
  return subscribe(TABLE_CHANNELS.utang, storeId, onChange)
}

export function subscribeToEWallet(storeId: string, onChange: (p: ChangePayload) => void): Unsubscribe {
  return subscribe(TABLE_CHANNELS.ewallet, storeId, onChange)
}

/** Drop-in replacement for startRealtimeSync() — call once on app mount */
export function startRealtimeSync(storeId: string): Unsubscribe {
  getOrCreateEventSource(storeId)
  return () => {
    es?.close()
    es = null
    listeners.clear()
    currentStoreId = null
  }
}
