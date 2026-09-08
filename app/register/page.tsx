"use client"

import { useState } from "react"
import Link from "next/link"
import { Loader2, CheckCircle2, Copy, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

interface FormData {
  ownerName: string
  ownerEmail: string
  storeName: string
  phone: string
  businessType: string
  referralCode: string
}

interface SuccessData {
  storeId: string
  ownerPin: string
  storeName: string
}

const BUSINESS_TYPES = ["Sari-sari Store", "Grocery", "Pharmacy", "Bakery", "Restaurant", "Clothing", "Hardware", "Other"]

export default function RegisterPage() {
  const { toast } = useToast()
  const [form, setForm] = useState<FormData>({
    ownerName: "", ownerEmail: "", storeName: "", phone: "", businessType: "Sari-sari Store", referralCode: "",
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<SuccessData | null>(null)
  const [errors, setErrors] = useState<Partial<FormData>>({})

  const validate = () => {
    const e: Partial<FormData> = {}
    if (!form.ownerName.trim()) e.ownerName = "Required"
    if (!form.ownerEmail.includes("@")) e.ownerEmail = "Valid email required"
    if (!form.storeName.trim()) e.storeName = "Required"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      // Get free plan ID first
      const plansRes = await fetch("/api/management/plans")
      const plansJson = await plansRes.json()
      const freePlan = (plansJson.data ?? []).find((p: any) => p.price === 0) ?? plansJson.data?.[0]

      if (!freePlan) {
        toast({ title: "Setup error", description: "No subscription plan found. Contact support.", variant: "destructive" })
        return
      }

      const res = await fetch("/api/create-free-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: freePlan.id,
          planName: freePlan.name,
          ownerName: form.ownerName.trim(),
          ownerEmail: form.ownerEmail.trim().toLowerCase(),
          storeName: form.storeName.trim(),
          phone: form.phone.trim(),
          businessType: form.businessType,
          referralCode: form.referralCode.trim() || undefined,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast({ title: "Registration failed", description: data.error, variant: "destructive" })
        return
      }

      // Fetch the owner PIN from the newly created store user
      const ownerRes = await fetch(`/api/store-owner?externalId=${data.externalId}`)
      const ownerJson = await ownerRes.json()

      setSuccess({
        storeId: data.externalId,
        ownerPin: ownerJson.data?.pin ?? "Check your email",
        storeName: form.storeName.trim(),
      })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: `${label} copied!` })
  }

  const field = (key: keyof FormData, label: string, type = "text", placeholder = "") => (
    <div>
      <label className="text-[11px] font-bold text-amber-900/50 uppercase tracking-widest block mb-1.5">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={e => { setForm(f => ({ ...f, [key]: e.target.value })); setErrors(er => ({ ...er, [key]: undefined })) }}
        placeholder={placeholder}
        className={`w-full h-12 rounded-xl bg-white/60 border px-4 text-[15px] text-amber-950 placeholder:text-amber-900/30 focus:outline-none focus:bg-white/80 transition-all ${
          errors[key] ? "border-red-400" : "border-amber-900/20 focus:border-amber-900/50"
        }`}
      />
      {errors[key] && <p className="text-[11px] text-red-500 mt-1">{errors[key]}</p>}
    </div>
  )

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "rgb(243, 234, 214)" }}>
        <div className="w-full max-w-[410px] px-6 py-14 flex flex-col items-center text-center">
          <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-6">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-[26px] font-black text-amber-950 mb-2">You're all set! 🎉</h1>
          <p className="text-[14px] text-amber-900/60 mb-8">
            Welcome to Payroo, <strong>{success.storeName}</strong>! Save your credentials below.
          </p>

          <div className="w-full space-y-3 mb-8">
            <div className="bg-white/70 rounded-2xl p-4 flex items-center justify-between">
              <div className="text-left">
                <p className="text-[11px] font-bold text-amber-900/50 uppercase tracking-widest">Store ID</p>
                <p className="text-[28px] font-black text-amber-950 tracking-widest">{success.storeId}</p>
              </div>
              <button onClick={() => copy(success.storeId, "Store ID")} className="p-2 rounded-xl bg-amber-900/10 text-amber-900/60 hover:bg-amber-900/20">
                <Copy className="h-4 w-4" />
              </button>
            </div>

            <div className="bg-white/70 rounded-2xl p-4 flex items-center justify-between">
              <div className="text-left">
                <p className="text-[11px] font-bold text-amber-900/50 uppercase tracking-widest">Owner PIN</p>
                <p className="text-[28px] font-black text-amber-950 tracking-widest">{success.ownerPin}</p>
              </div>
              <button onClick={() => copy(success.ownerPin, "PIN")} className="p-2 rounded-xl bg-amber-900/10 text-amber-900/60 hover:bg-amber-900/20">
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>

          <p className="text-[12px] text-amber-900/50 mb-6">
            A welcome email with these credentials has been sent to your email address.
          </p>

          <Link href="/login" className="w-full">
            <Button size="lg" className="w-full h-14 text-[16px] font-bold rounded-2xl bg-amber-900 hover:bg-amber-800 text-amber-50 border-0">
              Go to Login <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "rgb(243, 234, 214)" }}>
      <div className="w-full max-w-[410px] min-h-screen flex flex-col px-6 pt-14 pb-8">

        <div className="mb-8">
          <div className="h-12 w-12 rounded-2xl bg-amber-900/10 flex items-center justify-center mb-6">
            <img src="/logo.svg" alt="Payroo" className="h-8 w-8 rounded-xl" />
          </div>
          <p className="text-[13px] font-semibold text-amber-900/50 uppercase tracking-widest mb-1">Payroo POS</p>
          <h1 className="text-[28px] font-black text-amber-950 leading-tight">Create your store 🏪</h1>
          <p className="text-[14px] text-amber-900/60 mt-1">Register as a store owner — free to start</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 flex-1">
          {field("ownerName", "Your Full Name", "text", "Juan dela Cruz")}
          {field("ownerEmail", "Email Address", "email", "juan@email.com")}
          {field("storeName", "Store Name", "text", "Juan's Sari-sari Store")}
          {field("phone", "Phone Number (optional)", "tel", "09XX XXX XXXX")}

          <div>
            <label className="text-[11px] font-bold text-amber-900/50 uppercase tracking-widest block mb-1.5">Business Type</label>
            <select
              value={form.businessType}
              onChange={e => setForm(f => ({ ...f, businessType: e.target.value }))}
              className="w-full h-12 rounded-xl bg-white/60 border border-amber-900/20 px-4 text-[15px] text-amber-950 focus:outline-none focus:border-amber-900/50 focus:bg-white/80"
            >
              {BUSINESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {field("referralCode", "Referral Code (optional)", "text", "e.g. JUAN123")}

          <div className="mt-2">
            <Button
              type="submit"
              size="lg"
              className="w-full h-14 text-[16px] font-bold rounded-2xl bg-amber-900 hover:bg-amber-800 text-amber-50 border-0"
              disabled={loading}
            >
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating store…</> : "Create My Store →"}
            </Button>
          </div>

          <p className="text-center text-[13px] text-amber-900/50 mt-2">
            Already have an account?{" "}
            <Link href="/login" className="text-amber-900 font-semibold underline underline-offset-2">Sign in</Link>
          </p>
        </form>

      </div>
    </div>
  )
}
