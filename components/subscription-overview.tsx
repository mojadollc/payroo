"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Store, Users, Package, TrendingUp, Smartphone, Star, Brain, Globe,
  Check, X, Calendar, AlertCircle, LogOut, Settings, CreditCard, ArrowRight
} from "lucide-react"
import { useSubscription } from "@/hooks/use-subscription"
import { useAuth } from "@/hooks/use-auth"

const FEATURE_ICONS: Record<string, React.ReactNode> = {
  pos: <Store className="h-4 w-4" />,
  inventory: <Package className="h-4 w-4" />,
  ewallet: <Smartphone className="h-4 w-4" />,
  reports: <TrendingUp className="h-4 w-4" />,
  loyalty: <Star className="h-4 w-4" />,
  utang: <AlertCircle className="h-4 w-4" />,
  aiRestock: <Brain className="h-4 w-4" />,
  multiUser: <Users className="h-4 w-4" />,
  exportData: <CreditCard className="h-4 w-4" />,
  marketIntelligence: <Globe className="h-4 w-4" />,
}

const FEATURE_LABELS: Record<string, string> = {
  pos: "POS System",
  inventory: "Inventory Management",
  ewallet: "E-Wallet (GCash/Maya)",
  reports: "Sales & Profit Reports",
  loyalty: "Loyalty Program",
  utang: "Utang / Credit Tracking",
  aiRestock: "AI Restock Suggestions",
  multiUser: "Multi-User Access",
  exportData: "Export Data",
  marketIntelligence: "Market Intelligence",
}

export function SubscriptionOverview() {
  const router = useRouter()
  const { logout } = useAuth()
  const { storeName, ownerName, tier, endDate, isActive, features } = useSubscription()
  const [daysLeft, setDaysLeft] = useState<number | null>(null)

  useEffect(() => {
    if (endDate) {
      const now = new Date()
      const diff = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      setDaysLeft(diff)
    }
  }, [endDate])

  const handleLogout = () => {
    logout()
    router.push("/")
  }

  const tierColors: Record<string, string> = {
    basic: "bg-slate-100 text-slate-700",
    gold: "bg-yellow-100 text-yellow-700",
    enterprise: "bg-purple-100 text-purple-700",
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">{storeName}</CardTitle>
              <CardDescription className="mt-1">Welcome back, {ownerName}</CardDescription>
            </div>
            <Badge className={tierColors[tier || "basic"]}>
              {tier?.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Subscription Status</p>
              <p className="text-sm font-semibold mt-1">
                {isActive ? (
                  <span className="text-green-600">✓ Active</span>
                ) : (
                  <span className="text-red-600">✗ Inactive</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Expires</p>
              <p className="text-sm font-semibold mt-1">
                {endDate ? endDate.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Days Left</p>
              <p className={`text-sm font-semibold mt-1 ${daysLeft && daysLeft <= 7 ? "text-orange-600" : "text-foreground"}`}>
                {daysLeft !== null ? `${daysLeft} days` : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Plan Tier</p>
              <p className="text-sm font-semibold mt-1 capitalize">{tier}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expiration Warning */}
      {daysLeft !== null && daysLeft <= 7 && isActive && (
        <Alert className="bg-orange-50 border-orange-200">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            Your subscription expires in {daysLeft} days. <Link href="/subscription" className="underline font-medium">Renew now →</Link>
          </AlertDescription>
        </Alert>
      )}

      {!isActive && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Your subscription is inactive. <Link href="/subscription" className="underline font-medium">Reactivate →</Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Features Grid */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Your Features</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-3">
          {Object.entries(FEATURE_LABELS).map(([key, label]) => {
            const enabled = features[key as keyof typeof features]
            return (
              <Card key={key} className={enabled ? "" : "opacity-50"}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className={`p-2 rounded-lg ${enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {FEATURE_ICONS[key]}
                    </div>
                    {enabled ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-xs font-medium">{label}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid md:grid-cols-3 gap-3">
          <Link href="/">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardContent className="p-4">
                <Store className="h-6 w-6 text-primary mb-2" />
                <p className="font-medium text-sm">Go to POS</p>
                <p className="text-xs text-muted-foreground mt-1">Start processing sales</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/users">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardContent className="p-4">
                <Users className="h-6 w-6 text-primary mb-2" />
                <p className="font-medium text-sm">Manage Staff</p>
                <p className="text-xs text-muted-foreground mt-1">Add cashiers & admins</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/settings">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardContent className="p-4">
                <Settings className="h-6 w-6 text-primary mb-2" />
                <p className="font-medium text-sm">Settings</p>
                <p className="text-xs text-muted-foreground mt-1">Configure your store</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* Upgrade CTA */}
      {tier === "basic" && (
        <Card className="bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" /> Upgrade to Gold
            </CardTitle>
            <CardDescription>Unlock e-wallet, loyalty, AI restock, and more</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/subscription">
              <Button className="gap-2">
                View Gold Plan <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Logout */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={handleLogout} className="gap-2">
          <LogOut className="h-4 w-4" /> Logout
        </Button>
      </div>
    </div>
  )
}
