"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Eye, EyeOff, Loader2, LogIn, ArrowLeft } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { login } = useAuth()

  const [storeId, setStoreId] = useState("")
  const [pin, setPin] = useState("")
  const [showPin, setShowPin] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!storeId.trim() || !pin.trim()) {
      toast({ title: "Please enter Store ID and PIN", variant: "destructive" })
      return
    }

    if (storeId.length < 4 || storeId.length > 6) {
      toast({ title: "Store ID must be 4-6 digits", variant: "destructive" })
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

      // Clear any previous store's cached data before setting new store
      const prevStoreId = localStorage.getItem("pos_ext_id")
      if (prevStoreId && prevStoreId !== storeId.trim()) {
        localStorage.removeItem(`pos_products_cache_${prevStoreId}`)
        localStorage.removeItem("pos_cart")
        localStorage.removeItem("pos_current_user")
        localStorage.removeItem("pos_subscription")
      }

      localStorage.setItem("pos_ext_id", storeId.trim())
      localStorage.setItem("pos_main_ext_id", storeId.trim())

      login(user)
      toast({ title: `Welcome, ${user.name}!`, description: `Logged in as ${user.role}` })
      router.push("/pos")
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Link href="/" className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl hover:opacity-80 transition-opacity">
            <img src="/logo.svg" alt="PayrooPOS" className="h-14 w-14 rounded-2xl" />
          </Link>
          <h1 className="text-2xl font-bold">Staff Login</h1>
          <p className="text-sm text-muted-foreground mt-1">Quick access for cashiers and staff</p>
        </div>

        <Alert className="bg-blue-50 border-blue-200">
          <AlertDescription className="text-blue-800 text-sm">
            Are you a store owner? <Link href="/dashboard" className="underline font-medium">Owner login here →</Link>
          </AlertDescription>
        </Alert>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="storeId">Store ID</Label>
                <Input
                  id="storeId"
                  placeholder="Enter Store ID"
                  value={storeId}
                  onChange={e => setStoreId(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  disabled={loading}
                  autoComplete="off"
                  maxLength={6}
                  inputMode="numeric"
                  className="text-center text-2xl tracking-[0.3em] font-mono h-14"
                />
                <p className="text-xs text-muted-foreground">Enter your Store ID (4-6 digits)</p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="pin">PIN</Label>
                <div className="relative">
                  <Input
                    id="pin"
                    type={showPin ? "text" : "password"}
                    placeholder="••••••"
                    value={pin}
                    onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    disabled={loading}
                    autoComplete="current-password"
                    maxLength={6}
                    inputMode="numeric"
                    className="text-center text-2xl tracking-[0.3em] font-mono h-14 pr-12"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowPin(v => !v)}
                    tabIndex={-1}
                  >
                    {showPin ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing in...</>
                  : <><LogIn className="h-4 w-4 mr-2" /> Sign In</>
                }
              </Button>

              <p className="text-xs text-center text-muted-foreground mt-3">
                Forgot your PIN? Ask your store owner to reset it in <span className="font-medium">User Management</span>.
              </p>
            </form>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground">
          <p><Link href="/" className="text-primary underline underline-offset-2 inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> Back to homepage</Link></p>
        </div>
      </div>
    </div>
  )
}
