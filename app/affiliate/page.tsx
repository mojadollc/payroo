"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Link from "next/link"
import {
  Users, Wallet, Copy, Check, ArrowRight, Loader2, Gift,
  TrendingUp, Clock, CheckCircle, XCircle, LogIn, Link2
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import {
  registerAffiliate, getAffiliateByEmail,
  getAffiliateEarnings, requestAffiliateWithdrawal,
  getAllWithdrawals, AFFILIATE_COMMISSION,
} from "@/lib/firebase/services"
import type { Affiliate, AffiliateEarning, AffiliateWithdrawal } from "@/lib/firebase/types"

const APP_URL = typeof window !== "undefined" ? window.location.origin : ""

function AffiliateContent() {
  const { toast } = useToast()
  const params = useSearchParams()

  // Auth state
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null)
  const [earnings, setEarnings] = useState<AffiliateEarning[]>([])
  const [withdrawals, setWithdrawals] = useState<AffiliateWithdrawal[]>([])
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  // Signup form
  const [signupForm, setSignupForm] = useState({ name: "", email: "", phone: "" })
  const [signingUp, setSigningUp] = useState(false)

  // Login form
  const [loginEmail, setLoginEmail] = useState("")
  const [loggingIn, setLoggingIn] = useState(false)
  const [mode, setMode] = useState<"signup" | "login">("signup")

  // Withdrawal form
  const [withdrawForm, setWithdrawForm] = useState({ amount: "", paymentMethod: "gcash", accountNumber: "", accountName: "" })
  const [withdrawing, setWithdrawing] = useState(false)

  // Restore session
  useEffect(() => {
    const saved = localStorage.getItem("affiliate_email")
    if (saved) loadAffiliate(saved)
  }, [])

  const loadAffiliate = async (email: string) => {
    setLoading(true)
    try {
      const aff = await getAffiliateByEmail(email)
      if (aff) {
        setAffiliate(aff)
        localStorage.setItem("affiliate_email", email)
        const [e, w] = await Promise.all([
          getAffiliateEarnings(aff.id!),
          getAllWithdrawals(),
        ])
        setEarnings(e)
        setWithdrawals(w.filter(wd => wd.affiliateId === aff.id))
      }
    } catch {
      toast({ title: "Error loading account", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!signupForm.name.trim() || !signupForm.email.trim()) {
      toast({ title: "Name and email are required", variant: "destructive" })
      return
    }
    setSigningUp(true)
    try {
      const aff = await registerAffiliate(signupForm)
      setAffiliate(aff)
      localStorage.setItem("affiliate_email", signupForm.email)
      const [e, w] = await Promise.all([
        getAffiliateEarnings(aff.id!),
        getAllWithdrawals(),
      ])
      setEarnings(e)
      setWithdrawals(w.filter(wd => wd.affiliateId === aff.id))
      toast({ title: "Welcome to Payroo Affiliate Program! 🎉" })
    } catch (err: any) {
      toast({ title: "Signup failed", description: err.message, variant: "destructive" })
    } finally {
      setSigningUp(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!loginEmail.trim()) return
    setLoggingIn(true)
    try {
      const aff = await getAffiliateByEmail(loginEmail.trim())
      if (!aff) {
        toast({ title: "No affiliate account found with that email", variant: "destructive" })
        return
      }
      setAffiliate(aff)
      localStorage.setItem("affiliate_email", loginEmail.trim())
      const [e, w] = await Promise.all([
        getAffiliateEarnings(aff.id!),
        getAllWithdrawals(),
      ])
      setEarnings(e)
      setWithdrawals(w.filter(wd => wd.affiliateId === aff.id))
      toast({ title: `Welcome back, ${aff.name}!` })
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message, variant: "destructive" })
    } finally {
      setLoggingIn(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("affiliate_email")
    setAffiliate(null)
    setEarnings([])
    setWithdrawals([])
  }

  const referralLink = affiliate
    ? `${APP_URL}/subscription?ref=${affiliate.referralCode}`
    : ""

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast({ title: "Referral link copied!" })
  }

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!affiliate) return
    const amount = Number(withdrawForm.amount)
    if (!amount || amount < 750) {
      toast({ title: "Minimum withdrawal is ₱750", variant: "destructive" })
      return
    }
    if (amount > (affiliate.walletBalance || 0)) {
      toast({ title: "Insufficient wallet balance", variant: "destructive" })
      return
    }
    if (!withdrawForm.accountNumber.trim() || !withdrawForm.accountName.trim()) {
      toast({ title: "Account details are required", variant: "destructive" })
      return
    }
    setWithdrawing(true)
    try {
      await requestAffiliateWithdrawal(
        affiliate.id!,
        affiliate.name,
        affiliate.email,
        amount,
        withdrawForm.paymentMethod,
        withdrawForm.accountNumber.trim(),
        withdrawForm.accountName.trim(),
      )
      toast({ title: "Withdrawal request submitted! We'll process it within 1-3 business days." })
      setWithdrawForm({ amount: "", paymentMethod: "gcash", accountNumber: "", accountName: "" })
      // Refresh
      await loadAffiliate(affiliate.email)
    } catch (err: any) {
      toast({ title: "Withdrawal failed", description: err.message, variant: "destructive" })
    } finally {
      setWithdrawing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // ── Not logged in ──
  if (!affiliate) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-background px-4 py-16">
        <div className="container mx-auto max-w-4xl">
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
          <div className="text-center mb-12 space-y-4">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
              <Gift className="h-4 w-4" /> Affiliate Program
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Earn ₱{AFFILIATE_COMMISSION} for Every Referral
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Share your unique link. When someone subscribes to Payroo POS using your link, you earn ₱{AFFILIATE_COMMISSION} instantly credited to your wallet.
            </p>
            <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground pt-2">
              <span className="flex items-center gap-1.5"><CheckCircle className="h-4 w-4 text-green-500" /> Free to join</span>
              <span className="flex items-center gap-1.5"><CheckCircle className="h-4 w-4 text-green-500" /> ₱{AFFILIATE_COMMISSION} per successful referral</span>
              <span className="flex items-center gap-1.5"><CheckCircle className="h-4 w-4 text-green-500" /> Withdraw via GCash (min ₱200)</span>
              <span className="flex items-center gap-1.5"><CheckCircle className="h-4 w-4 text-green-500" /> No limit on referrals</span>
            </div>
          </div>

          {/* How it works */}
          <div className="grid md:grid-cols-3 gap-4 mb-12">
            {[
              { step: "1", icon: <Link2 className="h-6 w-6" />, title: "Get Your Link", desc: "Sign up and get your unique referral link instantly." },
              { step: "2", icon: <Users className="h-6 w-6" />, title: "Share It", desc: "Share your link on social media, groups, or directly to store owners." },
              { step: "3", icon: <Wallet className="h-6 w-6" />, title: "Earn & Withdraw", desc: "Earn ₱150 per successful subscription. Withdraw via GCash anytime." },
            ].map(item => (
              <Card key={item.step} className="text-center">
                <CardContent className="pt-6 space-y-3">
                  <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    {item.icon}
                  </div>
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Step {item.step}</div>
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Auth card */}
          <div className="max-w-md mx-auto">
            <Card>
              <CardHeader>
                <div className="flex gap-2">
                  <Button
                    variant={mode === "signup" ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => setMode("signup")}
                  >
                    Join Now
                  </Button>
                  <Button
                    variant={mode === "login" ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => setMode("login")}
                  >
                    <LogIn className="h-3.5 w-3.5 mr-1" /> Login
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {mode === "signup" ? (
                  <form onSubmit={handleSignup} className="space-y-4">
                    <div className="space-y-1">
                      <Label>Full Name *</Label>
                      <Input
                        placeholder="Juan dela Cruz"
                        value={signupForm.name}
                        onChange={e => setSignupForm(f => ({ ...f, name: e.target.value }))}
                        disabled={signingUp}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Email Address *</Label>
                      <Input
                        type="email"
                        placeholder="juan@email.com"
                        value={signupForm.email}
                        onChange={e => setSignupForm(f => ({ ...f, email: e.target.value }))}
                        disabled={signingUp}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Phone <span className="text-muted-foreground text-xs">(optional)</span></Label>
                      <Input
                        type="tel"
                        placeholder="09XX XXX XXXX"
                        value={signupForm.phone}
                        onChange={e => setSignupForm(f => ({ ...f, phone: e.target.value }))}
                        disabled={signingUp}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={signingUp}>
                      {signingUp ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Gift className="h-4 w-4 mr-2" />}
                      {signingUp ? "Creating account..." : "Join Affiliate Program"}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-1">
                      <Label>Email Address</Label>
                      <Input
                        type="email"
                        placeholder="your@email.com"
                        value={loginEmail}
                        onChange={e => setLoginEmail(e.target.value)}
                        disabled={loggingIn}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loggingIn}>
                      {loggingIn ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogIn className="h-4 w-4 mr-2" />}
                      {loggingIn ? "Logging in..." : "Access My Dashboard"}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  // ── Dashboard ──
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <img src="/logo.svg" alt="Payroo POS" className="h-8 w-8 rounded-lg" />
            </Link>
            <div>
              <h1 className="font-bold text-lg">Affiliate Dashboard</h1>
              <p className="text-xs text-muted-foreground">{affiliate.email} · Code: <span className="font-mono font-semibold text-primary">{affiliate.referralCode}</span></p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>Logout</Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Wallet Balance</p>
              <p className="text-2xl font-bold text-green-600">₱{(affiliate.walletBalance || 0).toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Earned</p>
              <p className="text-2xl font-bold">₱{(affiliate.totalEarned || 0).toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Referrals</p>
              <p className="text-2xl font-bold text-blue-600">{affiliate.totalReferrals || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Withdrawn</p>
              <p className="text-2xl font-bold text-purple-600">₱{(affiliate.totalWithdrawn || 0).toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Referral Link */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" /> Your Referral Link
            </CardTitle>
            <CardDescription>Share this link. Earn ₱{AFFILIATE_COMMISSION} for every successful subscription.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input value={referralLink} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={copyLink}>
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Your referral code: <span className="font-mono font-bold text-primary">{affiliate.referralCode}</span>
            </p>
          </CardContent>
        </Card>

        <Tabs defaultValue="earnings" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="earnings">Earnings</TabsTrigger>
            <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
            <TabsTrigger value="history">Withdrawals</TabsTrigger>
          </TabsList>

          {/* Earnings Tab */}
          <TabsContent value="earnings">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Referral Earnings</CardTitle>
                <CardDescription>₱{AFFILIATE_COMMISSION} credited per successful subscription</CardDescription>
              </CardHeader>
              <CardContent>
                {earnings.length === 0 ? (
                  <div className="text-center py-10 space-y-2">
                    <TrendingUp className="h-10 w-10 text-muted-foreground mx-auto opacity-30" />
                    <p className="text-sm text-muted-foreground">No earnings yet. Share your link to start earning!</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {earnings.map(e => (
                      <div key={e.id} className="flex items-center justify-between border rounded-lg p-3">
                        <div>
                          <p className="font-medium text-sm">{e.referredStoreName}</p>
                          <p className="text-xs text-muted-foreground">{e.referredEmail} · {e.planName} Plan</p>
                          <p className="text-xs text-muted-foreground">
                            {e.createdAt && (e.createdAt as any).toDate
                              ? (e.createdAt as any).toDate().toLocaleDateString("en-PH")
                              : ""}
                          </p>
                        </div>
                        <span className="font-bold text-green-600">+₱{e.commission}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Withdraw Tab */}
          <TabsContent value="withdraw">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Wallet className="h-4 w-4" /> Request Withdrawal
                </CardTitle>
                <CardDescription>
                  Available: <span className="font-bold text-green-600">₱{(affiliate.walletBalance || 0).toLocaleString()}</span> · Minimum: ₱750
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleWithdraw} className="space-y-4">
                  <div className="space-y-1">
                    <Label>Amount (₱) *</Label>
                    <Input
                      type="number"
                      min={750}
                      max={affiliate.walletBalance || 0}
                      placeholder="750"
                      value={withdrawForm.amount}
                      onChange={e => setWithdrawForm(f => ({ ...f, amount: e.target.value }))}
                      disabled={withdrawing}
                    />
                    <p className="text-xs text-muted-foreground">Minimum ₱750</p>
                  </div>
                  <Separator />
                  <div className="space-y-1">
                    <Label>Payment Method *</Label>
                    <select
                      value={withdrawForm.paymentMethod}
                      onChange={e => setWithdrawForm(f => ({ ...f, paymentMethod: e.target.value }))}
                      disabled={withdrawing}
                      className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                    >
                      <option value="gcash">GCash</option>
                      <option value="maya">Maya</option>
                      <option value="shopeepay">ShopeePay Wallet</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label>Account Number *</Label>
                    <Input
                      type="tel"
                      placeholder="09XX XXX XXXX"
                      value={withdrawForm.accountNumber}
                      onChange={e => setWithdrawForm(f => ({ ...f, accountNumber: e.target.value }))}
                      disabled={withdrawing}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Account Name *</Label>
                    <Input
                      placeholder="Juan dela Cruz"
                      value={withdrawForm.accountName}
                      onChange={e => setWithdrawForm(f => ({ ...f, accountName: e.target.value }))}
                      disabled={withdrawing}
                    />
                  </div>
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                    ⚠️ Withdrawals are processed within 1–3 business days. Make sure your GCash details are correct.
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={withdrawing || (affiliate.walletBalance || 0) < 750}
                  >
                    {withdrawing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wallet className="h-4 w-4 mr-2" />}
                    {withdrawing ? "Submitting..." : "Request Withdrawal"}
                  </Button>
                  {(affiliate.walletBalance || 0) < 750 && (
                    <p className="text-xs text-center text-muted-foreground">
                      You need at least ₱750 to withdraw. Keep referring!
                    </p>
                  )}
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Withdrawal History Tab */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Withdrawal History</CardTitle>
              </CardHeader>
              <CardContent>
                {withdrawals.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-sm text-muted-foreground">No withdrawal requests yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {withdrawals.map(w => (
                      <div key={w.id} className="border rounded-lg p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold">₱{w.amount.toLocaleString()}</span>
                          <Badge variant={
                            w.status === "approved" ? "default" :
                            w.status === "rejected" ? "destructive" : "secondary"
                          }>
                            {w.status === "approved" && <CheckCircle className="h-3 w-3 mr-1" />}
                            {w.status === "rejected" && <XCircle className="h-3 w-3 mr-1" />}
                            {w.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                            {w.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">Account: {w.paymentMethod?.toUpperCase()} · {w.accountNumber} · {w.accountName}</p>
                        {w.notes && <p className="text-xs text-muted-foreground italic">{w.notes}</p>}
                        <p className="text-xs text-muted-foreground">
                          {w.createdAt && (w.createdAt as any).toDate
                            ? (w.createdAt as any).toDate().toLocaleDateString("en-PH")
                            : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

export default function AffiliatePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <AffiliateContent />
    </Suspense>
  )
}
