/**
 * Store / branch identity helpers.
 *
 * Each physical branch has its own externalId (4–8 digit Store ID).
 * All Firestore queries are scoped with getStoreId() so inventory, sales,
 * e-wallet, etc. stay isolated per branch.
 */

const EXT_ID_KEY = "pos_ext_id"
const STORE_NAME_KEY = "storeName"
const BRANCH_CACHE_KEY = "pos_branches_cache"
const MAIN_STORE_KEY = "pos_main_ext_id"
const MAIN_STORE_NAME_KEY = "pos_main_store_name"

export function getStoreId(): string {
  if (typeof window === "undefined") return ""
  return localStorage.getItem(EXT_ID_KEY) ?? ""
}

/** The store the user originally logged into (main / HQ). */
export function getMainStoreId(): string {
  if (typeof window === "undefined") return ""
  return localStorage.getItem(MAIN_STORE_KEY) || getStoreId()
}

/** Stable HQ display name — not overwritten when switching branches. */
export function getMainStoreName(): string {
  if (typeof window === "undefined") return "Main Store"
  return localStorage.getItem(MAIN_STORE_NAME_KEY) || localStorage.getItem(STORE_NAME_KEY) || "Main Store"
}

export function setMainStoreName(name: string) {
  if (typeof window === "undefined") return
  if (name?.trim()) localStorage.setItem(MAIN_STORE_NAME_KEY, name.trim())
}

export function getStoreName(): string {
  if (typeof window === "undefined") return ""
  return localStorage.getItem(STORE_NAME_KEY) ?? ""
}

export function setActiveStoreId(externalId: string, storeName?: string) {
  if (typeof window === "undefined") return
  localStorage.setItem(EXT_ID_KEY, externalId.trim())
  if (storeName && storeName.trim()) {
    localStorage.setItem(STORE_NAME_KEY, storeName.trim())
  }
}

/** Call once after successful login to remember the HQ store. */
export function setMainStoreId(externalId: string) {
  if (typeof window === "undefined") return
  localStorage.setItem(MAIN_STORE_KEY, externalId.trim())
}

export function clearStoreSession() {
  if (typeof window === "undefined") return
  localStorage.removeItem(EXT_ID_KEY)
  localStorage.removeItem(MAIN_STORE_KEY)
  localStorage.removeItem(MAIN_STORE_NAME_KEY)
  localStorage.removeItem(BRANCH_CACHE_KEY)
  localStorage.removeItem(STORE_NAME_KEY)
}

export interface CachedBranch {
  externalId: string
  name: string
  isMain?: boolean
}

export function cacheBranches(branches: CachedBranch[]) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(BRANCH_CACHE_KEY, JSON.stringify(branches))
  } catch {
    /* quota */
  }
}

export function getCachedBranches(): CachedBranch[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(BRANCH_CACHE_KEY) || "[]")
  } catch {
    return []
  }
}

/** Resolve display name for a store id from branch cache / main name. */
export function resolveStoreName(externalId: string): string {
  if (typeof window === "undefined") return ""
  const id = externalId.trim()
  if (!id) return localStorage.getItem(STORE_NAME_KEY) || ""

  if (id === getMainStoreId()) {
    return getMainStoreName()
  }

  const cached = getCachedBranches().find(b => b.externalId === id)
  if (cached?.name) return cached.name

  return localStorage.getItem(STORE_NAME_KEY) || id
}

/**
 * Switch active branch and hard-reload so all modules pick up the new storeId.
 * Clears product/cart caches that are store-scoped.
 * Always updates the visible store name.
 */
export function switchBranch(externalId: string, storeName?: string) {
  if (typeof window === "undefined") return
  const nextId = externalId.trim()
  if (!nextId) return

  const current = getStoreId()
  // Resolve name even if caller omitted it
  const nextName = (storeName && storeName.trim()) || resolveStoreName(nextId) || nextId

  if (current === nextId) {
    // Still refresh the displayed name if it was wrong
    localStorage.setItem(STORE_NAME_KEY, nextName)
    window.dispatchEvent(new Event("storename"))
    return
  }

  setActiveStoreId(nextId, nextName)

  // Keep subscription cache in sync so UI bits that read storeName stay correct
  try {
    const raw = localStorage.getItem("pos_subscription")
    if (raw) {
      const sub = JSON.parse(raw)
      sub.storeName = nextName
      sub.externalId = nextId
      localStorage.setItem("pos_subscription", JSON.stringify(sub))
    }
  } catch {
    /* ignore */
  }

  // Drop caches that belong to the previous branch
  try {
    localStorage.removeItem("pos_products_cache")
    localStorage.removeItem("pos_cart")
    localStorage.removeItem("pos_offline_queue")
  } catch {
    /* ignore */
  }

  try {
    window.dispatchEvent(new Event("storename"))
  } catch {
    /* ignore */
  }

  window.location.href = "/pos"
}
