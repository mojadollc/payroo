"use client"

import { useState, useEffect, useCallback, useContext, createContext, type ReactNode } from "react"
import type { SubscriptionFeatures } from "@/lib/firebase/types"

export interface SubscriptionState {
  loading: boolean
  isActive: boolean
  isDeactivated: boolean
  tier: string | null
  features: SubscriptionFeatures
  storeName: string | null
  businessType: string | null
  ownerName: string | null
  ownerEmail: string | null
  endDate: Date | null
  externalId: string | null
}

const DEFAULT_FEATURES: SubscriptionFeatures = {
  pos: false,
  inventory: false,
  ewallet: false,
  reports: false,
  loyalty: false,
  utang: false,
  aiRestock: false,
  multiUser: false,
  exportData: false,
  marketIntelligence: false,
  delivery: false,
}

const LS_KEY = "pos_subscription"

function readCache(): SubscriptionState | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const endDate = parsed.endDate ? new Date(parsed.endDate) : null
    const expired = endDate ? endDate < new Date() : false
    const isActive = (parsed.isActive ?? false) && !expired
    return {
      loading: false,
      isActive,
      isDeactivated: parsed.isDeactivated ?? false,
      tier: parsed.tier ?? null,
      features: isActive ? { ...DEFAULT_FEATURES, ...(parsed.features ?? {}) } : DEFAULT_FEATURES,
      storeName: parsed.storeName ?? null,
      businessType: parsed.businessType ?? null,
      ownerName: parsed.ownerName ?? null,
      ownerEmail: parsed.ownerEmail ?? null,
      endDate,
      externalId: parsed.externalId ?? null,
    }
  } catch {
    return null
  }
}

const EMPTY_STATE: SubscriptionState = {
  loading: true, isActive: false, isDeactivated: false, tier: null,
  features: DEFAULT_FEATURES, storeName: null, businessType: null,
  ownerName: null, ownerEmail: null, endDate: null, externalId: null,
}

// ─── Shared context ────────────────────────────────────────────────────────
const SubscriptionContext = createContext<SubscriptionState | null>(null)

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const state = useSubscriptionInternal()
  return <SubscriptionContext.Provider value={state}>{children}</SubscriptionContext.Provider>
}

export function useSubscription(): SubscriptionState {
  const ctx = useContext(SubscriptionContext)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const standalone = ctx ? null : useSubscriptionInternal()
  return ctx ?? standalone!
}

function useSubscriptionInternal(): SubscriptionState {
  const [state, setState] = useState<SubscriptionState>(() => {
    if (typeof window === "undefined") return EMPTY_STATE
    return readCache() ?? EMPTY_STATE
  })

  const refresh = useCallback(async () => {
    const externalId = typeof window !== "undefined" ? localStorage.getItem("pos_ext_id") : null
    if (!externalId) { setState(s => ({ ...s, loading: false })); return }

    try {
      const mainId = localStorage.getItem("pos_main_ext_id") || ""
      const params = new URLSearchParams({ externalId })
      if (mainId && mainId !== externalId) params.set("mainId", mainId)

      const res = await fetch(`/api/subscription?${params}`)
      if (!res.ok) { setState(s => ({ ...s, loading: false })); return }

      const { data } = await res.json()
      if (!data) { setState(s => ({ ...s, loading: false })); return }

      const endDate = data.endDate ? new Date(data.endDate) : null
      const expired = endDate ? endDate < new Date() : false
      const active = data.status === "active" && !expired

      const displayName = localStorage.getItem("storeName") || data.storeName || null

      const newState: SubscriptionState = {
        loading: false,
        isActive: active,
        isDeactivated: false,
        tier: data.tier ?? null,
        features: active ? { ...DEFAULT_FEATURES, ...(data.features ?? {}) } : DEFAULT_FEATURES,
        storeName: displayName,
        businessType: data.businessType ?? null,
        ownerName: data.ownerName ?? null,
        ownerEmail: data.ownerEmail ?? null,
        endDate,
        externalId,
      }

      setState(prev => {
        const key = (s: SubscriptionState) => JSON.stringify({ isActive: s.isActive, tier: s.tier, features: s.features, storeName: s.storeName, endDate: s.endDate?.toISOString() ?? null, externalId: s.externalId })
        if (!prev.loading && key(prev) === key(newState)) return prev
        return newState
      })

      try { localStorage.setItem(LS_KEY, JSON.stringify({ ...newState, endDate: endDate?.toISOString() ?? null })) } catch { /* quota */ }
    } catch (err) {
      console.error("useSubscription error:", err)
      setState(s => ({ ...s, loading: false }))
    }
  }, [])

  useEffect(() => {
    refresh()
    const onVisible = () => { if (document.visibilityState === "visible") refresh() }
    document.addEventListener("visibilitychange", onVisible)
    const interval = setInterval(refresh, 5 * 60 * 1000)
    return () => { document.removeEventListener("visibilitychange", onVisible); clearInterval(interval) }
  }, [refresh])

  return state
}
