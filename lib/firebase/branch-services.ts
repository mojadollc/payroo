import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  limit,
} from "firebase/firestore"
import { getFirebaseDb } from "./config"
import { getMainStoreId, getStoreId, cacheBranches, type CachedBranch } from "@/lib/store-id"
import type { StoreBranch, CustomerSubscription, StoreUser } from "./types"

/**
 * List all branches linked to the main (HQ) store.
 * Also includes the main store itself as the first entry for the switcher.
 */
export async function listBranches(mainExternalId?: string): Promise<
  (StoreBranch & { isMain?: boolean })[]
> {
  const db = getFirebaseDb()
  if (!db) return []

  const mainId = (mainExternalId || getMainStoreId() || getStoreId()).trim()
  if (!mainId) return []

  const snap = await getDocs(
    query(
      collection(db, "storeBranches"),
      where("mainExternalId", "==", mainId),
      where("isActive", "==", true),
      orderBy("branchName")
    )
  )

  const branches = snap.docs.map(d => ({ id: d.id, ...d.data() } as StoreBranch))

  // Main store as first option
  const mainName =
    (typeof window !== "undefined" && localStorage.getItem("storeName")) || "Main Store"

  const list: (StoreBranch & { isMain?: boolean })[] = [
    {
      id: "main",
      mainExternalId: mainId,
      branchExternalId: mainId,
      branchName: mainName,
      isActive: true,
      isMain: true,
      createdAt: null as any,
      updatedAt: null as any,
    },
    ...branches,
  ]

  // Cache for offline / fast switcher paint
  const cache: CachedBranch[] = list.map(b => ({
    externalId: b.branchExternalId,
    name: b.branchName,
    isMain: !!b.isMain,
  }))
  cacheBranches(cache)

  return list
}

/**
 * Create a new branch under the current main store.
 * - Creates storeBranches link
 * - Creates a minimal customerSubscriptions row for the new externalId
 * - Creates an owner user so staff can log in directly to the branch if needed
 */
export async function createBranch(input: {
  branchName: string
  branchExternalId: string
  address?: string
  phone?: string
  /** PIN for the branch owner login (defaults to same as current owner if omitted) */
  ownerPin?: string
  ownerName?: string
}): Promise<string> {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured")

  const mainId = getMainStoreId() || getStoreId()
  if (!mainId) throw new Error("No main store selected")

  const branchId = input.branchExternalId.trim()
  if (branchId.length < 4 || branchId.length > 8) {
    throw new Error("Branch Store ID must be 4–8 characters")
  }
  if (branchId === mainId) {
    throw new Error("Branch Store ID cannot be the same as the main store")
  }
  if (!input.branchName.trim()) {
    throw new Error("Branch name is required")
  }

  // Ensure externalId is not already used as a subscription
  const existingSub = await getDocs(
    query(collection(db, "customerSubscriptions"), where("externalId", "==", branchId), limit(1))
  )
  if (!existingSub.empty) {
    throw new Error("This Store ID is already in use. Choose another.")
  }

  // Ensure not already linked as a branch
  const existingBranch = await getDocs(
    query(collection(db, "storeBranches"), where("branchExternalId", "==", branchId), limit(1))
  )
  if (!existingBranch.empty) {
    throw new Error("This Store ID is already registered as a branch")
  }

  // Copy subscription features from main store (shared plan)
  let mainSub: Partial<CustomerSubscription> = {}
  try {
    const mainSnap = await getDocs(
      query(
        collection(db, "customerSubscriptions"),
        where("externalId", "==", mainId),
        orderBy("createdAt", "desc"),
        limit(1)
      )
    )
    if (!mainSnap.empty) {
      mainSub = mainSnap.docs[0].data() as CustomerSubscription
    }
  } catch {
    /* indexes optional */
  }

  // 1) Branch link
  const branchRef = await addDoc(collection(db, "storeBranches"), {
    mainExternalId: mainId,
    branchExternalId: branchId,
    branchName: input.branchName.trim(),
    address: input.address?.trim() || "",
    phone: input.phone?.trim() || "",
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  // 2) Subscription row so login + feature gates work for the branch
  await addDoc(collection(db, "customerSubscriptions"), {
    ownerName: input.ownerName || mainSub.ownerName || "Branch Owner",
    ownerEmail: mainSub.ownerEmail || "",
    storeName: input.branchName.trim(),
    businessType: mainSub.businessType || "retail",
    phone: input.phone?.trim() || mainSub.phone || "",
    planId: mainSub.planId || "basic",
    tier: mainSub.tier || "basic",
    status: mainSub.status || "active",
    startDate: mainSub.startDate || serverTimestamp(),
    endDate: mainSub.endDate || null,
    features: mainSub.features || {
      pos: true,
      inventory: true,
      ewallet: true,
      reports: true,
      loyalty: false,
      utang: false,
      aiRestock: false,
      multiUser: true,
      exportData: false,
      marketIntelligence: false,
      delivery: false,
    },
    externalId: branchId,
    parentExternalId: mainId,
    notes: `Branch of ${mainId}`,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  // 3) Owner user for direct branch login
  const pin = (input.ownerPin || "").trim()
  if (pin) {
    await addDoc(collection(db, "storeUsers"), {
      name: input.ownerName || `${input.branchName.trim()} Owner`,
      username: `branch-${branchId}`,
      pin,
      role: "owner",
      externalId: branchId,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    } satisfies Omit<StoreUser, "id">)
  }

  return branchRef.id
}

export async function updateBranch(
  id: string,
  updates: Partial<Pick<StoreBranch, "branchName" | "address" | "phone" | "isActive">>
) {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured")
  await updateDoc(doc(db, "storeBranches", id), {
    ...updates,
    updatedAt: serverTimestamp(),
  })
}

export async function deactivateBranch(id: string) {
  return updateBranch(id, { isActive: false })
}

export async function deleteBranchLink(id: string) {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured")
  await deleteDoc(doc(db, "storeBranches", id))
}
