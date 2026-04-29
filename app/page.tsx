"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { HomeNavbar } from "@/components/home-navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Store, Package, TrendingUp, Smartphone, Users, Zap, Heart,
  Check, X, ArrowRight, Star, Wifi, Lock, Brain, Globe, Building2, Loader2,
  Barcode, ScanLine, Gift, DollarSign
} from "lucide-react"
import { BUSINESS_TYPE_OPTIONS } from "@/lib/business-config"
import { useAuth } from "@/hooks/use-auth"
import { getSubscriptionPlans } from "@/lib/firebase/services"
import { PWAInstallPrompt } from "@/components/pwa-install-prompt"
import type { SubscriptionPlan, SubscriptionFeatures, SubscriptionTier } from "@/lib/firebase/types"

const FEATURES = [
  { icon: <Store className="h-6 w-6" />, title: "Fast POS System", desc: "Lightning-quick checkout with barcode scanning, multiple payment methods, and offline support." },
  { icon: <Package className="h-6 w-6" />, title: "Smart Inventory", desc: "Real-time stock tracking, low-stock alerts, and automatic reorder suggestions powered by AI." },
  { icon: <TrendingUp className="h-6 w-6" />, title: "Sales Reports", desc: "Detailed profit analysis, daily/monthly reports, and business insights at a glance." },
  { icon: <Smartphone className="h-6 w-6" />, title: "E-Wallet Integration", desc: "Accept GCash, Maya, and card payments. Track commissions and payouts automatically." },
  { icon: <Heart className="h-6 w-6" />, title: "Loyalty Program", desc: "Build customer loyalty with points, rewards, and QR-based membership tracking." },
  { icon: <Users className="h-6 w-6" />, title: "Multi-User Access", desc: "Manage cashiers, sub-admins, and staff with role-based permissions." },
  { icon: <Brain className="h-6 w-6" />, title: "AI Restock Engine", desc: "Predictive analytics suggest what to order based on sales trends." },
  { icon: <Globe className="h-6 w-6" />, title: "Market Intelligence", desc: "See what's trending in your city and across the network anonymously." },
  { icon: <Barcode className="h-6 w-6" />, title: "Barcode Generator", desc: "Generate barcodes instantly for products with no barcode. No label printer needed — print or display on screen." },
  { icon: <ScanLine className="h-6 w-6" />, title: "Phone as Barcode Scanner", desc: "No barcode scanner hardware needed. Use your phone camera to scan barcodes directly — fast, free, and always in your pocket." },
]

const TESTIMONIALS = [
  { name: "Maria Santos", role: "Sari-Sari Store Owner", text: "Payroo POS helped me track inventory properly. I used to lose money on expired items!", avatar: "MS" },
  { name: "Juan Reyes", role: "Carinderia Owner", text: "The multi-user feature is perfect. My staff can process orders while I manage the kitchen.", avatar: "JR" },
  { name: "Rosa Dela Cruz", role: "Salon Owner", text: "The loyalty program brought back repeat customers. Revenue increased 30% in 3 months!", avatar: "RD" },
]

const FAQS = [
  { q: "Do I need internet to use Payroo POS?", a: "No! Payroo POS works offline. Your data syncs automatically when you're back online." },
  { q: "Can I use it on my phone or tablet?", a: "Yes! Install it on any device — Android, iPhone, iPad, or desktop. Works like a native app." },
  { q: "What payment methods do you accept?", a: "GCash, Maya, credit/debit cards, bank transfers, and over-the-counter payments via Xendit." },
  { q: "Can I try it for free?", a: "Yes! Start with our FREE plan. No credit card required - get instant access to POS, inventory, e-wallet, and reports." },
  { q: "Is my data safe?", a: "100% secure. We use Firebase with end-to-end encryption. Your data is backed up automatically." },
]

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

