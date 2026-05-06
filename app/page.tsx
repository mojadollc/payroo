"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { HomeNavbar } from "@/components/home-navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Store, Package, TrendingUp, Smartphone, Users, Zap, Heart,
  Check, ArrowRight, Star, Wifi, Lock, Brain, Globe, Loader2,
  Barcode, ScanLine, Gift, DollarSign, Sparkles, Rocket, Shield
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { getSubscriptionPlans } from "@/lib/firebase/services"
import { PWAInstallPrompt } from "@/components/pwa-install-prompt"
import type { SubscriptionPlan } from "@/lib/firebase/types"

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50/30 overflow-hidden">
      <PWAInstallPrompt />
      <HomeNavbar />

      {/* Animated Background Blobs */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-40 w-96 h-96 bg-yellow-200/30 rounded-full blur-3xl animate-blob" />
        <div className="absolute top-0 -right-40 w-96 h-96 bg-amber-200/30 rounded-full blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute -bottom-40 left-1/2 w-96 h-96 bg-orange-200/20 rounded-full blur-3xl animate-blob animation-delay-4000" />
      </div>

      {/* Hero - Unique Split Design */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Content */}
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-100 to-amber-100 border border-yellow-300 px-4 py-2 rounded-full">
                <Sparkles className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-semibold text-yellow-900">#1 POS for Filipino Stores</span>
              </div>
              
              <h1 className="text-6xl md:text-7xl font-black tracking-tight">
                <span className="bg-gradient-to-r from-yellow-600 via-amber-500 to-orange-500 bg-clip-text text-transparent">
                  Sell Smarter.
                </span>
                <br />
                <span className="text-slate-900">Grow Faster.</span>
              </h1>

              <p className="text-xl text-slate-600 leading-relaxed">
                The all-in-one POS system designed for sari-sari stores, salons, carinderia & Filipino SMEs. 
                <span className="font-semibold text-slate-900"> No hardware needed</span> — just your phone.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/subscription">
                  <Button size="lg" className="gap-2 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white shadow-lg shadow-yellow-500/30 text-lg px-8 h-14">
                    <Rocket className="h-5 w-5" /> Start Free Trial
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline" className="border-2 text-lg px-8 h-14">
                    Staff Login
                  </Button>
                </Link>
              </div>

              <div className="flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                    <Wifi className="h-5 w-5 text-green-600" />
                  </div>
                  <span className="text-sm font-medium text-slate-700">Works Offline</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-blue-600" />
                  </div>
                  <span className="text-sm font-medium text-slate-700">Bank-Level Security</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <Zap className="h-5 w-5 text-purple-600" />
                  </div>
                  <span className="text-sm font-medium text-slate-700">Setup in 5 Minutes</span>
                </div>
              </div>
            </div>

            {/* Right: Floating Feature Cards */}
            <div className="relative h-[600px] hidden lg:block">
              <div className="absolute top-0 right-0 w-72 animate-float">
                <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200 shadow-xl">
                  <CardContent className="p-6">
                    <div className="h-12 w-12 rounded-xl bg-yellow-500 flex items-center justify-center mb-4">
                      <Barcode className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="font-bold text-lg mb-2">Phone = Scanner</h3>
                    <p className="text-sm text-slate-600">Use your camera to scan barcodes. No hardware needed!</p>
                  </CardContent>
                </Card>
              </div>

              <div className="absolute top-32 right-20 w-64 animate-float animation-delay-1000">
                <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200 shadow-xl">
                  <CardContent className="p-6">
                    <div className="h-12 w-12 rounded-xl bg-blue-500 flex items-center justify-center mb-4">
                      <Brain className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="font-bold text-lg mb-2">AI Restock</h3>
                    <p className="text-sm text-slate-600">Smart predictions tell you what to order next.</p>
                  </CardContent>
                </Card>
              </div>

              <div className="absolute top-64 right-8 w-72 animate-float animation-delay-2000">
                <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 shadow-xl">
                  <CardContent className="p-6">
                    <div className="h-12 w-12 rounded-xl bg-green-500 flex items-center justify-center mb-4">
                      <Smartphone className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="font-bold text-lg mb-2">GCash & Maya</h3>
                    <p className="text-sm text-slate-600">Accept e-wallet payments instantly.</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="py-12 px-4 bg-slate-900 text-white">
        <div className="container mx-auto max-w-5xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-black text-yellow-400 mb-2">500+</div>
              <div className="text-sm text-slate-400">Active Stores</div>
            </div>
            <div>
              <div className="text-4xl font-black text-yellow-400 mb-2">₱10M+</div>
              <div className="text-sm text-slate-400">Transactions</div>
            </div>
            <div>
              <div className="text-4xl font-black text-yellow-400 mb-2">99.9%</div>
              <div className="text-sm text-slate-400">Uptime</div>
            </div>
            <div>
              <div className="text-4xl font-black text-yellow-400 mb-2">24/7</div>
              <div className="text-sm text-slate-400">Support</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features - Bento Grid Style */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-yellow-100 text-yellow-900 hover:bg-yellow-100 border-yellow-300">Everything You Need</Badge>
            <h2 className="text-5xl font-black tracking-tight mb-4">One Platform. Infinite Possibilities.</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">From checkout to inventory to customer loyalty — we've got you covered.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: <Store className="h-8 w-8" />, title: "Lightning POS", desc: "Process sales in seconds with barcode scanning", color: "from-yellow-500 to-amber-500" },
              { icon: <Package className="h-8 w-8" />, title: "Smart Inventory", desc: "Track stock in real-time with low-stock alerts", color: "from-blue-500 to-cyan-500" },
              { icon: <TrendingUp className="h-8 w-8" />, title: "Sales Analytics", desc: "See profit, trends & insights at a glance", color: "from-green-500 to-emerald-500" },
              { icon: <Heart className="h-8 w-8" />, title: "Loyalty Program", desc: "Reward customers with points & QR cards", color: "from-pink-500 to-rose-500" },
              { icon: <Users className="h-8 w-8" />, title: "Multi-User", desc: "Add cashiers & staff with role permissions", color: "from-purple-500 to-violet-500" },
              { icon: <Globe className="h-8 w-8" />, title: "Market Intel", desc: "See what's trending in your city", color: "from-orange-500 to-red-500" },
            ].map((f, i) => (
              <Card key={i} className="group hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-2 hover:border-yellow-300">
                <CardContent className="p-8">
                  <div className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-6 text-white group-hover:scale-110 transition-transform`}>
                    {f.icon}
                  </div>
                  <h3 className="font-bold text-xl mb-3">{f.title}</h3>
                  <p className="text-slate-600">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Affiliate CTA - Bold Design */}
      <section className="py-20 px-4 bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-20" />
        <div className="container mx-auto max-w-5xl relative z-10">
          <div className="text-center space-y-8">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-6 py-3 rounded-full">
              <Gift className="h-5 w-5" />
              <span className="font-bold">Affiliate Program</span>
            </div>
            <h2 className="text-5xl md:text-6xl font-black">
              Earn ₱150 Per Referral
            </h2>
            <p className="text-xl md:text-2xl opacity-95 max-w-3xl mx-auto">
              Share Payroo POS with store owners you know. Get paid ₱150 for every successful subscription. Unlimited earnings. Withdraw via GCash anytime.
            </p>
            <Link href="/affiliate">
              <Button size="lg" className="gap-2 bg-white text-green-600 hover:bg-white/90 text-lg px-10 h-16 shadow-2xl">
                <Gift className="h-6 w-6" /> Join Affiliate Program
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing - Modern Cards */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-yellow-100 text-yellow-900 hover:bg-yellow-100 border-yellow-300">Pricing</Badge>
            <h2 className="text-5xl font-black tracking-tight mb-4">Choose Your Plan</h2>
            <p className="text-xl text-slate-600">Start free. Upgrade anytime. Cancel anytime.</p>
          </div>

          {plansLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-yellow-500" />
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {plans.map(plan => {
                const isGold = plan.tier === "gold"
                return (
                  <Card key={plan.id} className={`relative overflow-hidden ${isGold ? "ring-4 ring-yellow-400 shadow-2xl scale-105" : "border-2"}`}>
                    {isGold && (
                      <div className="absolute top-0 right-0 bg-gradient-to-br from-yellow-400 to-amber-500 text-white text-xs font-bold px-4 py-1 rounded-bl-lg">
                        ⭐ POPULAR
                      </div>
                    )}
                    <CardContent className="p-8">
                      <div className="mb-6">
                        <h3 className="text-2xl font-black mb-2">{plan.name}</h3>
                        <p className="text-slate-600">{plan.description}</p>
                      </div>
                      <div className="mb-8">
                        {plan.price === 0 ? (
                          <div className="text-5xl font-black text-green-600">FREE</div>
                        ) : (
                          <div>
                            <span className="text-5xl font-black">₱{plan.price.toLocaleString()}</span>
                            <span className="text-slate-500 text-lg">/month</span>
                          </div>
                        )}
                      </div>
                      <ul className="space-y-3 mb-8">
                        {Object.entries(plan.features).filter(([, v]) => v).map(([k]) => (
                          <li key={k} className="flex items-center gap-3">
                            <Check className="h-5 w-5 text-green-500 shrink-0" />
                            <span className="text-sm">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                          </li>
                        ))}
                      </ul>
                      <Link href="/subscription">
                        <Button className={`w-full h-12 text-lg ${isGold ? "bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600" : ""}`}>
                          Get Started <ArrowRight className="h-5 w-5 ml-2" />
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-4 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMDUiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-50" />
        <div className="container mx-auto max-w-4xl text-center relative z-10 space-y-8">
          <h2 className="text-5xl md:text-6xl font-black">
            Ready to Transform Your Store?
          </h2>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Join hundreds of Filipino store owners who've already upgraded to smarter business management.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/subscription">
              <Button size="lg" className="gap-2 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white text-lg px-10 h-16 shadow-2xl">
                <Rocket className="h-6 w-6" /> Start Free Today
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="border-2 border-white text-white hover:bg-white hover:text-slate-900 text-lg px-10 h-16">
                Staff Login
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 px-4 bg-white">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img src="/logo.svg" alt="Payroo" className="h-8 w-8 rounded" />
                <span className="font-black text-xl">Payroo POS</span>
              </div>
              <p className="text-sm text-slate-600">Built for Filipino SMEs</p>
            </div>
            <div>
              <h4 className="font-bold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-slate-600">
                <li><Link href="/subscription" className="hover:text-slate-900">Pricing</Link></li>
                <li><Link href="/affiliate" className="hover:text-slate-900">Affiliate</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-slate-600">
                <li><a href="mailto:support@payroo.xyz" className="hover:text-slate-900">Email Support</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Login</h4>
              <ul className="space-y-2 text-sm text-slate-600">
                <li><Link href="/dashboard" className="hover:text-slate-900">Owner Login</Link></li>
                <li><Link href="/login" className="hover:text-slate-900">Staff Login</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-8 text-center text-sm text-slate-600">
            <p>© 2024 Payroo POS by <span className="font-bold">MOJADOO</span></p>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animation-delay-1000 {
          animation-delay: 1s;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  )
}
