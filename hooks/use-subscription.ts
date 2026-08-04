"use client"

import { useState, useEffect, useCallback } from "react"
import { getFirebaseDb } from "@/lib/firebase/config"
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore"
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
    const cachedFeatures = parsed.features ?? {}
    return {
      loading: false,
      isActive,
      isDeactivated: parsed.isDeactivated ?? false,
      tier: parsed.tier ?? null,
      features: isActive ? { ...DEFAULT_FEATURES, ...cachedFeatures } : DEFAULT_FEATURES,
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

async function fetchSubByExternalId(db: any, externalId: string) {
  try {
    const snap = await getDocs(
      query(
        collection(db, "customerSubscriptions"),
        where("externalId", "==", externalId),
        orderBy("createdAt", "desc"),
        limit(1)
      )
    )
    if (!snap.empty) return snap.docs[0].data()
  } catch {
    // index may be missing — try without orderBy
    const snap = await getDocs(
      query(
        collection(db, "customerSubscriptions"),
        where("externalId", "==", externalId),
        limit(1)
      )
    )
    if (!snap.empty) return snap.docs[0].data()
  }
  return null
}

export function useSubscription(): SubscriptionState & { refresh: () => Promise<void> } {
  const [state, setState] = useState<SubscriptionState>(() => {
    if (typeof window === "undefined") {
      return { loading: true, isActive: false, isDeactivated: false, tier: null, features: DEFAULT_FEATURES, storeName: null, businessType: null, ownerName: null, ownerEmail: null, endDate: null, externalId: null }
    }
    const cached = readCache()
    if (cached) return cached
    return { loading: true, isActive: false, isDeactivated: false, tier: null, features: DEFAULT_FEATURES, storeName: null, businessType: null, ownerName: null, ownerEmail: null, endDate: null, externalId: null }
  })

  const refresh = useCallback(async () => {
    const externalId = localStorage.getItem("pos_ext_id")
    if (!externalId) {
      setState(s => ({ ...s, loading: false }))
      return
    }

    try {
      const db = getFirebaseDb()
      if (!db) { setState(s => ({ ...s, loading: false })); return }

      let data = await fetchSubByExternalId(db, externalId)

      // Branch with missing/inactive sub → inherit plan from main HQ
      const mainId = localStorage.getItem("pos_main_ext_id") || ""
      let inherited = false
      if ((!data || data.status !== "active") && mainId && mainId !== externalId) {
        const mainData = await fetchSubByExternalId(db, mainId)
        if (mainData && mainData.status === "active") {
          data = {
            ...mainData,
            storeName: data?.storeName || localStorage.getItem("storeName") || mainData.storeName,
            externalId,
            parentExternalId: mainId,
          }
          inherited = true
        }
      }

      if (!data) {
        // Keep previous active cache if any — don't lock user out of Settings
        setState(s => ({ ...s, loading: false }))
        return
      }

      const isPaid = data.status === "active"
      const endDate = data.endDate?.toDate?.() ?? (data.endDate ? new Date(data.endDate) : null)
      const expired = endDate ? endDate < new Date() : false
      const active = isPaid && !expired

      const storedFeatures = data.features ?? {}
      const freshFeatures: SubscriptionFeatures = active
        ? { ...DEFAULT_FEATURES, ...storedFeatures }
        : DEFAULT_FEATURES

      // Prefer branch display name from localStorage / branch cache
      let displayName = data.storeName ?? null
      if (!inherited) {
        displayName = data.storeName ?? localStorage.getItem("storeName")
      } else {
        displayName = localStorage.getItem("storeName") || data.storeName
      }

      const newState: SubscriptionState = {
        loading: false,
        isActive: active,
        isDeactivated: false,
        tier: data.tier ?? null,
        features: freshFeatures,
        storeName: displayName,
        businessType: data.businessType ?? null,
        ownerName: data.ownerName ?? null,
        ownerEmail: data.ownerEmail ?? null,
        endDate,
        externalId,
      }

      setState(prev => {
        if (prev.loading) return newState
        const prevKey = JSON.stringify({ isActive: prev.isActive, tier: prev.tier, features: prev.features, storeName: prev.storeName, endDate: prev.endDate?.toISOString() })
        const nextKey = JSON.stringify({ isActive: newState.isActive, tier: newState.tier, features: newState.features, storeName: newState.storeName, endDate: endDate?.toISOString() })
        if (prevKey === nextKey) return prev
        return newState
      })

      localStorage.setItem(LS_KEY, JSON.stringify({ ...newState, endDate: endDate?.toISOString() ?? null }))

      if (active) {
        window.dispatchEvent(new Event("subscription-refreshed"))
      }
    } catch (err) {
      console.error("useSubscription error:", err)
      setState(s => ({ ...s, loading: false }))
    }
  }, [])

  useEffect(() => {
    refresh()
    const onVisible = () => { if (document.visibilityState === "visible") refresh() }
    document.addEventListener("visibilitychange", onVisible)
    const onBranch = () => { refresh() }
    window.addEventListener("subscription-refreshed", onBranch)
    const interval = setInterval(refresh, 5 * 60 * 1000)
    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("subscription-refreshed", onBranch)
      clearInterval(interval)
    }
  }, [refresh])

  return { ...state, refresh }
}
