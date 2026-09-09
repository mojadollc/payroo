// Server-side in-memory product cache — survives across requests in the same Node process.
// Acts as a Redis-lite layer: PostgreSQL is only queried when cache is cold or expired.
// TTL: 5 minutes. Invalidated on any product write (POST/PATCH/DELETE).

const TTL_MS = 5 * 60 * 1000

interface CacheEntry {
  data: any[]
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()

export function getProductCache(storeId: string): any[] | null {
  const entry = cache.get(storeId)
  if (!entry || Date.now() > entry.expiresAt) {
    cache.delete(storeId)
    return null
  }
  return entry.data
}

export function setProductCache(storeId: string, data: any[]) {
  cache.set(storeId, { data, expiresAt: Date.now() + TTL_MS })
}

export function invalidateProductCache(storeId: string) {
  cache.delete(storeId)
}
