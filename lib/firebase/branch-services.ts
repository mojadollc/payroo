import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  limit,
} from "firebase/firestore"
import { getFirebaseDb } from "./config"
import {
  getMainStoreId,
  getMainStoreName,
  getStoreId,
  cacheBranches,
  type CachedBranch,
} from "@/lib/store-id"
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

  let branches: StoreBranch[] = []
  try {
    const snap = await getDocs(
      query(
        collection(db, "storeBranches"),
        where("mainExternalId", "==", mainId),
        where("isActive", "==", true),
        orderBy("branchName")
      )
    )
    branches = snap.docs.map(d => ({ id: d.id, ...d.data() } as StoreBranch))
  } catch (err) {
    console.warn("[listBranches] ordered query failed, retrying:", err)
    const snap = await getDocs(
      query(
        collection(db, "storeBranches"),
        where("mainExternalId", "==", mainId),
        where("isActive", "==", true)
      )
    )
    branches = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as StoreBranch))
      .sort((a, b) => a.branchName.localeCompare(b.branchName))
  }

  // Stable HQ name — never use the currently active branch name
  const mainName = getMainStoreName()

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
 */
export async function createBranch(input: {
  branchName: string
  branchExternalId: string
  address?: string
  phone?: string
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

  const existingSub = await getDocs(
    query(collection(db, "customerSubscriptions"), where("externalId", "==", branchId), limit(1))
  )
  if (!existingSub.empty) {
    throw new Error("This Store ID is already in use. Choose another.")
  }

  const existingBranch = await getDocs(
    query(collection(db, "storeBranches"), where("branchExternalId", "==", branchId), limit(1))
  )
  if (!existingBranch.empty) {
    throw new Error("This Store ID is already registered as a branch")
  }

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
    try {
      const mainSnap = await getDocs(
        query(collection(db, "customerSubscriptions"), where("externalId", "==", mainId), limit(1))
      )
      if (!mainSnap.empty) mainSub = mainSnap.docs[0].data() as CustomerSubscription
    } catch {
      /* ignore */
    }
  }

  const branchName = input.branchName.trim()

  const branchRef = await addDoc(collection(db, "storeBranches"), {
    mainExternalId: mainId,
    branchExternalId: branchId,
    branchName,
    address: input.address?.trim() || "",
    phone: input.phone?.trim() || "",
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  await addDoc(collection(db, "customerSubscriptions"), {
    ownerName: input.ownerName || mainSub.ownerName || "Branch Owner",
    ownerEmail: mainSub.ownerEmail || "",
    storeName: branchName,
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

  // Critical: so navbar shows the correct branch name after switch
  await addDoc(collection(db, "storeSettings"), {
    name: branchName,
    address: input.address?.trim() || "",
    phone: input.phone?.trim() || "",
    businessType: mainSub.businessType || "retail",
    storeId: branchId,
  })

  const pin = (input.ownerPin || "").trim()
  if (pin) {
    await addDoc(collection(db, "storeUsers"), {
      name: input.ownerName || `${branchName} Owner`,
      username: `branch-${branchId}`,
      pin,
      role: "owner",
      externalId: branchId,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    } satisfies Omit<StoreUser, "id">)
  }

  try {
    await listBranches(mainId)
  } catch {
    /* ignore */
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

  if (updates.branchName) {
    try {
      const bdoc = await getDoc(doc(db, "storeBranches", id))
      const data = bdoc.data() as StoreBranch | undefined
      if (data?.branchExternalId) {
        const settingsSnap = await getDocs(
          query(collection(db, "storeSettings"), where("storeId", "==", data.branchExternalId))
        )
        if (!settingsSnap.empty) {
          await updateDoc(settingsSnap.docs[0].ref, { name: updates.branchName })
        } else {
          await addDoc(collection(db, "storeSettings"), {
            name: updates.branchName,
            address: data.address || "",
            phone: data.phone || "",
            storeId: data.branchExternalId,
          })
        }
      }
    } catch (e) {
      console.warn("[updateBranch] storeSettings sync failed", e)
    }
  }
}

export async function deactivateBranch(id: string) {
  return updateBranch(id, { isActive: false })
}

export async function deleteBranchLink(id: string) {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured")
  await deleteDoc(doc(db, "storeBranches", id))
}
