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

async function fetchSubDoc(db: any, externalId: string): Promise<any | null> {
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
    try {
      const snap = await getDocs(
        query(
          collection(db, "customerSubscriptions"),
          where("externalId", "==", externalId),
          limit(1)
        )
      )
      if (!snap.empty) return snap.docs[0].data()
    } catch {
      return null
    }
  }
  return null
}

export function useSubscription() {
  const [state, setState] = useState<SubscriptionState>(() => {
    if (typeof window === "undefined") {
      return {
        loading: true,
        isActive: false,
        isDeactivated: false,
        tier: null,
        features: DEFAULT_FEATURES,
        storeName: null,
        businessType: null,
        ownerName: null,
        ownerEmail: null,
        endDate: null,
        externalId: null,
      }
    }
    const cached = readCache()
    if (cached) return cached
    return {
      loading: true,
      isActive: false,
      isDeactivated: false,
      tier: null,
      features: DEFAULT_FEATURES,
      storeName: null,
      businessType: null,
      ownerName: null,
      ownerEmail: null,
      endDate: null,
      externalId: null,
    }
  })

  const refresh = useCallback(async () => {
    const externalId = typeof window !== "undefined" ? localStorage.getItem("pos_ext_id") : null
    if (!externalId) {
      setState(s => ({ ...s, loading: false }))
      return
    }

    try {
      const db = getFirebaseDb()
      if (!db) {
        setState(s => ({ ...s, loading: false }))
        return
      }

      let data = await fetchSubDoc(db, externalId)

      // If this is a branch and sub is missing/inactive, inherit HQ plan
      const mainId =
        (typeof window !== "undefined" && localStorage.getItem("pos_main_ext_id")) || ""
      if ((!data || data.status !== "active") && mainId && mainId !== externalId) {
        const mainData = await fetchSubDoc(db, mainId)
        if (mainData && mainData.status === "active") {
          data = {
            ...mainData,
            // keep branch display name if we have one
            storeName:
              (typeof window !== "undefined" && localStorage.getItem("storeName")) ||
              data?.storeName ||
              mainData.storeName,
          }
        }
      }

      if (!data) {
        // Do not wipe an existing active cache — keeps menus usable
        setState(s => ({ ...s, loading: false }))
        return
      }

      const isPaid = data.status === "active"
      const endDate = data.endDate?.toDate?.() ?? null
      const expired = endDate ? endDate < new Date() : false
      const active = isPaid && !expired

      const storedFeatures = data.features ?? {}
      const freshFeatures: SubscriptionFeatures = active
        ? { ...DEFAULT_FEATURES, ...storedFeatures }
        : DEFAULT_FEATURES

      const displayName =
        (typeof window !== "undefined" && localStorage.getItem("storeName")) ||
        data.storeName ||
        null

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
        const prevKey = JSON.stringify({
          isActive: prev.isActive,
          tier: prev.tier,
          features: prev.features,
          storeName: prev.storeName,
          endDate: prev.endDate?.toISOString?.() ?? null,
          externalId: prev.externalId,
        })
        const nextKey = JSON.stringify({
          isActive: newState.isActive,
          tier: newState.tier,
          features: newState.features,
          storeName: newState.storeName,
          endDate: endDate?.toISOString?.() ?? null,
          externalId: newState.externalId,
        })
        if (prevKey === nextKey) return prev
        return newState
      })

      try {
        localStorage.setItem(
          LS_KEY,
          JSON.stringify({ ...newState, endDate: endDate?.toISOString() ?? null })
        )
      } catch { /* quota */ }

      // NOTE: deliberately do NOT dispatch subscription-refreshed here.
      // Navbar listens to that event; dispatching from refresh caused an infinite loop
      // and froze all menu clicks.
    } catch (err) {
      console.error("useSubscription error:", err)
      setState(s => ({ ...s, loading: false }))
    }
  }, [])

  useEffect(() => {
    refresh()
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh()
    }
    document.addEventListener("visibilitychange", onVisible)
    const interval = setInterval(refresh, 5 * 60 * 1000)
    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      clearInterval(interval)
    }
  }, [refresh])

  return state
}
