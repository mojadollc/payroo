import { getDB, type PendingWrite } from "./db"
import { getStoreId } from "@/lib/store-id"

// ── Local CRUD operations (IndexedDB) ─────────────────────────────────────────

type CollectionName = "products" | "categories" | "sales" | "elistas" | "utang" | "inventoryTransactions" | "ewalletTransactions"

export async function localGet<T = any>(col: CollectionName, id: string): Promise<T | undefined> {
  const db = await getDB()
  return db.get(col, id) as Promise<T | undefined>
}

export async function localGetAll<T = any>(col: CollectionName, filterFn?: (item: T) => boolean): Promise<T[]> {
  const db = await getDB()
  const all = await db.getAll(col) as T[]
  return filterFn ? all.filter(filterFn) : all
}

export async function localGetByStoreId<T = any>(col: CollectionName): Promise<T[]> {
  const db = await getDB()
  const storeId = getStoreId()
  const all = await db.getAll(col) as any[]
  return all.filter(item => item.storeId === storeId) as T[]
}

export async function localPut(col: CollectionName, data: any): Promise<void> {
  const db = await getDB()
  await db.put(col, data)
}

export async function localPutMany(col: CollectionName, items: any[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(col, "readwrite")
  for (const item of items) {
    tx.store.put(item)
  }
  await tx.done
}

export async function localDelete(col: CollectionName, id: string): Promise<void> {
  const db = await getDB()
  await db.delete(col, id)
}

export async function localClear(col: CollectionName): Promise<void> {
  const db = await getDB()
  await db.clear(col)
}

// ── Pending Write Queue ───────────────────────────────────────────────────────

export async function addPendingWrite(
  collection: CollectionName,
  docId: string,
  operation: PendingWrite["operation"],
  data?: any
): Promise<string> {
  const db = await getDB()
  const id = `pw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  const entry: PendingWrite = {
    id,
    collection,
    docId,
    operation,
    data: data ?? null,
    createdAt: Date.now(),
    retries: 0,
  }
  await db.put("pendingWrites", entry)
  return id
}

export async function getPendingWrites(): Promise<PendingWrite[]> {
  const db = await getDB()
  const all = await db.getAll("pendingWrites")
  return all.sort((a, b) => a.createdAt - b.createdAt)
}

export async function removePendingWrite(id: string): Promise<void> {
  const db = await getDB()
  await db.delete("pendingWrites", id)
}

export async function getPendingWriteCount(): Promise<number> {
  const db = await getDB()
  return db.count("pendingWrites")
}

// ── Sync Metadata ─────────────────────────────────────────────────────────────

export async function getLastSyncTime(col: CollectionName): Promise<number> {
  const db = await getDB()
  const meta = await db.get("syncMeta", col)
  return meta?.lastSyncedAt ?? 0
}

export async function setLastSyncTime(col: CollectionName, time: number): Promise<void> {
  const db = await getDB()
  await db.put("syncMeta", { collection: col, lastSyncedAt: time })
}
