"use client"

import { useEffect, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useSubscription } from "@/hooks/use-subscription"
import type { SubscriptionFeatures } from "@/lib/firebase/types"

// ─── Route configuration ──────────────────────────────────────────────────────
// Add new protected routes here — this is the ONLY place you need to update
// when adding new pages to the system.

const PUBLIC_ROUTES = ["/", "/subscription", "/login", "/dashboard", "/payment/success", "/payment/failed", "/affiliate"]
const SUPERADMIN_ROUTES = ["/management", "/setup"]

// Prefix-based public routes (customer-facing delivery pages)
const PUBLIC_PREFIXES = ["/delivery"]

// Maps route → required subscription feature.
// Owner role bypasses ALL feature checks — only subadmin/cashier are gated.
const ROUTE_FEATURE_MAP: Record<string, keyof SubscriptionFeatures> = {
  "/inventory":          "inventory",
  "/ewallet":            "ewallet",
  "/ewallet/load":       "ewallet",
  "/ewallet/cashin":     "ewallet",
  "/reports":            "reports",
  "/loyalty":            "loyalty",
  "/utang":              "utang",
  "/restock":            "aiRestock",
  "/market-intelligence":"marketIntelligence",
  "/delivery-manage":    "delivery",
  "/users":              "multiUser",
}

// Routes only the owner or subadmin with explicit permission can access
const PERMISSION_MAP: Record<string, "manageUsers" | "manageSettings"> = {
  "/users":    "manageUsers",
  "/settings": "manageSettings",
}

// Routes cashiers are allowed (everything else redirects to /pos)
const CASHIER_ALLOWED = new Set(["/pos", "/reports"])

// ─── Guard ────────────────────────────────────────────────────────────────────

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, loading: authLoading, hasPermission } = useAuth()
  const { isActive, isDeactivated, features, loading: subLoading } = useSubscription()

  const isPublic = PUBLIC_ROUTES.includes(pathname) || PUBLIC_PREFIXES.some(p => pathname.startsWith(p))
  const isSuperadmin = SUPERADMIN_ROUTES.includes(pathname)

  // Track which path has already been validated so background Firestore
  // refreshes never re-trigger a redirect while the user is on a page.
  const validatedPath = useRef<string | null>(null)
  // Track the previous pathname so we can detect real navigation
  const prevPathname = useRef<string>(pathname)

  useEffect(() => {
    // Clear validation only on actual navigation to a new route
    if (prevPathname.current !== pathname) {
      validatedPath.current = null
      prevPathname.current = pathname
    }

    // Public and superadmin pages — no checks needed
    if (isPublic || isSuperadmin) return

    // Wait for auth to finish loading
    if (authLoading) return

    // Not logged in → send to login
    if (!user) {
      router.replace("/login")
      return
    }

    // Already validated this exact path — don't re-run on background refreshes
    if (validatedPath.current === pathname) return

    // Owner: skip ALL subscription/feature checks entirely.
    // Owners always have full access regardless of subscription state.
    if (user.role === "owner") {
      validatedPath.current = pathname
      return
    }

    // For non-owners, wait for subscription to finish loading too
    if (subLoading) return

    // ── Cashier: only allowed on specific routes ──────────────────────────
    if (user.role === "cashier" && !CASHIER_ALLOWED.has(pathname)) {
      router.replace("/pos")
      return
    }

    // ── Subscription inactive → only /pos is allowed ──────────────────────
    // Owner can still open Settings / Users to manage the account
    const ownerBypassRoutes = new Set(["/settings", "/users", "/subscription"])
    if (!isActive && pathname !== "/pos" && !(user.role === "owner" && ownerBypassRoutes.has(pathname))) {
      router.replace("/pos")
      return
    }

    // ── Feature gate (subadmin / cashier only — owner always allowed) ─────
    const requiredFeature = ROUTE_FEATURE_MAP[pathname]
    if (requiredFeature && user.role !== "owner" && !features[requiredFeature]) {
      router.replace("/pos")
      return
    }

    // ── Management permission gates (subadmin only — owner always allowed) ─
    const requiredPermission = PERMISSION_MAP[pathname]
    if (requiredPermission && user.role !== "owner" && !hasPermission(requiredPermission)) {
      router.replace("/pos")
      return
    }

    // All checks passed — mark validated so background refreshes don't re-run
    validatedPath.current = pathname
  }, [authLoading, subLoading, user, pathname, isActive, features, hasPermission, isPublic, isSuperadmin])

  const loadingUI = (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <img src="/icon-192.png" alt="Payroo" className="h-16 w-16 animate-pulse" />
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )

  // Show branded loader during initial auth load on protected routes
  if (!isPublic && !isSuperadmin && authLoading) {
    return loadingUI
  }

  // Block render while redirecting unauthenticated users
  if (!isPublic && !isSuperadmin && !authLoading && !user) {
    return loadingUI
  }

  return <>{children}</>
}
