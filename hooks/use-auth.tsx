"use client"

import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import type { StoreUser, UserRole, SubscriptionFeatures, SubadminPermissions } from "@/lib/firebase/types"

interface AuthState {
  user: StoreUser | null
  loading: boolean
  login: (user: StoreUser) => void
  logout: () => void
  isOwner: boolean
  isSubAdmin: boolean
  isCashier: boolean
  can: (role: UserRole) => boolean
  hasFeature: (feature: keyof SubscriptionFeatures) => boolean
  hasPermission: (perm: keyof SubadminPermissions) => boolean
}

const AUTH_KEY = "pos_current_user"
const AUTH_TS_KEY = "pos_auth_ts"

const AuthContext = createContext<AuthState>({
  user: null, loading: true,
  login: () => {}, logout: () => {},
  isOwner: false, isSubAdmin: false, isCashier: false,
  can: () => false,
  hasFeature: () => false,
  hasPermission: () => false,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<StoreUser | null>(() => {
    if (typeof window === "undefined") return null
    try {
      const stored = localStorage.getItem(AUTH_KEY)
      return stored ? JSON.parse(stored) : null
    } catch { return null }
  })
  const [loading] = useState(false)

  const login = useCallback((u: StoreUser) => {
    setUser(u)
    localStorage.setItem(AUTH_KEY, JSON.stringify(u))
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem(AUTH_KEY)
    localStorage.removeItem(AUTH_TS_KEY)
  }, [])

  // Poll /api/auth/verify every 30s and on visibilitychange.
  // If updatedAt changed (PIN was reset) or user is deactivated → force logout.
  useEffect(() => {
    if (!user?.id) return

    const check = async () => {
      try {
        const res = await fetch(`/api/auth/verify?id=${user.id}`, { cache: "no-store" })
        if (!res.ok) return
        const { valid, ts } = await res.json()
        if (!valid) {
          logout()
          router.replace("/login")
          return
        }
        const storedTs = localStorage.getItem(AUTH_TS_KEY)
        if (storedTs && ts && String(ts) !== storedTs) {
          // PIN or account was changed — invalidate this session
          logout()
          router.replace("/login")
        }
      } catch { /* network error — stay logged in */ }
    }

    check()
    const interval = setInterval(check, 30_000)
    const onVisible = () => { if (document.visibilityState === "visible") check() }
    document.addEventListener("visibilitychange", onVisible)
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVisible) }
  }, [user?.id, logout, router])

  useEffect(() => {}, [])

  const isOwner = user?.role === "owner"
  const isSubAdmin = user?.role === "subadmin"
  const isCashier = user?.role === "cashier"

  const can = useCallback((minRole: UserRole): boolean => {
    if (!user) return false
    const hierarchy: UserRole[] = ["cashier", "subadmin", "owner"]
    return hierarchy.indexOf(user.role) >= hierarchy.indexOf(minRole)
  }, [user])

  const hasFeature = useCallback((feature: keyof SubscriptionFeatures): boolean => {
    if (!user) return false
    if (user.role === "owner") return true
    if (user.role === "cashier") return feature === "pos" || feature === "reports"
    if (feature === "pos") return true
    return user.allowedFeatures?.[feature] === true
  }, [user])

  const hasPermission = useCallback((perm: keyof SubadminPermissions): boolean => {
    if (!user) return false
    if (user.role === "owner") return true
    if (user.role === "subadmin") return user.permissions?.[perm] === true
    return false
  }, [user])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isOwner, isSubAdmin, isCashier, can, hasFeature, hasPermission }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
