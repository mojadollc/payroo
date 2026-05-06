"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { HomeNavbar } from "@/components/home-navbar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Store, Package, TrendingUp, Smartphone, Users, Zap, Heart,
  Check, ArrowRight, Wifi, Lock, Brain, Globe, Loader2,
  Barcode, Gift, Sparkles, Rocket, Shield, ChevronRight,
  CreditCard, BarChart3, Truck
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { getSubscriptionPlans } from "@/lib/firebase/services"
import { PWAInstallPrompt } from "@/components/pwa-install-prompt"
import type { SubscriptionPlan } from "@/lib/firebase/types"

import { Hero3DScene } from "@/components/hero-3d-scene"

export default function HomePage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [plansLoading, setPlansLoading] = useState(true)

  useEffect(() => {
    if (!loading && user) router.push("/pos")
  }, [user, loading, router])

  useEffect(() => {
    getSubscriptionPlans()
      .then(p => setPlans(p.filter(pl => pl.isActive)))
      .finally(() => setPlansLoading(false))
  }, [])

  if (loading || user) return null

  const featureLabels: Record<string, string> = {
    pos: "Point of Sale",
    inventory: "Inventory Management",
    ewallet: "GCash & Maya Payments",
    reports: "Sales Reports & Analytics",
    loyalty: "Customer Loyalty Program",
    utang: "Credit (Utang) Tracking",
    aiRestock: "AI Restock Suggestions",
    multiUser: "Multi-User & Staff Roles",
    exportData: "Export Data (CSV/PDF)",
    marketIntelligence: "Market Intelligence",
    delivery: "Online Delivery Orders",
  }

  return (
    <div className="min-h-screen bg-[#fafafa] overflow-hidden">
      <PWAInstallPrompt />
      <HomeNavbar />

      {/* ═══════════════════════════════════════════════════════════════════════
          HERO — Split layout: text left, 3D right
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative pt-28 pb-20 lg:pt-36 lg:pb-28 px-4 overflow-hidden">
        <div className="container mx-auto max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Text content */}
            <div className="space-y-7 relative z-10">
              <div className="inline-flex items-center gap-2 bg-yellow-50 border border-yellow-200 px-4 py-2 rounded-full">
                <Sparkles className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800">#1 POS System for Filipino Stores</span>
              </div>

              <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[0.95]">
                <span className="bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-500 bg-clip-text text-transparent">
                  Sell Smarter.
                </span>
                <br />
                <span className="text-slate-900">Grow Faster.</span>
              </h1>

              <p className="text-lg text-slate-600 leading-relaxed max-w-lg">
                The all-in-one POS built for sari-sari stores, salons, carinderia & Filipino SMEs.
                No hardware needed — just your phone.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Link href="/subscription">
                  <Button size="lg" className="gap-2 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white font-bold shadow-lg shadow-yellow-500/20 text-base px-8 h-13 rounded-xl">
                    <Rocket className="h-5 w-5" /> Start Free Trial
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-50 text-base px-8 h-13 rounded-xl">
                    Staff Login <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>

              {/* Trust badges */}
              <div className="flex items-center gap-6 pt-4 flex-wrap">
                {[
                  { icon: <Wifi className="h-4 w-4 text-emerald-500" />, text: "Works Offline" },
                  { icon: <Shield className="h-4 w-4 text-blue-500" />, text: "Secure" },
                  { icon: <Zap className="h-4 w-4 text-amber-500" />, text: "5-Min Setup" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-slate-500">
                    {item.icon}
                    <span className="text-sm font-medium">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: 3D Scene */}
            <div className="relative h-[500px] lg:h-[600px]">
              <Hero3DScene />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SOCIAL PROOF — Metrics strip
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-16 px-4 border-b border-slate-100">
        <div className="container mx-auto max-w-5xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: "105+", label: "Active Stores" },
              { value: "₱3M+", label: "Processed" },
              { value: "99.9%", label: "Uptime" },
              { value: "24/7", label: "Support" },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl md:text-4xl font-black text-slate-900">{stat.value}</div>
                <div className="text-sm text-slate-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          FEATURES — Clean grid with icons
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16 space-y-4">
            <Badge className="bg-yellow-50 text-yellow-800 border-yellow-200 hover:bg-yellow-50">Features</Badge>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900">
              Everything your store needs
            </h2>
            <p className="text-lg text-slate-500 max-w-xl mx-auto">
              From checkout to analytics — one platform to run your entire business.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: <Store className="h-5 w-5" />, title: "Lightning POS", desc: "Scan barcodes & process sales in seconds", color: "bg-yellow-500" },
              { icon: <Package className="h-5 w-5" />, title: "Smart Inventory", desc: "Real-time stock tracking with low-stock alerts", color: "bg-blue-500" },
              { icon: <BarChart3 className="h-5 w-5" />, title: "Sales Analytics", desc: "Profit, trends & insights at a glance", color: "bg-emerald-500" },
              { icon: <Heart className="h-5 w-5" />, title: "Loyalty Program", desc: "Reward customers with points & QR cards", color: "bg-pink-500" },
              { icon: <Users className="h-5 w-5" />, title: "Multi-User", desc: "Staff roles & cashier permissions", color: "bg-violet-500" },
              { icon: <CreditCard className="h-5 w-5" />, title: "E-Wallet", desc: "GCash & Maya cash-in/cash-out", color: "bg-cyan-500" },
              { icon: <Brain className="h-5 w-5" />, title: "AI Restock", desc: "Smart predictions on what to order next", color: "bg-orange-500" },
              { icon: <Globe className="h-5 w-5" />, title: "Market Intel", desc: "See what's trending in your area", color: "bg-indigo-500" },
              { icon: <Truck className="h-5 w-5" />, title: "Delivery Orders", desc: "Accept online orders from customers", color: "bg-teal-500" },
            ].map((f, i) => (
              <div key={i} className="group flex items-start gap-4 p-5 rounded-2xl border border-slate-100 bg-white hover:shadow-lg hover:border-slate-200 transition-all duration-300">
                <div className={`${f.color} h-10 w-10 rounded-xl flex items-center justify-center text-white shrink-0`}>
                  {f.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-0.5">{f.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          HOW IT WORKS — 3 steps
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-4 bg-white border-y border-slate-100">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16 space-y-4">
            <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-50">How It Works</Badge>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900">
              Up and running in minutes
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "Subscribe", desc: "Pick a plan and create your store account in under 2 minutes." },
              { step: "02", title: "Add Products", desc: "Scan barcodes or type them in. Import from CSV if you have many." },
              { step: "03", title: "Start Selling", desc: "Open the POS, scan items, accept payments. That's it." },
            ].map((s, i) => (
              <div key={i} className="text-center space-y-4">
                <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-500 text-slate-900 font-black text-lg shadow-lg shadow-yellow-500/20">
                  {s.step}
                </div>
                <h3 className="text-xl font-bold text-slate-900">{s.title}</h3>
                <p className="text-slate-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          PRICING — Minimal professional cards
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-4" id="pricing">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-14 space-y-4">
            <Badge className="bg-yellow-50 text-yellow-800 border-yellow-200 hover:bg-yellow-50">Pricing</Badge>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900">
              Simple, transparent pricing
            </h2>
            <p className="text-lg text-slate-500">No hidden fees. No contracts. Cancel anytime.</p>
          </div>

          {plansLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {plans.map(plan => {
                const isGold = plan.tier === "gold"
                const enabledFeatures = Object.entries(plan.features).filter(([, v]) => v)
                const disabledFeatures = Object.entries(plan.features).filter(([, v]) => !v)

                return (
                  <div key={plan.id} className={`relative rounded-3xl overflow-hidden ${
                    isGold
                      ? "bg-gradient-to-b from-slate-900 to-slate-800 text-white shadow-2xl shadow-slate-900/20"
                      : "bg-white border border-slate-200 shadow-sm"
                  }`}>
                    {isGold && (
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400" />
                    )}
                    <div className="p-8">
                      {/* Plan name */}
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h3 className={`text-lg font-bold ${isGold ? "text-white" : "text-slate-900"}`}>{plan.name}</h3>
                          <p className={`text-sm mt-0.5 ${isGold ? "text-slate-400" : "text-slate-500"}`}>{plan.description}</p>
                        </div>
                        {isGold && (
                          <Badge className="bg-yellow-400/20 text-yellow-300 border-yellow-400/30 hover:bg-yellow-400/20">Popular</Badge>
                        )}
                      </div>

                      {/* Price */}
                      <div className="mb-8">
                        {plan.price === 0 ? (
                          <div className="flex items-baseline gap-2">
                            <span className={`text-5xl font-black ${isGold ? "text-white" : "text-slate-900"}`}>Free</span>
                            <span className={`text-sm ${isGold ? "text-slate-400" : "text-slate-500"}`}>forever</span>
                          </div>
                        ) : (
                          <div className="flex items-baseline gap-1">
                            <span className={`text-lg font-medium ${isGold ? "text-slate-400" : "text-slate-500"}`}>₱</span>
                            <span className={`text-5xl font-black ${isGold ? "text-white" : "text-slate-900"}`}>{plan.price.toLocaleString()}</span>
                            <span className={`text-sm ${isGold ? "text-slate-400" : "text-slate-500"}`}>/month</span>
                          </div>
                        )}
                      </div>

                      {/* CTA */}
                      <Link href="/subscription">
                        <Button className={`w-full h-12 rounded-xl font-semibold text-base mb-8 ${
                          isGold
                            ? "bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-slate-900 shadow-lg shadow-yellow-500/20"
                            : "bg-slate-900 hover:bg-slate-800 text-white"
                        }`}>
                          {plan.price === 0 ? "Get Started Free" : "Subscribe Now"}
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </Link>

                      {/* Features */}
                      <div className={`space-y-3 pt-6 border-t ${isGold ? "border-slate-700" : "border-slate-100"}`}>
                        <p className={`text-xs font-semibold uppercase tracking-wider mb-4 ${isGold ? "text-slate-400" : "text-slate-400"}`}>
                          What&apos;s included
                        </p>
                        {enabledFeatures.map(([k]) => (
                          <div key={k} className="flex items-center gap-3">
                            <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${isGold ? "bg-yellow-400/20" : "bg-emerald-100"}`}>
                              <Check className={`h-3 w-3 ${isGold ? "text-yellow-400" : "text-emerald-600"}`} />
                            </div>
                            <span className={`text-sm ${isGold ? "text-slate-300" : "text-slate-700"}`}>{featureLabels[k] || k}</span>
                          </div>
                        ))}
                        {disabledFeatures.map(([k]) => (
                          <div key={k} className="flex items-center gap-3 opacity-40">
                            <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${isGold ? "bg-slate-700" : "bg-slate-100"}`}>
                              <span className="text-[10px]">✕</span>
                            </div>
                            <span className={`text-sm line-through ${isGold ? "text-slate-500" : "text-slate-400"}`}>{featureLabels[k] || k}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Trust */}
          <div className="flex items-center justify-center gap-8 mt-12 text-sm text-slate-400 flex-wrap">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              <span>Secure payment</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              <span>Instant activation</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          AFFILIATE — Clean banner
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 px-4 bg-gradient-to-br from-emerald-600 to-teal-700 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto max-w-4xl relative z-10 text-center space-y-6">
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm px-5 py-2 rounded-full">
            <Gift className="h-4 w-4 text-white" />
            <span className="text-sm font-semibold text-white">Affiliate Program</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-white">
            Earn ₱150 per referral
          </h2>
          <p className="text-lg text-white/80 max-w-2xl mx-auto">
            Share Payroo with store owners. Get ₱150 for every subscription. Unlimited earnings, withdraw via GCash.
          </p>
          <Link href="/affiliate">
            <Button size="lg" className="bg-white text-emerald-700 hover:bg-white/90 font-bold text-base px-8 h-14 rounded-xl shadow-xl">
              <Gift className="h-5 w-5 mr-2" /> Join & Start Earning
            </Button>
          </Link>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          FINAL CTA
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-28 px-4 bg-slate-950 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-yellow-500 rounded-full blur-[200px]" />
        </div>
        <div className="container mx-auto max-w-3xl text-center relative z-10 space-y-8">
          <h2 className="text-4xl md:text-6xl font-black text-white leading-tight">
            Ready to modernize<br />your store?
          </h2>
          <p className="text-lg text-slate-400 max-w-xl mx-auto">
            Join 105+ Filipino store owners already using Payroo POS to grow their business.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/subscription">
              <Button size="lg" className="gap-2 bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-slate-900 font-bold text-base px-10 h-14 rounded-xl shadow-lg shadow-yellow-500/20">
                <Rocket className="h-5 w-5" /> Start Free Today
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 text-base px-10 h-14 rounded-xl">
                Staff Login
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════════════════════════════════════ */}
      <footer className="border-t border-slate-100 py-12 px-4 bg-white">
        <div className="container mx-auto max-w-5xl">
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <img src="/logo.svg" alt="Payroo" className="h-8 w-8 rounded-lg" />
                <span className="font-black text-lg text-slate-900">Payroo POS</span>
              </div>
              <p className="text-sm text-slate-500">Built for Filipino SMEs.<br />by MOJADOO</p>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 mb-3 text-sm">Product</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><Link href="/subscription" className="hover:text-slate-900 transition-colors">Pricing</Link></li>
                <li><Link href="/affiliate" className="hover:text-slate-900 transition-colors">Affiliate</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 mb-3 text-sm">Support</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><a href="mailto:support@payroo.xyz" className="hover:text-slate-900 transition-colors">Email Support</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 mb-3 text-sm">Account</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><Link href="/dashboard" className="hover:text-slate-900 transition-colors">Owner Login</Link></li>
                <li><Link href="/login" className="hover:text-slate-900 transition-colors">Staff Login</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-8 text-center text-sm text-slate-400">
            <p>© {new Date().getFullYear()} Payroo POS by MOJADOO. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
