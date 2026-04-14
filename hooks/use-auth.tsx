"use client"

import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from "react"
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

const AuthContext = createContext<AuthState>({
  user: null, loading: true,
  login: () => {}, logout: () => {},
  isOwner: false, isSubAdmin: false, isCashier: false,
  can: () => false,
  hasFeature: () => false,
  hasPermission: () => false,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StoreUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(AUTH_KEY)
      if (stored) setUser(JSON.parse(stored))
    } catch {}
    setLoading(false)
  }, [])

  const login = useCallback((u: StoreUser) => {
    setUser(u)
    localStorage.setItem(AUTH_KEY, JSON.stringify(u))
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem(AUTH_KEY)
  }, [])

  const isOwner = user?.role === "owner"
  const isSubAdmin = user?.role === "subadmin"
  const isCashier = user?.role === "cashier"

  // owner > subadmin > cashier
  const can = useCallback((minRole: UserRole): boolean => {
    if (!user) return false
    const hierarchy: UserRole[] = ["cashier", "subadmin", "owner"]
    return hierarchy.indexOf(user.role) >= hierarchy.indexOf(minRole)
  }, [user])

  // Check if current user can access a specific feature
  // Owner: always true. Subadmin: only if in their allowedFeatures. Cashier: POS + reports (view-only).
  const hasFeature = useCallback((feature: keyof SubscriptionFeatures): boolean => {
    if (!user) return false
    if (user.role === "owner") return true
    if (user.role === "cashier") return feature === "pos" || feature === "reports"
    // subadmin — check allowedFeatures
    if (feature === "pos") return true // POS always allowed
    return user.allowedFeatures?.[feature] === true
  }, [user])

  // Check if current user can access a management page (Users / Settings)
  // Owner: always true. Subadmin: only if owner granted the permission.
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
