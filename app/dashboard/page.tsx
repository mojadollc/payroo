"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2, LogIn, ArrowRight, Eye, EyeOff, Mail, Lock, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { getFirebaseDb } from "@/lib/firebase/config"
import { collection, query, where, getDocs } from "firebase/firestore"
import { HomeNavbar } from "@/components/home-navbar"
import { PWAInstallPrompt } from "@/components/pwa-install-prompt"
import type { StoreUser } from "@/lib/firebase/types"

export default function DashboardPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { login } = useAuth()

  const [email, setEmail] = useState("")
  const [pin, setPin] = useState("")
  const [showPin, setShowPin] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [resettingPin, setResettingPin] = useState(false)

  const handleForgotPin = async () => {
    if (!email.trim()) {
      toast({ title: "Enter your email first", variant: "destructive" })
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      toast({ title: "Please enter a valid email", variant: "destructive" })
      return
    }

    setResettingPin(true)
    try {
      const res = await fetch("/api/reset-owner-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ 
        title: "Temporary PIN sent!", 
        description: `Check ${email} for your temporary PIN. Valid for 1 hour.` 
      })
    } catch (err: any) {
      toast({ title: "Failed to send reset email", description: err.message, variant: "destructive" })
    } finally {
      setResettingPin(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!email.trim() || !pin.trim()) {
      setError("Please fill in all fields")
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address")
      return
    }

    setLoading(true)
    try {
      const db = getFirebaseDb()
      if (!db) throw new Error("Firebase not configured")

      // 1. Find subscription by email
      const subSnap = await getDocs(
        query(
          collection(db, "customerSubscriptions"),
          where("ownerEmail", "==", email.toLowerCase().trim())
        )
      )

      if (subSnap.empty) {
        setError("Email not found. Please check and try again.")
        setLoading(false)
        return
      }

      const subscription = subSnap.docs[0].data()

      // 2. Check subscription status
      if (subscription.status === "pending") {
        setError("Your payment is still being processed. Please wait a few minutes and try again, or check your email for confirmation.")
        setLoading(false)
        return
      }
      if (subscription.status !== "active") {
        setError(`Your subscription is ${subscription.status}. Please renew or contact support.`)
        setLoading(false)
        return
      }

      const endDate = subscription.endDate?.toDate?.()
      if (endDate && endDate < new Date()) {
        setError("Your subscription has expired. Please renew to continue.")
        setLoading(false)
        return
      }

      const externalId = subscription.externalId
      if (!externalId) {
        setError("Store ID not found for this subscription. Contact support.")
        setLoading(false)
        return
      }

      // 3. Find the owner user account and verify PIN
      const userSnap = await getDocs(
        query(
          collection(db, "storeUsers"),
          where("externalId", "==", externalId),
          where("role", "==", "owner"),
          where("pin", "==", pin.trim()),
          where("isActive", "==", true)
        )
      )

      if (userSnap.empty) {
        setError("Incorrect PIN. Please try again.")
        setLoading(false)
        return
      }

      const ownerUser = { id: userSnap.docs[0].id, ...userSnap.docs[0].data() } as StoreUser

      // 4. Log in as the owner — set all localStorage keys BEFORE navigating
      localStorage.setItem("pos_ext_id", externalId)

      // Pre-cache subscription so AuthGuard + navbar see features immediately
      const endDateObj = subscription.endDate?.toDate?.() ?? null
      const fullFeatures = {
        pos: false, inventory: false, ewallet: false, reports: false,
        loyalty: false, utang: false, aiRestock: false, multiUser: false,
        exportData: false, marketIntelligence: false,
        ...(subscription.features ?? {}),
      }
      const subCache = {
        loading: false,
        isActive: true,
        tier: subscription.tier ?? "basic",
        features: fullFeatures,
        storeName: subscription.storeName ?? null,
        businessType: subscription.businessType ?? null,
        ownerName: subscription.ownerName ?? null,
        ownerEmail: subscription.ownerEmail ?? null,
        endDate: endDateObj?.toISOString() ?? null,
        externalId,
      }
      localStorage.setItem("pos_subscription", JSON.stringify(subCache))
      if (subscription.storeName) localStorage.setItem("storeName", subscription.storeName)

      login(ownerUser)

      toast({ title: `Welcome, ${subscription.ownerName}!`, description: `${subscription.storeName} — ${subscription.tier} plan` })
      router.push("/pos")
    } catch (err: any) {
      setError(err.message || "Login failed. Please try again.")
      console.error("Dashboard login error:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <PWAInstallPrompt />
      <HomeNavbar />

      <div className="pt-32 pb-20 px-4 flex items-center justify-center">
        <div className="w-full max-w-md space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <Link href="/" className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl hover:opacity-80 transition-opacity">
              <img src="/logo.svg" alt="PayrooPOS" className="h-14 w-14 rounded-2xl" />
            </Link>
            <h1 className="text-3xl font-bold">Store Owner Login</h1>
            <p className="text-muted-foreground">Manage your store — inventory, reports, users & more</p>
          </div>

          {/* Info Alert */}
          <Alert className="bg-blue-50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800 text-sm">
              For cashiers/staff, use <Link href="/login" className="underline font-medium">Staff Login →</Link>
            </AlertDescription>
          </Alert>

          {/* Login Card */}
          <Card>
            <CardHeader>
              <CardTitle>Sign In</CardTitle>
              <CardDescription>Enter your subscription email and owner PIN</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                {/* Email */}
                <div className="space-y-1">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="owner@email.com"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setError("") }}
                      disabled={loading}
                      className="pl-10"
                      autoComplete="email"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">The email used when you subscribed</p>
                </div>

                {/* PIN */}
                <div className="space-y-1">
                  <Label htmlFor="pin">Owner PIN (6 digits)</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="pin"
                      type={showPin ? "text" : "password"}
                      placeholder="Enter your 6-digit PIN"
                      value={pin}
                      onChange={e => { setPin(e.target.value.replace(/\D/g, "").slice(0, 6)); setError("") }}
                      disabled={loading}
                      className="pl-10 pr-10"
                      autoComplete="current-password"
                      maxLength={6}
                      inputMode="numeric"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPin(v => !v)}
                      tabIndex={-1}
                    >
                      {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">Check your welcome email for your PIN</p>
                </div>

                {/* Error */}
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* Submit */}
                <Button type="submit" className="w-full gap-2" disabled={loading}>
                  {loading
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in...</>
                    : <><LogIn className="h-4 w-4" /> Sign In</>
                  }
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleForgotPin}
                    className="text-xs text-primary hover:underline"
                    disabled={loading || resettingPin}
                  >
                    {resettingPin ? "Sending..." : "Forgot your PIN?"}
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          {/* CTA */}
          <div className="space-y-3">
            <div className="text-center text-sm">
              <p className="text-muted-foreground mb-2">Don't have a subscription yet?</p>
              <Link href="/subscription">
                <Button variant="outline" className="w-full gap-2">
                  View Plans <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="text-center text-sm">
              <p className="text-muted-foreground mb-2">Are you a cashier or staff?</p>
              <Link href="/login">
                <Button variant="ghost" className="w-full gap-2">
                  Staff Login <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Support */}
          <div className="text-center text-xs text-muted-foreground">
            <p>Need help? <a href="mailto:support@payroo.xyz" className="text-primary underline underline-offset-2">Contact support</a></p>
          </div>
        </div>
      </div>
    </div>
  )
}
