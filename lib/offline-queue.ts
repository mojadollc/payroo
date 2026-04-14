const QUEUE_KEY = "kiosk_offline_queue"

export interface QueuedTransaction {
  id: string
  payload: Record<string, any>
  queuedAt: number
  retries: number
}

export const enqueueTransaction = (payload: Record<string, any>): string => {
  const id = `offline_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  const queue = getQueue()
  queue.push({ id, payload, queuedAt: Date.now(), retries: 0 })
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  return id
}

export const getQueue = (): QueuedTransaction[] => {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]")
  } catch {
    return []
  }
}

export const removeFromQueue = (id: string) => {
  const queue = getQueue().filter(t => t.id !== id)
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

export const flushQueue = async (): Promise<{ synced: number; failed: number }> => {
  const queue = getQueue()
  if (queue.length === 0) return { synced: 0, failed: 0 }

  let synced = 0
  let failed = 0

  for (const txn of queue) {
    try {
      const res = await fetch("/api/xendit/cashin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(txn.payload),
      })
      if (res.ok) {
        removeFromQueue(txn.id)
        synced++
      } else {
        failed++
      }
    } catch {
      failed++
    }
  }

  return { synced, failed }
}
