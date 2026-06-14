import {
  collection, getDocs, query, where, orderBy, addDoc, updateDoc, deleteDoc, doc,
  serverTimestamp, Timestamp, onSnapshot, writeBatch, getDoc
} from "firebase/firestore"
import { getFirebaseDb } from "@/lib/firebase/config"
import { getStoreId } from "@/lib/store-id"
import {
  localPutMany, localPut, localDelete, localGetByStoreId,
  getPendingWrites, removePendingWrite, setLastSyncTime, getLastSyncTime,
  getPendingWriteCount,
} from "./store"
import type { PendingWrite } from "./db"

let syncing = false
let listeners: (() => void)[] = []

export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true
}

// ── Push: send pending local writes to Firestore ──────────────────────────────

export async function pushPendingWrites(): Promise<{ synced: number; failed: number }> {
  if (syncing || !isOnline()) return { synced: 0, failed: 0 }

  const db = getFirebaseDb()
  if (!db) return { synced: 0, failed: 0 }

  const pending = await getPendingWrites()
  if (pending.length === 0) return { synced: 0, failed: 0 }

  syncing = true
  let synced = 0
  let failed = 0

  for (const pw of pending) {
    try {
      await executePendingWrite(db, pw)
      await removePendingWrite(pw.id)
      synced++
    } catch (err) {
      console.error("[Sync] Failed to push:", pw.id, err)
      failed++
    }
  }

  syncing = false

  if (synced > 0) {
    window.dispatchEvent(new CustomEvent("offline-sync-complete", { detail: { synced, failed } }))
  }

  return { synced, failed }
}

async function executePendingWrite(db: any, pw: PendingWrite) {
  const storeId = getStoreId()

  if (pw.operation === "add") {
    const data = { ...pw.data }
    delete data.id
    delete data._createdAtMs
    delete data._updatedAtMs
    // Replace timestamp markers
    if (data._needsServerTimestamp) {
      data.createdAt = serverTimestamp()
      data.updatedAt = serverTimestamp()
      delete data._needsServerTimestamp
    }
    await addDoc(collection(db, pw.collection), { ...data, storeId })
  } else if (pw.operation === "update") {
    const data = { ...pw.data }
    delete data.id
    delete data._createdAtMs
    delete data._updatedAtMs
    data.updatedAt = serverTimestamp()
    await updateDoc(doc(db, pw.collection, pw.docId), data)
  } else if (pw.operation === "delete") {
    await deleteDoc(doc(db, pw.collection, pw.docId))
  }
}

// ── Pull: fetch latest data from Firestore into IndexedDB ─────────────────────

export async function pullCollection(
  collectionName: "products" | "categories" | "sales" | "utang" | "inventoryTransactions" | "ewalletTransactions",
): Promise<number> {
  if (!isOnline()) return 0

  const db = getFirebaseDb()
  if (!db) return 0

  const storeId = getStoreId()
  if (!storeId) return 0

  try {
    const q = query(collection(db, collectionName), where("storeId", "==", storeId))
    const snap = await getDocs(q)
    const items = snap.docs.map(d => {
      const data = d.data()
      return {
        ...data,
        id: d.id,
        _createdAtMs: data.createdAt?.toMillis?.() ?? Date.now(),
        _updatedAtMs: data.updatedAt?.toMillis?.() ?? Date.now(),
      }
    })

    await localPutMany(collectionName, items)
    await setLastSyncTime(collectionName, Date.now())
    return items.length
  } catch (err) {
    console.error(`[Sync] Pull ${collectionName} failed:`, err)
    return 0
  }
}

export async function pullElistas(userId: string): Promise<number> {
  if (!isOnline()) return 0

  const db = getFirebaseDb()
  if (!db) return 0

  try {
    const q = query(collection(db, "elistas"), where("userId", "==", userId))
    const snap = await getDocs(q)
    const items = snap.docs.map(d => {
      const data = d.data()
      return {
        ...data,
        id: d.id,
        _createdAtMs: data.createdAt?.toMillis?.() ?? Date.now(),
        _updatedAtMs: data.updatedAt?.toMillis?.() ?? Date.now(),
      }
    })

    await localPutMany("elistas", items)
    await setLastSyncTime("elistas", Date.now())
    return items.length
  } catch (err) {
    console.error("[Sync] Pull elistas failed:", err)
    return 0
  }
}

// ── Full sync: push then pull all collections ─────────────────────────────────

export async function fullSync(): Promise<{ pushed: number; pulled: number }> {
  if (!isOnline()) return { pushed: 0, pulled: 0 }

  // Push first
  const { synced: pushed } = await pushPendingWrites()

  // Then pull
  let pulled = 0
  const collections = ["products", "categories", "sales", "utang", "inventoryTransactions", "ewalletTransactions"] as const
  for (const col of collections) {
    pulled += await pullCollection(col)
  }

  return { pushed, pulled }
}

// ── Real-time listener for products (keeps IndexedDB in sync) ─────────────────

export function startRealtimeSync(): () => void {
  const db = getFirebaseDb()
  if (!db) return () => {}

  const storeId = getStoreId()
  if (!storeId) return () => {}

  // Products real-time sync
  const unsub = onSnapshot(
    query(collection(db, "products"), where("storeId", "==", storeId)),
    (snap) => {
      const items = snap.docs.map(d => ({
        ...d.data(),
        id: d.id,
        _createdAtMs: d.data().createdAt?.toMillis?.() ?? Date.now(),
        _updatedAtMs: d.data().updatedAt?.toMillis?.() ?? Date.now(),
      }))
      localPutMany("products", items)
    },
    (err) => console.error("[RealtimeSync] products error:", err)
  )

  listeners.push(unsub)
  return () => {
    listeners.forEach(fn => fn())
    listeners = []
  }
}

// ── Auto-sync on connectivity changes ─────────────────────────────────────────

let initialized = false

export function initOfflineDB() {
  if (typeof window === "undefined" || initialized) return
  initialized = true

  // Sync when coming back online
  window.addEventListener("online", () => {
    setTimeout(() => pushPendingWrites(), 1000)
  })

  // Sync on tab focus
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && isOnline()) {
      pushPendingWrites()
    }
  })

  // Initial sync attempt
  if (isOnline()) {
    setTimeout(() => fullSync(), 2000)
  }
}

// ── Helper: get pending count for UI ──────────────────────────────────────────

export { getPendingWriteCount }
