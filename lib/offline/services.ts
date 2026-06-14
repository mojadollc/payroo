/**
 * Offline-first service layer.
 * All reads come from IndexedDB first. Writes go to IndexedDB immediately,
 * then queue for Firestore sync when online.
 */

import { localGetByStoreId, localGetAll, localPut, localDelete, addPendingWrite, localPutMany } from "./store"
import { pullCollection, pullElistas, isOnline, pushPendingWrites } from "./sync-engine"
import { getStoreId } from "@/lib/store-id"
import type { Product, Category, Sale, UtangRecord, EWalletTransaction, InventoryTransaction } from "@/lib/firebase/types"

// ── Products ──────────────────────────────────────────────────────────────────

export async function offlineGetProducts(): Promise<Product[]> {
  const products = await localGetByStoreId<Product>("products")
  if (products.length > 0) return products.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))

  // IndexedDB empty — try pulling from Firestore
  if (isOnline()) {
    await pullCollection("products")
    const fresh = await localGetByStoreId<Product>("products")
    return fresh.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
  }
  return []
}

export async function offlineAddProduct(product: Omit<Product, "id" | "createdAt" | "updatedAt">): Promise<string> {
  const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  const now = Date.now()
  const doc = { ...product, id, storeId: getStoreId(), _createdAtMs: now, _updatedAtMs: now, _needsServerTimestamp: true }
  await localPut("products", doc)
  await addPendingWrite("products", id, "add", doc)
  if (isOnline()) pushPendingWrites()
  return id
}

export async function offlineUpdateProduct(id: string, data: Partial<Product>): Promise<void> {
  const existing = (await localGetByStoreId<Product>("products")).find(p => p.id === id)
  if (existing) {
    const updated = { ...existing, ...data, _updatedAtMs: Date.now() }
    await localPut("products", updated)
  }
  await addPendingWrite("products", id, "update", data)
  if (isOnline()) pushPendingWrites()
}

export async function offlineDeleteProduct(id: string): Promise<void> {
  await localDelete("products", id)
  await addPendingWrite("products", id, "delete")
  if (isOnline()) pushPendingWrites()
}

// ── Categories ────────────────────────────────────────────────────────────────

export async function offlineGetCategories(): Promise<Category[]> {
  const cats = await localGetByStoreId<Category>("categories")
  if (cats.length > 0) return cats.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))

  if (isOnline()) {
    await pullCollection("categories")
    return (await localGetByStoreId<Category>("categories")).sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
  }
  return []
}

export async function offlineAddCategory(category: Omit<Category, "id" | "createdAt">): Promise<string> {
  const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  const doc = { ...category, id, storeId: getStoreId(), _createdAtMs: Date.now(), _needsServerTimestamp: true }
  await localPut("categories", doc)
  await addPendingWrite("categories", id, "add", doc)
  if (isOnline()) pushPendingWrites()
  return id
}

// ── Sales ─────────────────────────────────────────────────────────────────────

export async function offlineGetSales(): Promise<Sale[]> {
  const sales = await localGetByStoreId<Sale>("sales")
  if (sales.length > 0) return sales.sort((a: any, b: any) => (b._createdAtMs ?? 0) - (a._createdAtMs ?? 0))

  if (isOnline()) {
    await pullCollection("sales")
    const fresh = await localGetByStoreId<Sale>("sales")
    return fresh.sort((a: any, b: any) => (b._createdAtMs ?? 0) - (a._createdAtMs ?? 0))
  }
  return []
}

export async function offlineAddSale(sale: Omit<Sale, "id" | "createdAt">): Promise<string> {
  const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  const now = Date.now()
  const doc = { ...sale, id, storeId: getStoreId(), _createdAtMs: now, _updatedAtMs: now, _needsServerTimestamp: true }
  await localPut("sales", doc)

  // Update product stock locally
  for (const item of sale.items) {
    const products = await localGetByStoreId<Product>("products")
    const p = products.find(pr => pr.id === item.productId)
    if (p) {
      await localPut("products", { ...p, stock: Math.max(0, p.stock - item.quantity), _updatedAtMs: now })
    }
  }

  await addPendingWrite("sales", id, "add", doc)
  if (isOnline()) pushPendingWrites()
  return id
}

// ── Utang ─────────────────────────────────────────────────────────────────────

