"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Eye, EyeOff, Loader2, ArrowLeft, ShieldCheck, Store } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { buildSession, setSession, clearSession } from "@/lib/pos-session"

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { login } = useAuth()

  const [storeId, setStoreId] = useState("")
  const [pin, setPin] = useState("")
  const [showPin, setShowPin] = useState(false)
  const [loading, setLoading] = useState(false)
  const [focusedField, setFocusedField] = useState<"storeId" | "pin" | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!storeId.trim() || !pin.trim()) {
      toast({ title: "Please enter Store ID and PIN", variant: "destructive" })
      return
    }
    if (storeId.length < 4 || storeId.length > 6) {
      toast({ title: "Store ID must be 4–6 digits", variant: "destructive" })
      return
    }
    if (pin.length !== 6) {
      toast({ title: "PIN must be 6 digits", variant: "destructive" })
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/auth/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: storeId.trim(), pin: pin.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: "Invalid credentials", description: data.error || "Check your Store ID and PIN.", variant: "destructive" })
        return
      }

      const { user } = data
      clearSession()

      try {
        const subRes = await fetch(`/api/subscription?externalId=${storeId.trim()}`)
        const subJson = await subRes.json()
        if (subJson.data) {
          setSession(buildSession(storeId.trim(), subJson.data))
        } else {
          localStorage.setItem("pos_ext_id", storeId.trim())
          localStorage.setItem("pos_main_ext_id", storeId.trim())
        }
      } catch {
        localStorage.setItem("pos_ext_id", storeId.trim())
        localStorage.setItem("pos_main_ext_id", storeId.trim())
      }

      login(user)
      toast({ title: `Welcome back, ${user.name}!`, description: `Signed in as ${user.role}` })
      router.push("/home")
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  // PIN dot indicators
  const PinDots = () => (
    <div className="flex items-center justify-center gap-2 py-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all duration-150 ${
            i < pin.length
              ? "h-3 w-3 bg-primary shadow-sm"
              : focusedField === "pin"
              ? "h-2.5 w-2.5 bg-muted-foreground/30 border border-muted-foreground/40"
              : "h-2.5 w-2.5 bg-muted-foreground/20"
          }`}
        />
      ))}
    </div>
  )

  return (
    <div className="min-h-screen flex bg-background">

      {/* ── Left branding panel (desktop only) ── */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[40%] flex-col items-center justify-center relative overflow-hidden bg-gradient-to-br from-yellow-400 via-amber-400 to-orange-400 p-12">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />
        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/10" />
        <div className="absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-white/10" />
        <div className="absolute top-1/2 -right-8 h-32 w-32 rounded-full bg-white/10" />

        <div className="relative z-10 text-center space-y-6 max-w-xs">
          <div className="mx-auto h-24 w-24 rounded-3xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-2xl border border-white/30">
            <img src="/logo.svg" alt="Payroo" className="h-16 w-16 rounded-2xl" />
          </div>
          <div>
            <h1 className="text-4xl font-extrabold text-white tracking-tight drop-shadow">Payroo POS</h1>
            <p className="text-white/80 text-base mt-2 font-medium">Smart Point of Sale for your store</p>
          </div>
          <div className="space-y-3 text-left">
            {[
              { icon: "⚡", text: "Fast & reliable checkout" },
              { icon: "📦", text: "Real-time inventory tracking" },
              { icon: "📊", text: "Sales reports & analytics" },
              { icon: "📱", text: "Works on any device" },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-3 bg-white/15 rounded-xl px-4 py-2.5 backdrop-blur-sm">
                <span className="text-lg">{icon}</span>
                <span className="text-white text-sm font-medium">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right login panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md space-y-8">

          {/* Mobile logo (hidden on desktop) */}
          <div className="lg:hidden text-center space-y-3">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center shadow-md">
              <img src="/logo.svg" alt="Payroo" className="h-12 w-12 rounded-xl" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">Payroo POS</h1>
              <p className="text-sm text-muted-foreground">Smart Point of Sale</p>
            </div>
          </div>

          {/* Heading */}
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight">Staff Sign In</h2>
            <p className="text-muted-foreground text-sm">Enter your Store ID and 6-digit PIN to continue</p>
          </div>

          {/* Form card */}
          <div className="bg-card border rounded-2xl shadow-sm p-6 sm:p-8 space-y-6">

            <form onSubmit={handleLogin} className="space-y-5">

              {/* Store ID */}
              <div className="space-y-2">
                <label htmlFor="storeId" className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Store className="h-3.5 w-3.5 text-muted-foreground" />
                  Store ID
                </label>
                <div className={`relative rounded-xl border-2 transition-colors ${
                  focusedField === "storeId" ? "border-primary" : "border-border"
                }`}>
                  <Input
                    id="storeId"
                    placeholder="e.g. 1234"
                    value={storeId}
                    onChange={e => setStoreId(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    onFocus={() => setFocusedField("storeId")}
                    onBlur={() => setFocusedField(null)}
                    disabled={loading}
                    autoComplete="off"
                    maxLength={6}
                    inputMode="numeric"
                    className="border-0 focus-visible:ring-0 text-center text-3xl tracking-[0.4em] font-mono h-14 bg-transparent rounded-xl"
                  />
                </div>
                <p className="text-xs text-muted-foreground pl-1">4 to 6 digit store identifier</p>
              </div>

              {/* PIN */}
              <div className="space-y-2">
                <label htmlFor="pin" className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                  PIN
                </label>
                <div className={`relative rounded-xl border-2 transition-colors ${
                  focusedField === "pin" ? "border-primary" : "border-border"
                }`}>
                  <Input
                    id="pin"
                    type={showPin ? "text" : "password"}
                    placeholder="••••••"
                    value={pin}
                    onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    onFocus={() => setFocusedField("pin")}
                    onBlur={() => setFocusedField(null)}
                    disabled={loading}
                    autoComplete="current-password"
                    maxLength={6}
                    inputMode="numeric"
                    className="border-0 focus-visible:ring-0 text-center text-3xl tracking-[0.4em] font-mono h-14 bg-transparent rounded-xl pr-12"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPin(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                  >
                    {showPin ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {/* PIN dot progress */}
                <PinDots />
              </div>

              {/* Submit */}
              <Button
                type="submit"
                size="lg"
                className="w-full h-12 text-base font-semibold rounded-xl shadow-md"
                disabled={loading || storeId.length < 4 || pin.length !== 6}
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing in…</>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-card px-3 text-xs text-muted-foreground">or</span>
              </div>
            </div>

            {/* Owner login */}
            <Link href="/dashboard">
              <Button variant="outline" size="lg" className="w-full h-12 rounded-xl font-medium">
                <Store className="h-4 w-4 mr-2" />
                Owner / Manager Login
              </Button>
            </Link>
          </div>

          {/* Footer hints */}
          <div className="space-y-3 text-center">
            <p className="text-xs text-muted-foreground">
              Forgot your PIN?{" "}
              <span className="font-medium text-foreground">Ask your store owner</span>{" "}
              to reset it in User Management.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to homepage
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
