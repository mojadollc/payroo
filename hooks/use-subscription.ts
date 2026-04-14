"use client"

import { useState, useEffect, useCallback } from "react"
import { getFirebaseDb } from "@/lib/firebase/config"
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore"
import type { SubscriptionFeatures } from "@/lib/firebase/types"

export interface SubscriptionState {
  loading: boolean
  isActive: boolean
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
}

const LS_KEY = "pos_subscription"

function readCache(): SubscriptionState | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const endDate = parsed.endDate ? new Date(parsed.endDate) : null
    // Re-evaluate expiry against current time — cache may be stale
    const expired = endDate ? endDate < new Date() : false
    const isActive = (parsed.isActive ?? false) && !expired
    return {
      ...parsed,
      loading: false,
      isActive,
      features: isActive ? { ...DEFAULT_FEATURES, ...(parsed.features ?? {}) } : DEFAULT_FEATURES,
      endDate,
    }
  } catch {
    return null
  }
}

export function useSubscription(): SubscriptionState {
  const [state, setState] = useState<SubscriptionState>(() => {
    if (typeof window === "undefined") {
      return { loading: true, isActive: false, tier: null, features: DEFAULT_FEATURES, storeName: null, businessType: null, ownerName: null, ownerEmail: null, endDate: null, externalId: null }
    }
    // If cache exists, use it immediately — no loading spinner, no blocking
    const cached = readCache()
    if (cached) return cached
    // No cache — show loading until Firestore responds
    return { loading: true, isActive: false, tier: null, features: DEFAULT_FEATURES, storeName: null, businessType: null, ownerName: null, ownerEmail: null, endDate: null, externalId: null }
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

      const snap = await getDocs(
        query(
          collection(db, "customerSubscriptions"),
          where("externalId", "==", externalId),
          orderBy("createdAt", "desc"),
          limit(1)
        )
      )

      if (snap.empty) {
        setState(s => ({ ...s, loading: false }))
        return
      }

      const data = snap.docs[0].data()
      const isPaid = data.status === "active"
      const endDate = data.endDate?.toDate?.() ?? null
      const expired = endDate ? endDate < new Date() : false
      const active = isPaid && !expired

      const freshFeatures: SubscriptionFeatures = active
        ? { ...DEFAULT_FEATURES, ...(data.features ?? {}) }
        : DEFAULT_FEATURES

      const newState: SubscriptionState = {
        loading: false,
        isActive: active,
        tier: data.tier ?? null,
        features: freshFeatures,
        storeName: data.storeName ?? null,
        businessType: data.businessType ?? null,
        ownerName: data.ownerName ?? null,
        ownerEmail: data.ownerEmail ?? null,
        endDate,
        externalId,
      }

      // Only update state if something actually changed to avoid re-render loops
      setState(prev => {
        const prevKey = JSON.stringify({ isActive: prev.isActive, tier: prev.tier, features: prev.features, storeName: prev.storeName, endDate: prev.endDate?.toISOString() })
        const nextKey = JSON.stringify({ isActive: newState.isActive, tier: newState.tier, features: newState.features, storeName: newState.storeName, endDate: endDate?.toISOString() })
        if (prevKey === nextKey && !prev.loading) return prev  // no change — return same ref, no re-render
        return newState
      })

      // Persist fresh data to localStorage
      localStorage.setItem(LS_KEY, JSON.stringify({ ...newState, endDate: endDate?.toISOString() ?? null }))

      if (active) {
        // NOTE: deliberately NOT writing storeName/businessType to localStorage here.
        // storeSettings (Firestore) is the single source of truth for those values.
        // Writing them here would overwrite changes the store owner made in Settings.
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
    // Refresh every 5 minutes so expiry is detected without requiring tab focus
    const interval = setInterval(refresh, 5 * 60 * 1000)
    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      clearInterval(interval)
    }
  }, [refresh])

  return state
}
