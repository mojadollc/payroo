/**
 * Store / branch identity helpers.
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

export function getMainStoreId(): string {
  if (typeof window === "undefined") return ""
  return localStorage.getItem(MAIN_STORE_KEY) || getStoreId()
}

export function getMainStoreName(): string {
  if (typeof window === "undefined") return "Main Store"
  return (
    localStorage.getItem(MAIN_STORE_NAME_KEY) ||
    "Main Store"
  )
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
  } catch { /* quota */ }
}

export function getCachedBranches(): CachedBranch[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(BRANCH_CACHE_KEY) || "[]")
  } catch {
    return []
  }
}

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
 * Switch branch. Always sets name. Soft-navigates without breaking subscription.
 */
export function switchBranch(externalId: string, storeName?: string) {
  if (typeof window === "undefined") return
  const nextId = externalId.trim()
  if (!nextId) return

  const current = getStoreId()
  const nextName = (storeName && storeName.trim()) || resolveStoreName(nextId) || nextId

  // Ensure main id is never lost
  if (!localStorage.getItem(MAIN_STORE_KEY)) {
    // If we somehow lost it, keep current as main only when switching away first time
    localStorage.setItem(MAIN_STORE_KEY, current || nextId)
  }

  setActiveStoreId(nextId, nextName)

  // Update subscription cache display name only — NEVER change externalId.
  // The subscription always belongs to the main store (HQ). Changing externalId
  // here causes useSubscription to query the branch ID which has no sub doc,
  // making the store appear expired.
  try {
    const raw = localStorage.getItem("pos_subscription")
    if (raw) {
      const sub = JSON.parse(raw)
      sub.storeName = nextName
      // Never flip isActive to false during a switch
      if (sub.isActive === undefined) sub.isActive = true
      localStorage.setItem("pos_subscription", JSON.stringify(sub))
    }
  } catch { /* ignore */ }

  try {
    localStorage.removeItem("pos_products_cache")
    localStorage.removeItem("pos_cart")
    localStorage.removeItem("pos_offline_queue")
  } catch { /* ignore */ }

  try {
    window.dispatchEvent(new Event("storename"))
  } catch { /* ignore */ }

  // Use replace so back-button doesn't bounce between stores oddly
  window.location.replace("/pos")
}
