/**
 * Store / branch identity helpers.
 *
 * Each physical branch has its own externalId (4–6 digit Store ID).
 * All Firestore queries are scoped with getStoreId() so inventory, sales,
 * e-wallet, etc. stay isolated per branch.
 *
 * Multi-branch: the owner of a "main" store can link other externalIds as
 * branches and switch the active one without re-logging in.
 */

const EXT_ID_KEY = "pos_ext_id"
const STORE_NAME_KEY = "storeName"
const BRANCH_CACHE_KEY = "pos_branches_cache"
const MAIN_STORE_KEY = "pos_main_ext_id"

export function getStoreId(): string {
  if (typeof window === "undefined") return ""
  return localStorage.getItem(EXT_ID_KEY) ?? ""
}

/** The store the user originally logged into (main / HQ). */
export function getMainStoreId(): string {
  if (typeof window === "undefined") return ""
  return localStorage.getItem(MAIN_STORE_KEY) || getStoreId()
}

export function setActiveStoreId(externalId: string, storeName?: string) {
  if (typeof window === "undefined") return
  localStorage.setItem(EXT_ID_KEY, externalId.trim())
  if (storeName) localStorage.setItem(STORE_NAME_KEY, storeName)
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
  localStorage.removeItem(BRANCH_CACHE_KEY)
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

/**
 * Switch active branch and hard-reload so all modules pick up the new storeId.
 * Clears product/cart caches that are store-scoped.
 */
export function switchBranch(externalId: string, storeName?: string) {
  if (typeof window === "undefined") return
  const current = getStoreId()
  if (current === externalId.trim()) return

  setActiveStoreId(externalId, storeName)

  // Drop caches that belong to the previous branch
  try {
    localStorage.removeItem("pos_products_cache")
    localStorage.removeItem("pos_cart")
    localStorage.removeItem("pos_offline_queue")
  } catch {
    /* ignore */
  }

  // Full reload so hooks/listeners re-subscribe under the new storeId
  window.location.href = "/pos"
}
