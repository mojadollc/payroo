"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { buildSession, setSession, clearSession } from "@/lib/pos-session"

type Mode = "staff" | "owner"
type Step = "identifier" | "pin"

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { login } = useAuth()

  const [mode, setMode] = useState<Mode>("staff")
  const [step, setStep] = useState<Step>("identifier")
  const [identifier, setIdentifier] = useState("") // storeId or email
  const [pin, setPin] = useState("")
  const [loading, setLoading] = useState(false)
  const [activeKey, setActiveKey] = useState<string | null>(null)

  const switchMode = (m: Mode) => {
    setMode(m)
    setStep("identifier")
    setIdentifier("")
    setPin("")
  }

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
    setActiveKey(key)
    setTimeout(() => setActiveKey(null), 120)

    if (step === "identifier") {
      if (key === "⌫") {
        setIdentifier(v => v.slice(0, -1))
      } else if (mode === "staff" && identifier.length < 6) {
        setIdentifier(v => v + key)
      }
      // owner email uses keyboard input, numpad not used in identifier step for owner
    } else {
      if (key === "⌫") {
        setPin(v => v.slice(0, -1))
      } else if (pin.length < 6) {
        const next = pin + key
        setPin(next)
        if (next.length === 6) setTimeout(() => handleSubmit(next), 200)
      }
    }
  }

  const numpadKeys = ["1","2","3","4","5","6","7","8","9","","0","⌫"]

  const isIdentifierReady = mode === "owner"
    ? identifier.includes("@") && identifier.length > 5
    : identifier.length >= 4

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "rgb(243, 234, 214)" }}>
      <div className="w-full max-w-[410px] min-h-screen flex flex-col px-6 pt-14 pb-8">

        {/* Logo */}
        <div className="mb-6">
          <div className="h-12 w-12 rounded-2xl bg-amber-900/10 flex items-center justify-center mb-6">
            <img src="/logo.svg" alt="Payroo" className="h-8 w-8 rounded-xl" />
          </div>
          <p className="text-[13px] font-semibold text-amber-900/50 uppercase tracking-widest mb-1">Payroo POS</p>
          <h1 className="text-[28px] font-black text-amber-950 leading-tight tracking-tight">
            {step === "identifier" ? "Kumusta! 👋" : "Enter your PIN"}
          </h1>
          <p className="text-[14px] text-amber-900/60 mt-1">
            {step === "identifier"
              ? "Sign in para simulan ang shift"
              : mode === "owner" ? `Owner: ${identifier}` : `Store ID: ${identifier}`}
          </p>
        </div>

        {/* Mode toggle */}
        {step === "identifier" && (
          <div className="flex rounded-2xl bg-amber-900/10 p-1 mb-6">
            {(["staff", "owner"] as Mode[]).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`flex-1 py-2 rounded-xl text-[13px] font-bold transition-all capitalize ${
                  mode === m
                    ? "bg-amber-900 text-amber-50 shadow"
                    : "text-amber-900/60"
                }`}
              >
                {m === "staff" ? "Staff / Cashier" : "Owner"}
              </button>
            ))}
          </div>
        )}

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          <div className={`h-1.5 rounded-full flex-1 transition-all ${step === "identifier" ? "bg-amber-900" : "bg-amber-900/30"}`} />
          <div className={`h-1.5 rounded-full flex-1 transition-all ${step === "pin" ? "bg-amber-900" : "bg-amber-900/20"}`} />
        </div>

        {/* Input display */}
        <div className="mb-6">
          {step === "identifier" ? (
            <div>
              <p className="text-[11px] font-bold text-amber-900/50 uppercase tracking-widest mb-3">
                {mode === "owner" ? "Email Address" : "Store ID"}
              </p>

              {mode === "owner" ? (
                <input
                  type="email"
                  autoFocus
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full h-14 rounded-2xl bg-white/60 border border-amber-900/20 px-4 text-[16px] font-semibold text-amber-950 placeholder:text-amber-900/30 focus:outline-none focus:border-amber-900/50 focus:bg-white/80"
                />
              ) : (
                <div className="flex items-center gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className={`flex-1 h-12 rounded-xl flex items-center justify-center text-[22px] font-black transition-all ${
                        i < identifier.length
                          ? "bg-amber-900 text-amber-50 shadow-md"
                          : i === identifier.length
                          ? "bg-amber-900/15 border-2 border-amber-900/40"
                          : "bg-amber-900/8 border border-amber-900/15"
                      }`}
                    >
                      {identifier[i] ?? ""}
                    </div>
                  ))}
                </div>
              )}
              {mode === "staff" && (
                <p className="text-[11px] text-amber-900/40 mt-2">4 to 6 digit store identifier</p>
              )}
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

        {/* Numpad — only for staff identifier step or PIN step */}
        {(step === "pin" || (step === "identifier" && mode === "staff")) && (
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
        )}

        {/* Action button */}
        {step === "identifier" ? (
          <Button
            size="lg"
            className="w-full h-14 text-[16px] font-bold rounded-2xl shadow-md bg-amber-900 hover:bg-amber-800 text-amber-50 border-0"
            disabled={!isIdentifierReady || loading}
            onClick={() => setStep("pin")}
          >
            Next →
          </Button>
        ) : (
          <Button
            size="lg"
            className="w-full h-14 text-[16px] font-bold rounded-2xl shadow-md bg-amber-900 hover:bg-amber-800 text-amber-50 border-0"
            disabled={pin.length !== 6 || loading}
            onClick={() => handleSubmit(pin)}
          >
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing in…</> : "Sign in"}
          </Button>
        )}

        {/* Footer links */}
        <div className="mt-4 flex items-center justify-between">
          {step === "pin" ? (
            <button
              type="button"
              className="text-[13px] text-amber-900/50 font-medium"
              onClick={() => { setStep("identifier"); setPin("") }}
            >
              ← Back
            </button>
          ) : (
            <Link href="/register" className="text-[13px] text-amber-900/60 font-semibold underline underline-offset-2">
              New store? Register
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
