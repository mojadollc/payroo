"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { buildSession, setSession, clearSession } from "@/lib/pos-session"

type Mode = "staff" | "owner"

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { login } = useAuth()

  const [mode, setMode] = useState<Mode>("staff")
  const [identifier, setIdentifier] = useState("")
  const [pin, setPin] = useState("")
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<"identifier" | "pin">("identifier")
  const [pressedKey, setPressedKey] = useState<string | null>(null)

  const numpadKeys = ["1","2","3","4","5","6","7","8","9","","0","⌫"]

  const handleSubmit = async (pinValue: string) => {
    if (!identifier.trim() || pinValue.length !== 6) return
    setLoading(true)
    try {
      const endpoint = mode === "owner" ? "/api/auth/owner" : "/api/auth/staff"
      const body = mode === "owner"
        ? { email: identifier.trim(), pin: pinValue }
        : { storeId: identifier.trim(), pin: pinValue }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (!res.ok) {
        toast({ title: "Login failed", description: data.error || "Check your credentials.", variant: "destructive" })
        setPin("")
        return
      }

      const { user } = data
      const storeId = user.externalId

      clearSession()
      try {
        const subRes = await fetch(`/api/subscription?externalId=${storeId}`)
        const subJson = await subRes.json()
        if (subJson.data) {
          setSession(buildSession(storeId, subJson.data))
        } else {
          localStorage.setItem("pos_ext_id", storeId)
          localStorage.setItem("pos_main_ext_id", storeId)
        }
      } catch {
        localStorage.setItem("pos_ext_id", storeId)
        localStorage.setItem("pos_main_ext_id", storeId)
      }

      login(user)
      router.push("/home")
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const pressKey = (key: string) => {
    setPressedKey(key)
    setTimeout(() => setPressedKey(null), 100)

    if (step === "identifier" && mode === "staff") {
      if (key === "⌫") {
        setIdentifier(v => v.slice(0, -1))
      } else if (identifier.length < 6) {
        setIdentifier(v => v + key)
      }
    } else if (step === "pin") {
      if (key === "⌫") {
        setPin(v => v.slice(0, -1))
      } else if (pin.length < 6) {
        const next = pin + key
        setPin(next)
        if (next.length === 6) setTimeout(() => handleSubmit(next), 150)
      }
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {/* Header */}
      <div className="px-6 pt-14 pb-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <img src="/logo.svg" alt="Payroo" className="h-8 w-8" />
          </div>
          <div>
            <p className="text-xs text-neutral-400 font-medium">Payroo POS</p>
            <h1 className="text-xl font-bold text-neutral-900">
              {step === "identifier" ? "Welcome back" : "Enter PIN"}
            </h1>
          </div>
        </div>

        {/* Mode Toggle */}
        {step === "identifier" && (
          <div className="flex bg-neutral-100 rounded-xl p-1 mb-6">
            {(["staff", "owner"] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setIdentifier("") }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  mode === m ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"
                }`}
              >
                {m === "staff" ? "Staff" : "Owner"}
              </button>
            ))}
          </div>
        )}

        {/* Identifier Input */}
        {step === "identifier" && (
          <>
            {mode === "owner" ? (
              <div>
                <p className="text-xs font-medium text-neutral-500 mb-2">Email address</p>
                <Input
                  type="email"
                  autoFocus
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="your@email.com"
                  className="h-12 text-base rounded-xl border-neutral-200"
                />
              </div>
            ) : (
              <div>
                <p className="text-xs font-medium text-neutral-500 mb-2">Store ID</p>
                <div className="flex gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className={`flex-1 h-12 rounded-xl flex items-center justify-center text-lg font-bold transition-all ${
                        i < identifier.length
                          ? "bg-primary text-primary-foreground"
                          : i === identifier.length
                          ? "bg-primary/10 border-2 border-primary"
                          : "bg-neutral-100 border border-neutral-200"
                      }`}
                    >
                      {identifier[i] || ""}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* PIN Input */}
        {step === "pin" && (
          <div>
            <p className="text-xs font-medium text-neutral-500 mb-2">6-digit PIN</p>
            <div className="flex justify-center gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-10 h-10 rounded-full transition-all ${
                    i < pin.length ? "bg-primary" : i === pin.length ? "bg-primary/20 border-2 border-primary" : "bg-neutral-200"
                  }`}
                />
              ))}
            </div>
            <p className="text-center text-sm text-neutral-400 mt-3">
              {mode === "owner" ? identifier : `Store #${identifier}`}
            </p>
          </div>
        )}
      </div>

      {/* Numpad */}
      {(step === "pin" || (step === "identifier" && mode === "staff")) && (
        <div className="px-6">
          <div className="grid grid-cols-3 gap-3">
            {numpadKeys.map((key, i) => (
              key === "" ? <div key={i} /> : (
                <button
                  key={i}
                  onClick={() => pressKey(key)}
                  className={`h-14 rounded-xl text-xl font-semibold transition-all active:scale-95 ${
                    key === "⌫"
                      ? "bg-neutral-100 text-neutral-500 text-base"
                      : pressedKey === key
                      ? "bg-primary text-primary-foreground"
                      : "bg-white border border-neutral-200 text-neutral-900"
                  }`}
                >
                  {key}
                </button>
              )
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-6 mt-6">
        {step === "identifier" ? (
          <Button
            size="lg"
            className="w-full h-12 text-base font-semibold rounded-xl"
            disabled={
              loading ||
              (mode === "owner"
                ? !identifier.includes("@") || identifier.length < 5
                : identifier.length < 4)
            }
            onClick={() => setStep("pin")}
          >
            Continue <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button
            size="lg"
            className="w-full h-12 text-base font-semibold rounded-xl"
            disabled={loading || pin.length !== 6}
            onClick={() => handleSubmit(pin)}
          >
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing in...</> : "Sign in"}
          </Button>
        )}

        <div className="flex justify-between mt-4">
          {step === "pin" ? (
            <button onClick={() => { setStep("identifier"); setPin("") }} className="text-sm text-neutral-500">
              ← Back
            </button>
          ) : (
            <Link href="/register" className="text-sm text-primary font-medium">
              New store? Register
            </Link>
          )}
          <p className="text-sm text-neutral-400">
            Forgot PIN? <span className="text-neutral-600">Ask owner</span>
          </p>
        </div>
      </div>
    </div>
  )
}
