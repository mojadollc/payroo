"use client"

import Link from "next/link"
import { Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSubscription } from "@/hooks/use-subscription"
import { useAuth } from "@/hooks/use-auth"
import type { SubscriptionFeatures } from "@/lib/firebase/types"

interface FeatureGateProps {
  feature: keyof SubscriptionFeatures
  children: React.ReactNode
}

export function FeatureGate({ feature, children }: FeatureGateProps) {
  const { loading, isActive, features } = useSubscription()
  const { hasFeature, loading: authLoading } = useAuth()

  if (loading || authLoading) return null

  // Check subscription plan AND user-level feature access (subadmin restrictions)
  if (!isActive || !features[feature] || !hasFeature(feature)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold">Feature Locked</h2>
          <p className="text-muted-foreground text-sm">
            {!isActive
              ? "You don't have an active subscription. Subscribe to unlock this feature."
              : "This feature is not included in your current plan. Upgrade to access it."}
          </p>
          <Link href="/subscription">
            <Button className="w-full">
              {!isActive ? "Subscribe Now" : "Upgrade Plan"}
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
