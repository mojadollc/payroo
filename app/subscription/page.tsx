"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Check, X, Star, Zap, Building2, Loader2, ArrowRight, ShieldCheck } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { getSubscriptionPlans } from "@/lib/firebase/services"
import { BUSINESS_TYPE_OPTIONS } from "@/lib/business-config"
import type { SubscriptionPlan, SubscriptionFeatures, SubscriptionTier } from "@/lib/firebase/types"

const FEATURE_LABELS: Record<keyof SubscriptionFeatures, string> = {
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

const TIER_ICONS: Record<SubscriptionTier, React.ReactNode> = {
  basic: <Zap className="h-5 w-5 text-green-500" />,
  gold: <Star className="h-5 w-5 text-yellow-500" />,
  enterprise: <Building2 className="h-5 w-5 text-purple-500" />,
}

const TIER_GRADIENT: Record<SubscriptionTier, string> = {
  basic: "from-green-50 to-green-100 border-green-200",
  gold: "from-yellow-50 to-amber-100 border-yellow-300",
  enterprise: "from-purple-50 to-purple-100 border-purple-300",
}

const POPULAR_TIER: SubscriptionTier = "gold"

interface CheckoutForm {
  ownerName: string
  ownerEmail: string
  storeName: string
  phone: string
  businessType: string
  referralCode: string
}

const EMPTY_FORM: CheckoutForm = { ownerName: "", ownerEmail: "", storeName: "", phone: "", businessType: "retail", referralCode: "" }

function SubscriptionContent() {
  const { toast } = useToast()
  const params = useSearchParams()
  const refCode = params.get("ref") || ""
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null)
  const [form, setForm] = useState<CheckoutForm>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    getSubscriptionPlans()
      .then(p => setPlans(p.filter(pl => pl.isActive)))
      .finally(() => setLoading(false))
  }, [])

  const openCheckout = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan)
    setForm({ ...EMPTY_FORM, referralCode: refCode })
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPlan) return

    if (!form.ownerName.trim() || !form.ownerEmail.trim() || !form.storeName.trim()) {
      toast({ title: "Please fill in all required fields", variant: "destructive" })
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(form.ownerEmail)) {
      toast({ title: "Please enter a valid email address", variant: "destructive" })
      return
    }

    setSubmitting(true)
    try {
      // Handle FREE plan differently
      if (selectedPlan.price === 0) {
        const res = await fetch("/api/create-free-subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId: selectedPlan.id,
            planName: selectedPlan.name,
            ownerName: form.ownerName.trim(),
            ownerEmail: form.ownerEmail.trim(),
            storeName: form.storeName.trim(),
            phone: form.phone.trim(),
            businessType: form.businessType,
            referralCode: form.referralCode.trim() || undefined,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || "Failed to create free subscription")
        }

        // Store the external ID and redirect to success
        localStorage.setItem("pos_ext_id", data.externalId)
        window.location.href = `/payment/success?ext=${data.externalId}`
        return
      }

      // Handle paid plans with Xendit
      const res = await fetch("/api/xendit/create-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: selectedPlan.id,
          planName: selectedPlan.name,
          planPrice: selectedPlan.price,
          ownerName: form.ownerName.trim(),
          ownerEmail: form.ownerEmail.trim(),
          storeName: form.storeName.trim(),
          phone: form.phone.trim(),
          businessType: form.businessType,
          referralCode: form.referralCode.trim() || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to create payment invoice")
      }

      // Redirect to Xendit hosted payment page
      window.location.href = data.invoiceUrl
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-5xl">

        {/* Logo Home Link */}
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src="/logo.svg" alt="Payroo POS" className="h-10 w-10 rounded-xl" />
            <div className="leading-tight">
              <span className="font-bold text-xl">Payroo POS</span>
              <span className="block text-[10px] text-muted-foreground">by MOJADOO</span>
            </div>
          </Link>
        </div>

        {/* Hero */}
        <div className="text-center mb-12">
          <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/10">Subscription Plans</Badge>
          <h1 className="text-4xl font-bold tracking-tight mb-3">Simple, Transparent Pricing</h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Choose the plan that fits your business. Pay monthly via GCash, Maya, credit card, and more.
          </p>
          <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-green-500" />
            Secured by Xendit — trusted Philippine payment gateway
          </div>
        </div>

        {/* Plans Grid */}
        <div className={`grid gap-6 ${
          plans.length === 1 ? "max-w-sm mx-auto" :
          plans.length === 2 ? "md:grid-cols-2 max-w-2xl mx-auto" :
          "md:grid-cols-3"
        }`}>
          {plans.map(plan => {
            const isPopular = plan.tier === POPULAR_TIER
            return (
              <div key={plan.id} className="relative flex flex-col">
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <span className="bg-yellow-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow">
                      ⭐ Most Popular
                    </span>
                  </div>
                )}
                <Card className={`flex flex-col h-full bg-gradient-to-b ${TIER_GRADIENT[plan.tier]} ${isPopular ? "ring-2 ring-yellow-400 shadow-lg" : ""}`}>
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-2 mb-1">
                      {TIER_ICONS[plan.tier]}
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                    </div>
                    <CardDescription className="text-sm">{plan.description}</CardDescription>
                    <div className="mt-3">
                      {plan.price === 0 ? (
                        <span className="text-4xl font-extrabold text-green-600">FREE</span>
                      ) : (
                        <>
                          <span className="text-4xl font-extrabold">₱{plan.price.toLocaleString()}</span>
                          <span className="text-muted-foreground text-sm ml-1">/month</span>
                        </>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col flex-1 space-y-4">
                    <ul className="space-y-2 flex-1">
                      {(Object.keys(FEATURE_LABELS) as (keyof SubscriptionFeatures)[]).map(f => (
                        <li key={f} className="flex items-center gap-2 text-sm">
                          {plan.features[f]
                            ? <Check className="h-4 w-4 text-green-500 shrink-0" />
                            : <X className="h-4 w-4 text-muted-foreground shrink-0" />}
                          <span className={plan.features[f] ? "text-foreground" : "text-muted-foreground line-through"}>
                            {FEATURE_LABELS[f]}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="w-full"
                      variant={isPopular ? "default" : "outline"}
                      onClick={() => openCheckout(plan)}
                    >
                      {plan.price === 0 ? "Get Started Free" : "Subscribe Now"} <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )
          })}
        </div>

        {/* Trust badges */}
        <div className="mt-16 grid gap-6 md:grid-cols-3 text-center">
          {[
            { icon: "🔒", title: "Secure Payments", desc: "Powered by Xendit. Pay via GCash, Maya, credit/debit card, OTC, and more." },
            { icon: "📱", title: "Works on Any Device", desc: "Use on mobile, tablet, or desktop. Install as a PWA app offline-ready." },
            { icon: "🤝", title: "Local Support", desc: "Filipino-built POS system. Support in English & Filipino." },
          ].map(item => (
            <div key={item.title} className="space-y-2">
              <div className="text-3xl">{item.icon}</div>
              <h3 className="font-semibold">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <p className="text-sm text-muted-foreground">
            Questions? Email us at{" "}
            <a href="mailto:support@payroo.xyz" className="text-primary underline underline-offset-2">
              support@payroo.xyz
            </a>
          </p>
        </div>
      </div>

      {/* ── Checkout Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={v => { if (!submitting) setDialogOpen(v) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedPlan && TIER_ICONS[selectedPlan.tier]}
              Subscribe to {selectedPlan?.name} Plan
            </DialogTitle>
            <DialogDescription>
              {selectedPlan?.price === 0 ? "Free forever • No credit card required" : `₱${selectedPlan?.price.toLocaleString()}/month`} • Fill in your details to proceed{selectedPlan?.price === 0 ? "" : " to payment"}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label htmlFor="ownerName">Full Name <span className="text-destructive">*</span></Label>
              <Input
                id="ownerName"
                placeholder="Juan dela Cruz"
                value={form.ownerName}
                onChange={e => setForm(f => ({ ...f, ownerName: e.target.value }))}
                disabled={submitting}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="ownerEmail">Email Address <span className="text-destructive">*</span></Label>
              <Input
                id="ownerEmail"
                type="email"
                placeholder="juan@email.com"
                value={form.ownerEmail}
                onChange={e => setForm(f => ({ ...f, ownerEmail: e.target.value }))}
                disabled={submitting}
                required
              />
              <p className="text-xs text-muted-foreground">Payment receipt will be sent here</p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="storeName">Store / Business Name <span className="text-destructive">*</span></Label>
              <Input
                id="storeName"
                placeholder="Juan's Sari-Sari Store"
                value={form.storeName}
                onChange={e => setForm(f => ({ ...f, storeName: e.target.value }))}
                disabled={submitting}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="businessType">Business Type <span className="text-destructive">*</span></Label>
              <Select value={form.businessType} onValueChange={v => setForm(f => ({ ...f, businessType: v }))} disabled={submitting}>
                <SelectTrigger id="businessType"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {BUSINESS_TYPE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">This sets up your POS labels and categories</p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="phone">Phone Number <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                id="phone"
                type="tel"
                placeholder="09XX XXX XXXX"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                disabled={submitting}
              />
            </div>

            {/* Referral code */}
            {refCode && (
              <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                🎁 Referral code applied: <span className="font-mono font-bold">{refCode}</span>
              </div>
            )}

            {/* Order summary */}
            <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{selectedPlan?.name} Plan{selectedPlan?.price === 0 ? "" : " (1 month)"}</span>
                <span className="font-medium">{selectedPlan?.price === 0 ? "FREE" : `₱${selectedPlan?.price.toLocaleString()}`}</span>
              </div>
              <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                <span>Total</span>
                <span className="text-primary">{selectedPlan?.price === 0 ? "FREE" : `₱${selectedPlan?.price.toLocaleString()}`}</span>
              </div>
            </div>

            {selectedPlan?.price === 0 ? (
              <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                🎉 No payment required! You'll get instant access to all FREE plan features.
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-green-500 shrink-0" />
                You'll be redirected to Xendit's secure payment page. Accepts GCash, Maya, cards & more.
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={submitting}>
                {submitting
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
                  : selectedPlan?.price === 0
                  ? <><ArrowRight className="h-4 w-4 mr-2" /> Get Started Free</>
                  : <><ArrowRight className="h-4 w-4 mr-2" /> Pay ₱{selectedPlan?.price.toLocaleString()}</>
                }
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function SubscriptionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <SubscriptionContent />
    </Suspense>
  )
}
