"use client"

import { useEffect, useState, useRef, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { CheckCircle, Loader2, LogIn, ArrowRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { getFirebaseDb } from "@/lib/firebase/config"
import { collection, query, where, getDocs } from "firebase/firestore"
import { useAuth } from "@/hooks/use-auth"
import type { StoreUser } from "@/lib/firebase/types"

function SuccessContent() {
  const params = useSearchParams()
  const router = useRouter()
  const { login } = useAuth()
  const ext = params.get("ext")
  const [subData, setSubData] = useState<any>(null)
  const [activated, setActivated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [autoLogging, setAutoLogging] = useState(false)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!ext) { setLoading(false); return }
    localStorage.setItem("pos_ext_id", ext)

    let attempts = 0
    const MAX_ATTEMPTS = 20 // ~60 seconds total

    const poll = async () => {
      try {
        const db = getFirebaseDb()
        if (!db) { setLoading(false); return }
        const snap = await getDocs(query(
          collection(db, "customerSubscriptions"),
          where("externalId", "==", ext)
        ))
        if (!snap.empty) {
          const data = snap.docs[0].data()
          setSubData(data)

          if (data.storeName) {
            localStorage.setItem("storeName", data.storeName)
            window.dispatchEvent(new Event("storename"))
          }
          if (data.businessType) {
            localStorage.setItem("businessType", data.businessType)
            window.dispatchEvent(new Event("businesstype"))
          }

          // If webhook has activated the subscription, auto-login
          if (data.status === "active" && data.xenditPaymentStatus === "PAID") {
            setActivated(true)
            setLoading(false)
            autoLoginOwner(data, ext)
            return
          }
        }
      } catch {}

      attempts++
      if (attempts < MAX_ATTEMPTS) {
        pollRef.current = setTimeout(poll, 3000)
      } else {
        setLoading(false)
      }
    }
    poll()

    return () => { if (pollRef.current) clearTimeout(pollRef.current) }
  }, [ext])

  const autoLoginOwner = async (sub: any, storeId: string) => {
    setAutoLogging(true)
    try {
      const db = getFirebaseDb()
      if (!db) return

      // Find owner user
      const userSnap = await getDocs(query(
        collection(db, "storeUsers"),
        where("externalId", "==", storeId),
        where("role", "==", "owner"),
        where("isActive", "==", true)
      ))

      if (userSnap.empty) return

      const ownerUser = { id: userSnap.docs[0].id, ...userSnap.docs[0].data() } as StoreUser

      // Cache subscription
      const endDateObj = sub.endDate?.toDate?.() ?? null
      localStorage.setItem("pos_subscription", JSON.stringify({
        loading: false,
        isActive: true,
        tier: sub.tier ?? "basic",
        features: {
          pos: false, inventory: false, ewallet: false, reports: false,
          loyalty: false, utang: false, aiRestock: false, multiUser: false,
          exportData: false, marketIntelligence: false,
          ...(sub.features ?? {}),
        },
        storeName: sub.storeName ?? null,
        businessType: sub.businessType ?? null,
        ownerName: sub.ownerName ?? null,
        ownerEmail: sub.ownerEmail ?? null,
        endDate: endDateObj?.toISOString() ?? null,
        externalId: storeId,
      }))

      login(ownerUser)

      // Redirect to POS after brief delay so user sees success
      setTimeout(() => router.push("/pos"), 2000)
    } catch (err) {
      console.error("Auto-login failed:", err)
    } finally {
      setAutoLogging(false)
    }
  }

  const ownerUsername = subData?.ownerName
    ? subData.ownerName.split(" ")[0].toLowerCase().replace(/[^a-z0-9]/g, "")
    : null

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-4">
        <Card>
          <CardHeader className="text-center">
            <div className={`mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full ${activated ? "bg-green-100" : "bg-yellow-100"}`}>
              {activated
                ? <CheckCircle className="h-9 w-9 text-green-600" />
                : <Loader2 className="h-9 w-9 text-yellow-600 animate-spin" />
              }
            </div>
            <CardTitle className={`text-2xl ${activated ? "text-green-700" : "text-yellow-700"}`}>
              {activated ? "Payment Successful!" : "Processing Payment..."}
            </CardTitle>
            <CardDescription className="text-base">
              {activated
                ? "Your subscription is active. Redirecting you to your store..."
                : "Waiting for payment confirmation. This usually takes a few seconds."
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Activating spinner */}
            {loading && !activated && (
              <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Activating your account...
              </div>
            )}

            {/* Auto-login redirect notice */}
            {activated && (
              <div className="flex items-center justify-center gap-2 py-2 text-green-700 text-sm font-medium">
                <Loader2 className="h-4 w-4 animate-spin" /> Logging you in automatically...
              </div>
            )}

            {/* Store info */}
            {subData && (
              <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
                <p className="font-semibold text-base">{subData.storeName}</p>
                <p className="text-muted-foreground capitalize">
                  {subData.businessType?.replace(/_/g, " ")} · {subData.tier?.toUpperCase()} Plan
                </p>
                <p className="text-xs text-muted-foreground">
                  Status: <span className={activated ? "text-green-600 font-medium" : "text-yellow-600 font-medium"}>
                    {activated ? "✓ Active" : "⏳ Pending activation"}
                  </span>
                </p>
              </div>
            )}

            {/* Credentials — show only after activation or timeout */}
            {ownerUsername && !loading && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                <p className="font-semibold text-sm flex items-center gap-2">
                  <LogIn className="h-4 w-4 text-primary" /> Your Login Credentials
                </p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Store ID</span>
                    <span className="font-mono font-medium text-xs break-all text-right max-w-[60%]">{ext}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Username</span>
                    <span className="font-mono font-medium">{ownerUsername}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">PIN</span>
                    <span className="font-mono font-medium">(check your email)</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  ⚠️ Save these credentials. Your PIN was sent to your email.
                </p>
              </div>
            )}

            {ext && (
              <p className="text-xs text-muted-foreground bg-muted rounded px-3 py-2 font-mono break-all text-center">
                Ref: {ext}
              </p>
            )}

            {/* Manual buttons — show if not auto-redirecting */}
            {!loading && !autoLogging && (
              <div className="flex flex-col gap-2 pt-1">
                {activated ? (
                  <Link href="/pos">
                    <Button className="w-full">
                      <ArrowRight className="h-4 w-4 mr-2" /> Go to Your Store
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Link href="/dashboard">
                      <Button className="w-full">
                        <LogIn className="h-4 w-4 mr-2" /> Login to Dashboard
                      </Button>
                    </Link>
                    <p className="text-xs text-muted-foreground text-center">
                      If activation is taking long, try logging in manually. Your account will be ready shortly.
                    </p>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}
