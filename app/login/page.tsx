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
import { loginStoreUser } from "@/lib/firebase/services"
import { useAuth } from "@/hooks/use-auth"
import { getFirebaseDb } from "@/lib/firebase/config"
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore"

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { login } = useAuth()

  const [storeId, setStoreId] = useState(() =>
    typeof window !== "undefined" ? (localStorage.getItem("pos_ext_id") ?? "") : ""
  )
  const [username, setUsername] = useState("")
  const [pin, setPin] = useState("")
  const [showPin, setShowPin] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!storeId.trim() || !username.trim() || !pin.trim()) {
      toast({ title: "Please fill in all fields", variant: "destructive" })
      return
    }

    setLoading(true)
    try {
      const user = await loginStoreUser(storeId.trim(), username.trim().toLowerCase(), pin.trim())
      if (!user) {
        toast({ title: "Invalid credentials", description: "Check your Store ID, username, and PIN.", variant: "destructive" })
        return
      }

      localStorage.setItem("pos_ext_id", storeId.trim())

      // Pre-cache subscription so AuthGuard sees features immediately
      try {
        const db = getFirebaseDb()
        if (db) {
          const subSnap = await getDocs(query(
            collection(db, "customerSubscriptions"),
            where("externalId", "==", storeId.trim()),
            orderBy("createdAt", "desc"),
            limit(1)
          ))
          if (!subSnap.empty) {
            const sub = subSnap.docs[0].data()
            const endDateObj = sub.endDate?.toDate?.() ?? null
            const fullFeatures = {
              pos: false, inventory: false, ewallet: false, reports: false,
              loyalty: false, utang: false, aiRestock: false, multiUser: false,
              exportData: false, marketIntelligence: false,
              ...(sub.features ?? {}),
            }
            localStorage.setItem("pos_subscription", JSON.stringify({
              loading: false,
              isActive: sub.status === "active" && (!endDateObj || endDateObj > new Date()),
              tier: sub.tier ?? "basic",
              features: fullFeatures,
              storeName: sub.storeName ?? null,
              businessType: sub.businessType ?? null,
              ownerName: sub.ownerName ?? null,
              ownerEmail: sub.ownerEmail ?? null,
              endDate: endDateObj?.toISOString() ?? null,
              externalId: storeId.trim(),
            }))
            if (sub.storeName) localStorage.setItem("storeName", sub.storeName)
          }
        }
      } catch {}

      login(user)
      toast({ title: `Welcome, ${user.name}!`, description: `Logged in as ${user.role}` })
      // Everyone from staff login goes to POS
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
          <p className="text-sm text-muted-foreground mt-1">For cashiers and staff — POS access</p>
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
                <Label htmlFor="storeId">Store ID (4 digits)</Label>
                <Input
                  id="storeId"
                  placeholder="e.g. 8807"
                  value={storeId}
                  onChange={e => setStoreId(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  disabled={loading}
                  autoComplete="off"
                  maxLength={4}
                  inputMode="numeric"
                />
                <p className="text-xs text-muted-foreground">Ask your store owner for the Store ID</p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="e.g. juan"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  disabled={loading}
                  autoComplete="username"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="pin">PIN (6 digits)</Label>
                <div className="relative">
                  <Input
                    id="pin"
                    type={showPin ? "text" : "password"}
                    placeholder="Enter your 6-digit PIN"
                    value={pin}
                    onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    disabled={loading}
                    autoComplete="current-password"
                    maxLength={6}
                    inputMode="numeric"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowPin(v => !v)}
                    tabIndex={-1}
                  >
                    {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing in...</>
                  : <><LogIn className="h-4 w-4 mr-2" /> Sign In</>
                }
              </Button>
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