export async function offlineGetUtang(): Promise<UtangRecord[]> {
  const records = await localGetByStoreId<UtangRecord>("utang")
  if (records.length > 0) return records.sort((a: any, b: any) => (b._createdAtMs ?? 0) - (a._createdAtMs ?? 0))

  if (isOnline()) {
    await pullCollection("utang")
    const fresh = await localGetByStoreId<UtangRecord>("utang")
    return fresh.sort((a: any, b: any) => (b._createdAtMs ?? 0) - (a._createdAtMs ?? 0))
  }
  return []
}

export async function offlineAddUtang(utang: Omit<UtangRecord, "id" | "createdAt" | "updatedAt">): Promise<string> {
  const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  const now = Date.now()
  const doc = { ...utang, id, _createdAtMs: now, _updatedAtMs: now, _needsServerTimestamp: true }
  await localPut("utang", doc)
  await addPendingWrite("utang", id, "add", doc)
  if (isOnline()) pushPendingWrites()
  return id
}

// ── E-Wallet ──────────────────────────────────────────────────────────────────

export async function offlineGetEWalletTransactions(): Promise<EWalletTransaction[]> {
  const txns = await localGetByStoreId<EWalletTransaction>("ewalletTransactions")
  if (txns.length > 0) return txns.sort((a: any, b: any) => (b._createdAtMs ?? 0) - (a._createdAtMs ?? 0))

  if (isOnline()) {
    await pullCollection("ewalletTransactions")
    return (await localGetByStoreId<EWalletTransaction>("ewalletTransactions")).sort((a: any, b: any) => (b._createdAtMs ?? 0) - (a._createdAtMs ?? 0))
  }
  return []
}

export async function offlineAddEWalletTransaction(txn: Omit<EWalletTransaction, "id" | "createdAt" | "commission" | "profit">): Promise<string> {
  const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  const now = Date.now()
  const commission = txn.amount * txn.commissionRate
  const doc = { ...txn, id, commission, profit: commission, storeId: getStoreId(), _createdAtMs: now, _needsServerTimestamp: true }
  await localPut("ewalletTransactions", doc)
  await addPendingWrite("ewalletTransactions", id, "add", doc)
  if (isOnline()) pushPendingWrites()
  return id
}

// ── e-Lista ───────────────────────────────────────────────────────────────────

export async function offlineGetElistas(userId: string): Promise<any[]> {
  const all = await localGetAll("elistas", (item: any) => item.userId === userId)
  if (all.length > 0) return all.sort((a: any, b: any) => (b._createdAtMs ?? 0) - (a._createdAtMs ?? 0))

  if (isOnline()) {
    await pullElistas(userId)
    return (await localGetAll("elistas", (item: any) => item.userId === userId))
      .sort((a: any, b: any) => (b._createdAtMs ?? 0) - (a._createdAtMs ?? 0))
  }
  return []
}

export async function offlineAddElista(data: { title: string; items: any[]; userId: string }): Promise<string> {
  const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  const now = Date.now()
  const doc = { ...data, id, _createdAtMs: now, _updatedAtMs: now, _needsServerTimestamp: true }
  await localPut("elistas", doc)
  await addPendingWrite("elistas", id, "add", doc)
  if (isOnline()) pushPendingWrites()
  return id
}

export async function offlineUpdateElista(id: string, data: { title: string; items: any[] }): Promise<void> {
  const all = await localGetAll("elistas")
  const existing = all.find((e: any) => e.id === id)
  if (existing) {
    await localPut("elistas", { ...existing, ...data, _updatedAtMs: Date.now() })
  }
  await addPendingWrite("elistas", id, "update", data)
  if (isOnline()) pushPendingWrites()
}

export async function offlineDeleteElista(id: string): Promise<void> {
  await localDelete("elistas", id)
  await addPendingWrite("elistas", id, "delete")
  if (isOnline()) pushPendingWrites()
}

// ── Inventory Transactions ────────────────────────────────────────────────────

export async function offlineAddInventoryTransaction(txn: any): Promise<string> {
  const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  const now = Date.now()
  const doc = { ...txn, id, storeId: getStoreId(), _createdAtMs: now, _needsServerTimestamp: true }
  await localPut("inventoryTransactions", doc)

  // Update product stock locally
  const products = await localGetByStoreId<Product>("products")
  const p = products.find(pr => pr.id === txn.productId)
  if (p) {
    await localPut("products", { ...p, stock: txn.newStock, _updatedAtMs: now })
  }

  await addPendingWrite("inventoryTransactions", id, "add", doc)
  if (isOnline()) pushPendingWrites()
  return id
}
