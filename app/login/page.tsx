"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2, Store } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { buildSession, setSession, clearSession } from "@/lib/pos-session"

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { login } = useAuth()

  const [storeId, setStoreId] = useState("")
  const [pin, setPin] = useState("")
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<"storeId" | "pin">("storeId")
  const [activeKey, setActiveKey] = useState<string | null>(null)

  const storeIdRef = useRef<HTMLInputElement>(null)

  const handleLogin = async () => {
    if (!storeId.trim() || pin.length !== 6) return
    setLoading(true)
    try {
      const res = await fetch("/api/auth/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: storeId.trim(), pin }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: "Invalid credentials", description: data.error || "Check your Store ID and PIN.", variant: "destructive" })
        setPin("")
        setStep("pin")
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
      router.push("/home")
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  // Numpad key press
  const pressKey = (key: string) => {
    setActiveKey(key)
    setTimeout(() => setActiveKey(null), 120)

    if (step === "storeId") {
      if (key === "⌫") {
        setStoreId(v => v.slice(0, -1))
      } else if (storeId.length < 6) {
        const next = storeId + key
        setStoreId(next)
        if (next.length >= 4) {
          // allow proceeding — user taps "Next"
        }
      }
    } else {
      if (key === "⌫") {
        setPin(v => v.slice(0, -1))
      } else if (pin.length < 6) {
        const next = pin + key
        setPin(next)
        if (next.length === 6) {
          // auto-submit after short delay
          setTimeout(() => handleLoginWithPin(next), 200)
        }
      }
    }
  }

  const handleLoginWithPin = async (pinValue: string) => {
    if (!storeId.trim() || pinValue.length !== 6) return
    setLoading(true)
    try {
      const res = await fetch("/api/auth/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: storeId.trim(), pin: pinValue }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: "Wrong PIN", description: data.error || "Try again.", variant: "destructive" })
        setPin("")
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
      router.push("/home")
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const numpadKeys = ["1","2","3","4","5","6","7","8","9","","0","⌫"]

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "rgb(243, 234, 214)" }}>
      <div className="w-full max-w-[410px] min-h-screen flex flex-col px-6 pt-14 pb-8">

        {/* Logo + greeting */}
        <div className="mb-8">
          <div className="h-12 w-12 rounded-2xl bg-amber-900/10 flex items-center justify-center mb-6">
            <img src="/logo.svg" alt="Payroo" className="h-8 w-8 rounded-xl" />
          </div>
          <p className="text-[13px] font-semibold text-amber-900/50 uppercase tracking-widest mb-1">Payroo POS</p>
          <h1 className="text-[28px] font-black text-amber-950 leading-tight tracking-tight">
            {step === "storeId" ? "Kumusta! 👋" : "Enter your PIN"}
          </h1>
          <p className="text-[14px] text-amber-900/60 mt-1">
            {step === "storeId"
              ? "Sign in para simulan ang shift"
              : `Store ID: ${storeId}`}
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          <div className={`h-1.5 rounded-full flex-1 transition-all ${step === "storeId" ? "bg-amber-900" : "bg-amber-900/30"}`} />
          <div className={`h-1.5 rounded-full flex-1 transition-all ${step === "pin" ? "bg-amber-900" : "bg-amber-900/20"}`} />
        </div>

        {/* Input display */}
        <div className="mb-8">
          {step === "storeId" ? (
            <div>
              <p className="text-[11px] font-bold text-amber-900/50 uppercase tracking-widest mb-3">Store ID</p>
              <div className="flex items-center gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className={`flex-1 h-12 rounded-xl flex items-center justify-center text-[22px] font-black transition-all ${
                      i < storeId.length
                        ? "bg-amber-900 text-amber-50 shadow-md"
                        : i === storeId.length
                        ? "bg-amber-900/15 border-2 border-amber-900/40"
                        : "bg-amber-900/8 border border-amber-900/15"
                    }`}
                  >
                    {storeId[i] ?? ""}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-amber-900/40 mt-2">4 to 6 digit store identifier</p>
            </div>
          ) : (
            <div>
              <p className="text-[11px] font-bold text-amber-900/50 uppercase tracking-widest mb-3">6-Digit PIN</p>
              <div className="flex items-center justify-center gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className={`rounded-full transition-all duration-150 ${
                      i < pin.length
                        ? "h-4 w-4 bg-amber-900 shadow-md"
                        : i === pin.length
                        ? "h-3.5 w-3.5 bg-amber-900/20 border-2 border-amber-900/50"
                        : "h-3 w-3 bg-amber-900/15"
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {numpadKeys.map((key, i) => (
            key === "" ? (
              <div key={i} />
            ) : (
              <button
                key={i}
                type="button"
                disabled={loading}
                onPointerDown={() => pressKey(key)}
                className={`h-16 rounded-2xl text-[22px] font-bold transition-all duration-100 select-none active:scale-95 ${
                  key === "⌫"
                    ? "bg-amber-900/10 text-amber-900/60 text-[18px]"
                    : activeKey === key
                    ? "bg-amber-900 text-amber-50 shadow-lg scale-95"
                    : "bg-white/60 text-amber-950 shadow-sm hover:bg-white/80"
                }`}
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                {key}
              </button>
            )
          ))}
        </div>

        {/* Action button */}
        {step === "storeId" ? (
          <Button
            size="lg"
            className="w-full h-14 text-[16px] font-bold rounded-2xl shadow-md bg-amber-900 hover:bg-amber-800 text-amber-50 border-0"
            disabled={storeId.length < 4 || loading}
            onClick={() => setStep("pin")}
          >
            Next →
          </Button>
        ) : (
          <Button
            size="lg"
            className="w-full h-14 text-[16px] font-bold rounded-2xl shadow-md bg-amber-900 hover:bg-amber-800 text-amber-50 border-0"
            disabled={pin.length !== 6 || loading}
            onClick={() => handleLoginWithPin(pin)}
          >
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing in…</> : "Sign in"}
          </Button>
        )}

        {/* Back / forgot */}
        <div className="mt-4 flex items-center justify-between">
          {step === "pin" ? (
            <button
              type="button"
              className="text-[13px] text-amber-900/50 font-medium"
              onClick={() => { setStep("storeId"); setPin("") }}
            >
              ← Back
            </button>
          ) : (
            <Link href="/dashboard" className="text-[13px] text-amber-900/50 font-medium">
              <Store className="h-3.5 w-3.5 inline mr-1" />
              Owner login
            </Link>
          )}
          <div className="text-right">
            <p className="text-[12px] text-amber-900/40">Nakalimutan ang PIN?</p>
            <p className="text-[12px] text-amber-900/60 font-semibold">Ask owner to reset</p>
          </div>
        </div>

      </div>
    </div>
  )
}