export default function HomePage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [plansLoading, setPlansLoading] = useState(true)

  // Redirect logged-in users to POS
  useEffect(() => {
    if (!loading && user) {
      router.push("/pos")
    }
  }, [user, loading, router])

  useEffect(() => {
    getSubscriptionPlans()
      .then(p => setPlans(p.filter(pl => pl.isActive)))
      .finally(() => setPlansLoading(false))
  }, [])

  // Show nothing while checking auth
  if (loading || user) return null

  return (
    <div className="min-h-screen bg-background">
      <PWAInstallPrompt />
      <HomeNavbar />

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 bg-gradient-to-b from-yellow-100 via-amber-50/60 to-background">
        <div className="container mx-auto max-w-4xl text-center space-y-6">
          <Badge className="mx-auto bg-primary/10 text-primary hover:bg-primary/10">🚀 Built for Filipino SMEs</Badge>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-balance">
            The POS System Built for Your Business
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
            Whether you run a sari-sari store, salon, carinderia, or motorshop — Payroo POS gives you the tools to sell smarter, manage faster, and grow bigger.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Link href="/subscription">
              <Button size="lg" className="gap-2">Get Started <ArrowRight className="h-4 w-4" /></Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">Staff Login</Button>
            </Link>
          </div>
          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground pt-4 flex-wrap">
            <span className="flex items-center gap-1"><Wifi className="h-4 w-4 text-green-500" /> Works Offline</span>
            <span className="flex items-center gap-1"><Lock className="h-4 w-4 text-green-500" /> Secure & Encrypted</span>
            <span className="flex items-center gap-1"><Smartphone className="h-4 w-4 text-green-500" /> Mobile Ready</span>
          </div>
          <div className="mt-6 rounded-2xl bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-300 px-6 py-4 max-w-2xl mx-auto">
            <p className="text-lg md:text-xl font-bold text-foreground">
              📱 Use Your Phone Camera as a Barcode Scanner
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              No need to buy expensive POS hardware — just use your phone. Scan barcodes, manage inventory, and run your entire store from the device already in your pocket.
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/10">Features</Badge>
            <h2 className="text-4xl font-bold tracking-tight mb-4">All-in-One POS, Inventory & Business Management</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Point of sale, inventory tracking, barcode scanning, e-wallet cash-in/cash-out, customer loyalty, and AI-powered restocking — all in one platform.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map((f, i) => (
              <Card key={i} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="text-primary mb-2">{f.icon}</div>
                  <CardTitle className="text-base">{f.title}</CardTitle>
                </CardHeader>
                <CardContent><p className="text-sm text-muted-foreground">{f.desc}</p></CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Business Types */}
      <section id="business-types" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/10">Tailored for You</Badge>
            <h2 className="text-4xl font-bold tracking-tight mb-4">Works for Any Business Type</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Payroo POS adapts to your business. Choose your type and we customize everything.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
            {BUSINESS_TYPE_OPTIONS.map((opt) => (
              <Card key={opt.value} className="hover:border-primary transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{opt.label}</CardTitle>
                  <CardDescription className="text-xs">{opt.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Affiliate CTA Banner */}
      <section className="py-16 px-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center space-y-6">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium">
              <Gift className="h-4 w-4" /> Affiliate Program
            </div>
            <h2 className="text-4xl md:text-5xl font-bold">
              Earn ₱150 for Every Referral!
            </h2>
            <p className="text-lg md:text-xl opacity-95 max-w-2xl mx-auto">
              Know someone who runs a store? Share Payroo POS and earn ₱150 cash for every successful subscription. No limits. Withdraw anytime via GCash.
            </p>
            <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto pt-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <DollarSign className="h-8 w-8 mx-auto mb-2" />
                <p className="font-bold text-xl">₱150 Per Referral</p>
                <p className="text-sm opacity-90">Instant commission</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <Users className="h-8 w-8 mx-auto mb-2" />
                <p className="font-bold text-xl">Unlimited Earnings</p>
                <p className="text-sm opacity-90">No referral cap</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <Zap className="h-8 w-8 mx-auto mb-2" />
                <p className="font-bold text-xl">Fast Payout</p>
                <p className="text-sm opacity-90">GCash withdrawal</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Link href="/affiliate">
                <Button size="lg" variant="secondary" className="gap-2 bg-white text-green-600 hover:bg-white/90">
                  <Gift className="h-5 w-5" /> Join Affiliate Program
                </Button>
              </Link>
            </div>
            <p className="text-sm opacity-80 pt-2">
              💡 Perfect for: Social media influencers, community leaders, business consultants, or anyone with a network of store owners
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/10">Pricing</Badge>
            <h2 className="text-4xl font-bold tracking-tight mb-4">Simple, Transparent Pricing</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">No hidden fees. Cancel anytime.</p>
          </div>

          {plansLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className={`grid gap-6 ${
              plans.length === 1 ? "max-w-sm mx-auto" :
              plans.length === 2 ? "md:grid-cols-2 max-w-2xl mx-auto" :
              "md:grid-cols-3"
            }`}>
              {plans.map(plan => {
                const isPopular = plan.tier === "gold"
                return (
                  <div key={plan.id} className="relative flex flex-col">
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                        <span className="bg-yellow-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow">
                          ⭐ Most Popular
                        </span>
                      </div>
                    )}
                    <Card className={`flex flex-col h-full bg-gradient-to-b ${TIER_GRADIENT[plan.tier]} ${
                      isPopular ? "ring-2 ring-yellow-400 shadow-lg" : ""
                    }`}>
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
                        <Link href="/subscription">
                          <Button className="w-full" variant={isPopular ? "default" : "outline"}>
                            {plan.price === 0 ? "Get Started Free" : "Get Started"} <ArrowRight className="h-4 w-4 ml-1" />
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  </div>
                )
              })}
            </div>
          )}

          <p className="text-center mt-8 text-sm text-muted-foreground">
            All plans include 24/7 support, automatic backups, and offline access.{" "}
            <Link href="/subscription" className="text-primary underline underline-offset-2">View all plans →</Link>
          </p>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/10">Testimonials</Badge>
            <h2 className="text-4xl font-bold tracking-tight mb-4">Loved by Store Owners</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-sm">{t.avatar}</div>
                    <div><p className="font-semibold text-sm">{t.name}</p><p className="text-xs text-muted-foreground">{t.role}</p></div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground italic">"{t.text}"</p>
                  <div className="flex gap-1 mt-3">{[...Array(5)].map((_, j) => <Star key={j} className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />)}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 px-4">
        <div className="container mx-auto max-w-3xl">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/10">FAQ</Badge>
            <h2 className="text-4xl font-bold tracking-tight mb-4">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-4">
            {FAQS.map((faq, i) => (
              <Card key={i}>
                <CardHeader><CardTitle className="text-base">{faq.q}</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-muted-foreground">{faq.a}</p></CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-3xl text-center space-y-6">
          <h2 className="text-4xl font-bold">Ready to Transform Your Store?</h2>
          <p className="text-lg opacity-90">Join hundreds of Filipino store owners already using Payroo POS.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/subscription"><Button size="lg" variant="secondary" className="gap-2">Start Free <ArrowRight className="h-4 w-4" /></Button></Link>
            <Link href="/login"><Button size="lg" variant="outline" className="border-primary-foreground text-primary-foreground hover:bg-primary-foreground/10">Staff Login</Button></Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3"><img src="/logo.svg" alt="PayrooPOS" className="h-5 w-5 rounded" /><span className="font-bold">Payroo POS</span></div>
              <p className="text-sm text-muted-foreground">POS system built for Filipino SMEs.</p>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground">Features</a></li>
                <li><a href="#pricing" className="hover:text-foreground">Pricing</a></li>
                <li><Link href="/subscription" className="hover:text-foreground">Subscribe</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Support</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#faq" className="hover:text-foreground">FAQ</a></li>
                <li><a href="mailto:support@payroo.xyz" className="hover:text-foreground">Email Support</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Access</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/login" className="hover:text-foreground">Staff Login</Link></li>
                <li><Link href="/dashboard" className="hover:text-foreground">Owner Login</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-8 text-center text-sm text-muted-foreground">
            <p>© 2024 Payroo POS. Built by <span className="font-semibold">MOJADOO</span></p>
          </div>
        </div>
      </footer>
    </div>
  )
}
