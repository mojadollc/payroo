/**
 * pos-session.ts
 * Single source of truth for the active store session.
 * Replaces the scattered storeName / pos_ext_id / pos_subscription keys
 * with one versioned object so stale data from another store is impossible.
 */

const SESSION_KEY = "pos_session_v2"

export interface PosSession {
  externalId: string
  mainExternalId: string
  storeName: string
  branchName?: string        // set only when active store is a branch
  isMainStore: boolean
  tier: string
  isActive: boolean
  endDate: string | null
  features: Record<string, boolean>
  businessType: string | null
  ownerName: string | null
  ownerEmail: string | null
}

export function getSession(): PosSession | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PosSession
  } catch {
    return null
  }
}

export function setSession(s: PosSession) {
  if (typeof window === "undefined") return
  localStorage.setItem(SESSION_KEY, JSON.stringify(s))
  // Keep legacy keys in sync so existing code that reads them still works
  localStorage.setItem("pos_ext_id", s.externalId)
  localStorage.setItem("pos_main_ext_id", s.mainExternalId)
  localStorage.setItem("storeName", s.storeName)
  localStorage.setItem("pos_main_store_name", s.storeName)
  // Write pos_subscription so useSubscription hook reads correct data immediately
  localStorage.setItem("pos_subscription", JSON.stringify({
    loading: false,
    isActive: s.isActive,
    tier: s.tier,
    features: s.features,
    storeName: s.storeName,
    businessType: s.businessType,
    ownerName: s.ownerName,
    ownerEmail: s.ownerEmail,
    endDate: s.endDate,
    externalId: s.externalId,
  }))
}

export function clearSession() {
  if (typeof window === "undefined") return
  const session = getSession()
  // Clear store-specific product cache
  if (session?.externalId) {
    localStorage.removeItem(`pos_products_cache_${session.externalId}`)
  }
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem("pos_ext_id")
  localStorage.removeItem("pos_main_ext_id")
  localStorage.removeItem("storeName")
  localStorage.removeItem("pos_main_store_name")
  localStorage.removeItem("pos_branches_cache")
  localStorage.removeItem("pos_cart")
  localStorage.removeItem("pos_current_user")
  // pos_subscription intentionally kept — overwritten on next login to avoid expired flash
}

/** Build a session from a subscription API response */
export function buildSession(
  externalId: string,
  sub: any,
  branchName?: string
): PosSession {
  const endDate = sub.endDate ? new Date(sub.endDate) : null
  const isActive = sub.status === "active" && (!endDate || endDate > new Date())
  return {
    externalId,
    mainExternalId: sub.externalId ?? externalId,
    storeName: sub.storeName ?? "",
    branchName: branchName || undefined,
    isMainStore: externalId === (sub.externalId ?? externalId),
    tier: sub.tier ?? "basic",
    isActive,
    endDate: endDate?.toISOString() ?? null,
    features: sub.features ?? {},
    businessType: sub.businessType ?? null,
    ownerName: sub.ownerName ?? null,
    ownerEmail: sub.ownerEmail ?? null,
  }
}
