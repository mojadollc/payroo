import { openDB, type IDBPDatabase } from "idb"

const DB_NAME = "payroo_offline"
const DB_VERSION = 1

export interface SyncMeta {
  collection: string
  lastSyncedAt: number
}

export interface PendingWrite {
  id: string
  collection: string
  docId: string
  operation: "add" | "update" | "delete"
  data: any
  createdAt: number
  retries: number
}

export type PayrooDB = IDBPDatabase<{
  products: { key: string; value: any; indexes: { storeId: string } }
  categories: { key: string; value: any; indexes: { storeId: string } }
  sales: { key: string; value: any; indexes: { storeId: string; createdAt: string } }
  elistas: { key: string; value: any; indexes: { userId: string } }
  utang: { key: string; value: any; indexes: { storeId: string } }
  inventoryTransactions: { key: string; value: any; indexes: { storeId: string } }
  ewalletTransactions: { key: string; value: any; indexes: { storeId: string } }
  pendingWrites: { key: string; value: PendingWrite; indexes: { collection: string } }
  syncMeta: { key: string; value: SyncMeta }
}>

let dbInstance: PayrooDB | null = null

export async function getDB(): Promise<PayrooDB> {
  if (dbInstance) return dbInstance

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Products
      if (!db.objectStoreNames.contains("products")) {
        const store = db.createObjectStore("products", { keyPath: "id" })
        store.createIndex("storeId", "storeId")
      }
      // Categories
      if (!db.objectStoreNames.contains("categories")) {
        const store = db.createObjectStore("categories", { keyPath: "id" })
        store.createIndex("storeId", "storeId")
      }
      // Sales
      if (!db.objectStoreNames.contains("sales")) {
        const store = db.createObjectStore("sales", { keyPath: "id" })
        store.createIndex("storeId", "storeId")
        store.createIndex("createdAt", "_createdAtMs")
      }
      // e-Listas
      if (!db.objectStoreNames.contains("elistas")) {
        const store = db.createObjectStore("elistas", { keyPath: "id" })
        store.createIndex("userId", "userId")
      }
      // Utang
      if (!db.objectStoreNames.contains("utang")) {
        const store = db.createObjectStore("utang", { keyPath: "id" })
        store.createIndex("storeId", "storeId")
      }
      // Inventory Transactions
      if (!db.objectStoreNames.contains("inventoryTransactions")) {
        const store = db.createObjectStore("inventoryTransactions", { keyPath: "id" })
        store.createIndex("storeId", "storeId")
      }
      // E-Wallet Transactions
      if (!db.objectStoreNames.contains("ewalletTransactions")) {
        const store = db.createObjectStore("ewalletTransactions", { keyPath: "id" })
        store.createIndex("storeId", "storeId")
      }
      // Pending writes queue
      if (!db.objectStoreNames.contains("pendingWrites")) {
        const store = db.createObjectStore("pendingWrites", { keyPath: "id" })
        store.createIndex("collection", "collection")
      }
      // Sync metadata
      if (!db.objectStoreNames.contains("syncMeta")) {
        db.createObjectStore("syncMeta", { keyPath: "collection" })
      }
    },
  }) as unknown as PayrooDB

  return dbInstance
}
