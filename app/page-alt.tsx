"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { HomeNavbar } from "@/components/home-navbar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Store, Package, TrendingUp, Smartphone, Users, Zap, Heart,
  Check, ArrowRight, Star, Wifi, Lock, Brain, Globe, Loader2,
  Barcode, Gift, Rocket, Shield, Sparkles, Crown, Target
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { getStoreId } from "@/lib/store-id"
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
    fetch("/api/management/plans")
      .then(r => r.json())
      .then(({ data: p }) => setPlans((p ?? []).filter((pl: any) => pl.isActive)))
      .finally(() => setPlansLoading(false))
  }, [])

  if (loading || user) return null

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden relative">
      <PWAInstallPrompt />
      
      {/* Animated Grid Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-yellow-500/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-[120px] animate-pulse animation-delay-2000" />
      </div>

      <HomeNavbar />

      {/* Hero - Glassmorphism Style */}
      <section className="pt-32 pb-24 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center space-y-8 mb-16">
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/5 backdrop-blur-xl border border-white/10">
              <Sparkles className="h-4 w-4 text-yellow-400" />
              <span className="text-sm font-semibold bg-gradient-to-r from-yellow-400 to-amber-400 bg-clip-text text-transparent">
                Next-Gen POS for Filipino Businesses
              </span>
            </div>

            <h1 className="text-6xl md:text-8xl font-black tracking-tight">
              <span className="block mb-2">Your Store,</span>
              <span className="bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400 bg-clip-text text-transparent">
                Supercharged
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-slate-400 max-w-3xl mx-auto leading-relaxed">
              The most powerful POS system for sari-sari stores, salons & SMEs. 
              <span className="text-white font-semibold"> No hardware. No hassle.</span> Just results.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link href="/subscription">
                <Button size="lg" className="gap-2 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-bold text-lg px-10 h-16 shadow-[0_0_30px_rgba(251,191,36,0.5)] hover:shadow-[0_0_50px_rgba(251,191,36,0.7)] transition-all">
                  <Rocket className="h-6 w-6" /> Launch Your Store
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="border-2 border-white/20 bg-white/5 backdrop-blur-xl hover:bg-white/10 text-white text-lg px-10 h-16">
                  Staff Login
                </Button>
              </Link>
            </div>
          </div>

          {/* Feature Pills */}
          <div className="flex flex-wrap justify-center gap-4 mb-16">
            {[
              { icon: <Wifi className="h-4 w-4" />, text: "Works Offline", color: "from-green-500 to-emerald-500" },
              { icon: <Shield className="h-4 w-4" />, text: "Bank-Level Security", color: "from-blue-500 to-cyan-500" },
              { icon: <Zap className="h-4 w-4" />, text: "5-Min Setup", color: "from-purple-500 to-pink-500" },
              { icon: <Target className="h-4 w-4" />, text: "AI-Powered", color: "from-orange-500 to-red-500" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 px-6 py-3 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 hover:bg-white/10 transition-all group">
                <div className={`bg-gradient-to-r ${item.color} p-2 rounded-full`}>
                  {item.icon}
                </div>
                <span className="font-medium">{item.text}</span>
              </div>
            ))}
          </div>

          {/* 3D Feature Cards */}
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { 
                icon: <Barcode className="h-12 w-12" />, 
                title: "Phone = Scanner", 
                desc: "Turn your camera into a barcode scanner. No expensive hardware needed.",
                gradient: "from-yellow-500/20 to-amber-500/20",
                glow: "shadow-[0_0_50px_rgba(251,191,36,0.3)]"
              },
              { 
                icon: <Brain className="h-12 w-12" />, 
                title: "AI Predictions", 
                desc: "Smart restocking suggestions based on your sales patterns.",
                gradient: "from-blue-500/20 to-cyan-500/20",
                glow: "shadow-[0_0_50px_rgba(59,130,246,0.3)]"
              },
              { 
                icon: <Smartphone className="h-12 w-12" />, 
                title: "E-Wallet Ready", 
                desc: "Accept GCash, Maya & cards instantly. Track everything.",
                gradient: "from-green-500/20 to-emerald-500/20",
                glow: "shadow-[0_0_50px_rgba(34,197,94,0.3)]"
              },
            ].map((card, i) => (
              <div key={i} className={`group relative ${card.glow} hover:scale-105 transition-all duration-300`}>
                <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} rounded-2xl blur-xl opacity-50 group-hover:opacity-100 transition-opacity`} />
                <Card className="relative bg-slate-900/50 backdrop-blur-xl border-white/10 p-8 hover:border-white/30 transition-all">
                  <div className="text-white mb-6">{card.icon}</div>
                  <h3 className="text-2xl font-bold mb-3">{card.title}</h3>
                  <p className="text-slate-400">{card.desc}</p>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats - Neon Style */}
      <section className="py-20 px-4 border-y border-white/10">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: "105+", label: "Active Stores", color: "text-yellow-400" },
              { value: "₱3M+", label: "Transactions", color: "text-green-400" },
              { value: "99.9%", label: "Uptime", color: "text-blue-400" },
              { value: "24/7", label: "Support", color: "text-purple-400" },
            ].map((stat, i) => (
              <div key={i} className="text-center group">
                <div className={`text-5xl md:text-6xl font-black ${stat.color} mb-3 group-hover:scale-110 transition-transform`}>
                  {stat.value}
                </div>
                <div className="text-slate-400 text-sm uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid - Neon Cards */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <Badge className="mb-6 bg-white/10 backdrop-blur-xl border-white/20 text-white hover:bg-white/20 text-sm px-6 py-2">
              Complete Toolkit
            </Badge>
            <h2 className="text-5xl md:text-6xl font-black mb-6">
              Everything You Need.
              <br />
              <span className="bg-gradient-to-r from-yellow-400 to-amber-400 bg-clip-text text-transparent">
                Nothing You Don't.
              </span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: <Store />, title: "Lightning POS", desc: "Process sales in seconds", color: "yellow" },
              { icon: <Package />, title: "Smart Inventory", desc: "Real-time stock tracking", color: "blue" },
              { icon: <TrendingUp />, title: "Analytics", desc: "Profit insights at a glance", color: "green" },
              { icon: <Heart />, title: "Loyalty Program", desc: "Reward repeat customers", color: "pink" },
              { icon: <Users />, title: "Multi-User", desc: "Team management made easy", color: "purple" },
              { icon: <Globe />, title: "Market Intel", desc: "See what's trending", color: "orange" },
            ].map((feature, i) => (
              <div key={i} className="group relative">
                <div className={`absolute inset-0 bg-${feature.color}-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity`} />
                <Card className="relative bg-slate-900/50 backdrop-blur-xl border-white/10 p-6 hover:border-white/30 transition-all hover:-translate-y-2">
                  <div className="text-white mb-4 group-hover:scale-110 transition-transform">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                  <p className="text-slate-400 text-sm">{feature.desc}</p>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Affiliate - Gradient Box */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-500 rounded-3xl blur-2xl opacity-50 group-hover:opacity-75 transition-opacity" />
            <div className="relative bg-gradient-to-br from-green-600 to-emerald-600 rounded-3xl p-12 md:p-16 text-center space-y-8 border border-white/20">
              <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/20 backdrop-blur-xl">
                <Gift className="h-5 w-5" />
                <span className="font-bold">Affiliate Program</span>
              </div>
              <h2 className="text-5xl md:text-6xl font-black">
                Earn ₱150 Per Referral
              </h2>
              <p className="text-xl md:text-2xl text-green-50 max-w-2xl mx-auto">
                Share Payroo POS. Get paid. Unlimited earnings. Withdraw via GCash anytime.
              </p>
              <Link href="/affiliate">
                <Button size="lg" className="gap-2 bg-white text-green-600 hover:bg-green-50 text-lg px-10 h-16 shadow-2xl font-bold">
                  <Crown className="h-6 w-6" /> Become an Affiliate
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing - Glass Cards */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <Badge className="mb-6 bg-white/10 backdrop-blur-xl border-white/20 text-white hover:bg-white/20 text-sm px-6 py-2">
              Simple Pricing
            </Badge>
            <h2 className="text-5xl md:text-6xl font-black mb-6">
              Choose Your Power Level
            </h2>
          </div>

          {plansLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-yellow-400" />
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {plans.map(plan => {
                const isGold = plan.tier === "gold"
                return (
                  <div key={plan.id} className={`relative group ${isGold ? "scale-105" : ""}`}>
                    {isGold && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                        <div className="bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-black text-xs px-6 py-2 rounded-full shadow-[0_0_30px_rgba(251,191,36,0.5)]">
                          ⭐ MOST POPULAR
                        </div>
                      </div>
                    )}
                    <div className={`absolute inset-0 bg-gradient-to-br ${isGold ? "from-yellow-500/20 to-amber-500/20" : "from-slate-500/20 to-slate-600/20"} rounded-3xl blur-2xl opacity-50 group-hover:opacity-100 transition-opacity`} />
                    <Card className={`relative bg-slate-900/50 backdrop-blur-xl border-white/10 p-8 hover:border-white/30 transition-all ${isGold ? "border-yellow-500/50" : ""}`}>
                      <div className="mb-8">
                        <h3 className="text-3xl font-black mb-3">{plan.name}</h3>
                        <p className="text-slate-400">{plan.description}</p>
                      </div>
                      <div className="mb-8">
                        {plan.price === 0 ? (
                          <div className="text-6xl font-black bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                            FREE
                          </div>
                        ) : (
                          <div>
                            <span className="text-6xl font-black">₱{plan.price.toLocaleString()}</span>
                            <span className="text-slate-400 text-xl">/mo</span>
                          </div>
                        )}
                      </div>
                      <ul className="space-y-4 mb-8">
                        {Object.entries(plan.features).filter(([, v]) => v).map(([k]) => (
                          <li key={k} className="flex items-center gap-3">
                            <div className="h-6 w-6 rounded-full bg-green-500/20 flex items-center justify-center">
                              <Check className="h-4 w-4 text-green-400" />
                            </div>
                            <span className="text-sm">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                          </li>
                        ))}
                      </ul>
                      <Link href="/subscription">
                        <Button className={`w-full h-14 text-lg font-bold ${isGold ? "bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black shadow-[0_0_30px_rgba(251,191,36,0.3)]" : "bg-white/10 hover:bg-white/20"}`}>
                          Get Started <ArrowRight className="h-5 w-5 ml-2" />
                        </Button>
                      </Link>
                    </Card>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-500 to-amber-500 rounded-3xl blur-3xl opacity-30 group-hover:opacity-50 transition-opacity" />
            <div className="relative bg-slate-900/80 backdrop-blur-xl border border-white/20 rounded-3xl p-12 md:p-16 text-center space-y-8">
              <h2 className="text-5xl md:text-6xl font-black">
                Ready to Level Up?
              </h2>
              <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                Join 105+ Filipino stores already using Payroo POS to grow their business.
              </p>
              <Link href="/subscription">
                <Button size="lg" className="gap-2 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-bold text-lg px-12 h-16 shadow-[0_0_40px_rgba(251,191,36,0.5)]">
                  <Rocket className="h-6 w-6" /> Start Free Now
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img src="/logo.svg" alt="Payroo" className="h-8 w-8 rounded" />
                <span className="font-black text-xl">Payroo POS</span>
              </div>
              <p className="text-sm text-slate-400">Next-gen POS for Filipino SMEs</p>
            </div>
            <div>
              <h4 className="font-bold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><Link href="/subscription" className="hover:text-white">Pricing</Link></li>
                <li><Link href="/affiliate" className="hover:text-white">Affiliate</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="mailto:support@payroo.xyz" className="hover:text-white">Email</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Login</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><Link href="/dashboard" className="hover:text-white">Owner</Link></li>
                <li><Link href="/login" className="hover:text-white">Staff</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 text-center text-sm text-slate-400">
            <p>© 2024 Payroo POS by <span className="font-bold text-white">MOJADOO</span></p>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        .animation-delay-2000 {
          animation-delay: 2s;
        }
      `}</style>
    </div>
  )
}
