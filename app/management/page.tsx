"use client"

import { useState, useEffect } from "react"
import {
  Shield, Plus, Pencil, Trash2, Users, CreditCard, Check, X,
  RefreshCw, Search, ExternalLink, Clock, BadgeCheck, AlertCircle,
  Package, Store, TrendingUp, Smartphone, HandCoins, Star, Eye, Loader2, Bell,
  Calendar, Mail, Globe, Wallet, Receipt, Upload, Image as ImageIcon, Truck
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import {
  getSubscriptionPlans, updateSubscriptionPlan, addSubscriptionPlan, deleteSubscriptionPlan,
  getCustomerSubscriptions, addCustomerSubscription, updateCustomerSubscription, deleteCustomerSubscription,
  getProducts, getSales, getCategories, getEWalletTransactions, getUtangList, getLoyaltyCustomers,
  getAllAffiliates, getAllWithdrawals, updateWithdrawalStatus,
} from "@/lib/firebase/services"
import { getFirebaseDb } from "@/lib/firebase/config"
import { collection, query, where, getDocs, orderBy, limit as firestoreLimit, updateDoc, doc, setDoc } from "firebase/firestore"
import type { SubscriptionPlan, CustomerSubscription, SubscriptionFeatures, SubscriptionTier, Product, Sale, Category, Affiliate, AffiliateWithdrawal, SiteVisit } from "@/lib/firebase/types"
import { Timestamp } from "firebase/firestore"
import { PWAInstallPrompt } from "@/components/pwa-install-prompt"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"

const ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN ?? "superadmin2024"

const FEATURE_LABELS: Record<keyof SubscriptionFeatures, string> = {
  pos: "POS System",
  inventory: "Inventory",
  ewallet: "E-Wallet",
  reports: "Reports",
  loyalty: "Loyalty Program",
  utang: "Utang / Credit",
  aiRestock: "AI Restock",
  multiUser: "Multi-User",
  exportData: "Export Data",
  marketIntelligence: "Market Intelligence",
  delivery: "Online Delivery",
}

const STATUS_COLORS: Record<CustomerSubscription["status"], string> = {
  active: "bg-green-100 text-green-700",
  pending: "bg-blue-100 text-blue-700",
  expired: "bg-red-100 text-red-700",
  suspended: "bg-yellow-100 text-yellow-700",
}

const PAYMENT_COLORS: Record<string, string> = {
  PAID: "bg-green-100 text-green-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  EXPIRED: "bg-red-100 text-red-700",
  FAILED: "bg-red-100 text-red-700",
}

const PAYMENT_ICONS: Record<string, React.ReactNode> = {
  PAID: <BadgeCheck className="h-3 w-3" />,
  PENDING: <Clock className="h-3 w-3" />,
  EXPIRED: <AlertCircle className="h-3 w-3" />,
  FAILED: <AlertCircle className="h-3 w-3" />,
}

const TIER_COLORS: Record<SubscriptionTier, string> = {
  basic: "bg-slate-100 text-slate-700",
  gold: "bg-yellow-100 text-yellow-700",
  enterprise: "bg-purple-100 text-purple-700",
}

export default function ManagementPage() {
  const { toast } = useToast()
  const ADMIN_SESSION_KEY = "mgmt_admin_session"
  const SESSION_DURATION_MS = 8 * 60 * 60 * 1000 // 8 hours

  const [authed, setAuthed] = useState(false)
  const [pin, setPin] = useState("")
  const [pinError, setPinError] = useState(false)

  // Check session after mount to avoid SSR/client hydration mismatch
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(ADMIN_SESSION_KEY)
      if (!raw) return
      const { expiresAt } = JSON.parse(raw)
      if (Date.now() < expiresAt) setAuthed(true)
    } catch {}
  }, [])

  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [customers, setCustomers] = useState<CustomerSubscription[]>([])
  const [affiliates, setAffiliates] = useState<Affiliate[]>([])
  const [withdrawals, setWithdrawals] = useState<AffiliateWithdrawal[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [affiliateSearch, setAffiliateSearch] = useState("")
  const [notifyingExpiry, setNotifyingExpiry] = useState(false)
  const [notifySummary, setNotifySummary] = useState<string | null>(null)

  // Visitors
  const [visits, setVisits] = useState<SiteVisit[]>([])
  const [visitsLoading, setVisitsLoading] = useState(false)

  // Plan dialog
  const [planDialog, setPlanDialog] = useState(false)
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null)
  const [planForm, setPlanForm] = useState<Partial<SubscriptionPlan>>({})

  // Customer dialog
  const [custDialog, setCustDialog] = useState(false)
  const [editingCust, setEditingCust] = useState<CustomerSubscription | null>(null)
  const [custForm, setCustForm] = useState<Partial<CustomerSubscription>>({})

  // Store data viewer
  const [selectedStore, setSelectedStore] = useState<string | null>(null)
  const [storeProducts, setStoreProducts] = useState<Product[]>([])
  const [storeSales, setStoreSales] = useState<Sale[]>([])
  const [storeDataLoading, setStoreDataLoading] = useState(false)

  // Customer detail dialog
  const [detailCust, setDetailCust] = useState<CustomerSubscription | null>(null)
  const [detailProducts, setDetailProducts] = useState<Product[]>([])
  const [detailSales, setDetailSales] = useState<Sale[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  // Follow-up email
  const [sendingFollowUp, setSendingFollowUp] = useState<string | null>(null)

  // Welcome email
  const [sendingWelcome, setSendingWelcome] = useState<string | null>(null)

  // Status filter
  const [statusFilter, setStatusFilter] = useState<"all" | CustomerSubscription["status"]>("all")

  const load = async () => {
    setLoading(true)
    try {
      const [p, c, a, w] = await Promise.all([getSubscriptionPlans(), getCustomerSubscriptions(), getAllAffiliates(), getAllWithdrawals()])
      setPlans(p)
      setCustomers(c)
      setAffiliates(a)
      setWithdrawals(w)
      // Auto-check expiry notices every time data loads
      sendExpiryNotices(c, p)
    } catch {
      toast({ title: "Error loading data", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const loadVisits = async () => {
    setVisitsLoading(true)
    try {
      const db = getFirebaseDb()
      if (!db) return
      const snap = await getDocs(query(collection(db, "siteVisits"), orderBy("createdAt", "desc"), firestoreLimit(500)))
      setVisits(snap.docs.map(d => ({ id: d.id, ...d.data() }) as SiteVisit))
    } catch {
      toast({ title: "Error loading visits", variant: "destructive" })
    } finally {
      setVisitsLoading(false)
    }
  }

  // Send expiry notices for customers expiring within 5 days or already expired
  const sendExpiryNotices = async (customerList: CustomerSubscription[], planList: SubscriptionPlan[]) => {
    setNotifyingExpiry(true)
    setNotifySummary(null)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const NOTIFY_DAYS = 5
    // Track sent in localStorage to avoid re-sending same day
    const sentKey = "expiry_notices_sent"
    const sentLog: Record<string, string> = JSON.parse(localStorage.getItem(sentKey) || "{}")
    const todayStr = today.toISOString().split("T")[0]

    let sent = 0
    let skipped = 0
    for (const c of customerList) {
      if (!c.ownerEmail || c.status === "suspended" || c.status === "pending") { skipped++; continue }
      const endDate = c.endDate?.toDate?.()
      if (!endDate) { skipped++; continue }
      const endMidnight = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())
      const daysLeft = Math.ceil((endMidnight.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      // Only notify if expiring within NOTIFY_DAYS or already expired (but not more than 30 days ago)
      if (daysLeft > NOTIFY_DAYS || daysLeft < -30) { skipped++; continue }
      // Skip if already sent today for this customer
      const logKey = `${c.id}_${todayStr}`
      if (sentLog[logKey]) { skipped++; continue }
      const plan = planList.find(p => p.id === c.planId)
      try {
        await fetch("/api/send-expiry-notice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ownerName: c.ownerName,
            ownerEmail: c.ownerEmail,
            storeName: c.storeName,
            storeId: c.externalId ?? "",
            planName: plan?.name ?? "Unknown",
            planPrice: plan?.price ?? 0,
            expiryDate: endDate.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }),
            daysLeft,
            appUrl: window.location.origin,
          }),
        })
        sentLog[logKey] = todayStr
        sent++
      } catch { skipped++ }
    }
    localStorage.setItem(sentKey, JSON.stringify(sentLog))
    setNotifyingExpiry(false)
    const msg = sent > 0
      ? `✅ Sent ${sent} expiry notice${sent > 1 ? "s" : ""}${skipped > 0 ? ` · ${skipped} skipped` : ""}`
      : `ℹ️ No notices needed${skipped > 0 ? ` (${skipped} skipped — already sent today or not due)` : ""}`
    setNotifySummary(msg)
    if (sent > 0) toast({ title: `Sent ${sent} expiry notice${sent > 1 ? "s" : ""}` })
  }

  // Load store-specific data for superadmin viewing
  const loadStoreData = async (storeId: string) => {
    setStoreDataLoading(true)
    setSelectedStore(storeId)
    try {
      const db = getFirebaseDb()
      if (!db) return
      const prodSnap = await getDocs(query(collection(db, "products"), where("storeId", "==", storeId), orderBy("name")))
      setStoreProducts(prodSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Product))
      const salesSnap = await getDocs(query(collection(db, "sales"), where("storeId", "==", storeId), orderBy("createdAt", "desc")))
      setStoreSales(salesSnap.docs.slice(0, 50).map(d => ({ id: d.id, ...d.data() }) as Sale))
    } catch (err) {
      toast({ title: "Failed to load store data", variant: "destructive" })
    } finally {
      setStoreDataLoading(false)
    }
  }

  // Open customer detail dialog with store data
  const openCustomerDetail = async (c: CustomerSubscription) => {
    setDetailCust(c)
    setDetailProducts([])
    setDetailSales([])
    if (!c.externalId) return
    setDetailLoading(true)
    try {
      const db = getFirebaseDb()
      if (!db) return
      const [prodSnap, salesSnap] = await Promise.all([
        getDocs(query(collection(db, "products"), where("storeId", "==", c.externalId), orderBy("name"))),
        getDocs(query(collection(db, "sales"), where("storeId", "==", c.externalId), orderBy("createdAt", "desc"))),
      ])
      setDetailProducts(prodSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Product))
      setDetailSales(salesSnap.docs.slice(0, 50).map(d => ({ id: d.id, ...d.data() }) as Sale))
    } catch { } finally { setDetailLoading(false) }
  }

  // Send welcome email with login credentials
  const sendWelcomeEmail = async (c: CustomerSubscription) => {
    if (!c.ownerEmail || !c.externalId) {
      toast({ title: "Missing email or Store ID", variant: "destructive" })
      return
    }
    setSendingWelcome(c.id!)
    try {
      const db = getFirebaseDb()
      if (!db) throw new Error("DB not configured")
      // Look up the owner storeUser to get PIN
      const ownerSnap = await getDocs(
        query(collection(db, "storeUsers"), where("externalId", "==", c.externalId), where("role", "==", "owner"))
      )
      let username = c.ownerName.split(" ")[0].toLowerCase().replace(/[^a-z0-9]/g, "")
      let ownerPin = ""
      if (!ownerSnap.empty) {
        const ownerData = ownerSnap.docs[0].data()
        ownerPin = ownerData.pin ?? ""
        username = ownerData.username ?? username
      }
      // No storeUser found (paid subscription) - auto-create owner account with new PIN
      if (!ownerPin) {
        ownerPin = String(Math.floor(100000 + Math.random() * 900000))
        const { addStoreUser } = await import("@/lib/firebase/services")
        try {
          await addStoreUser({ name: c.ownerName, username, pin: ownerPin, role: "owner", externalId: c.externalId, isActive: true })
        } catch {
          username = username + "1"
          await addStoreUser({ name: c.ownerName, username, pin: ownerPin, role: "owner", externalId: c.externalId, isActive: true })
        }
      }
      const plan = plans.find(p => p.id === c.planId)
      const res = await fetch("/api/send-welcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerName: c.ownerName,
          ownerEmail: c.ownerEmail,
          storeName: c.storeName,
          storeId: c.externalId,
          ownerPin,
          planName: plan?.name ?? c.tier ?? "Basic",
          planPrice: plan?.price ?? 0,
          appUrl: window.location.origin,
        }),
      })
      const data = await res.json(); if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      toast({ title: `Welcome email sent to ${c.ownerEmail}`, description: `Store ID: ${c.externalId} · PIN: ${ownerPin}` })
    } catch (err: any) {
      toast({ title: "Failed to send welcome email", description: err?.message, variant: "destructive" })
    } finally {
      setSendingWelcome(null)
    }
  }

  // Send payment follow-up email
  const sendFollowUp = async (c: CustomerSubscription) => {
    if (!c.ownerEmail) { toast({ title: "No email address", variant: "destructive" }); return }
    setSendingFollowUp(c.id!)
    const plan = plans.find(p => p.id === c.planId)
    try {
      const res = await fetch("/api/send-payment-followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerName: c.ownerName,
          ownerEmail: c.ownerEmail,
          storeName: c.storeName,
          planName: plan?.name ?? "Subscription",
          planPrice: plan?.price ?? 0,
          paymentUrl: c.xenditPaymentUrl || undefined,
          appUrl: window.location.origin,
        }),
      })
      const data = await res.json(); if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      toast({ title: `Follow-up sent to ${c.ownerEmail}` })
    } catch {
      toast({ title: "Failed to send follow-up", variant: "destructive" })
    } finally { setSendingFollowUp(null) }
  }

  useEffect(() => {
    if (authed) load()
  }, [authed])

  const handleLogin = () => {
    if (pin === ADMIN_PIN) {
      setAuthed(true)
      setPinError(false)
      sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ expiresAt: Date.now() + SESSION_DURATION_MS }))
    } else { setPinError(true) }
  }

  const handleLogout = () => {
    setAuthed(false)
    sessionStorage.removeItem(ADMIN_SESSION_KEY)
    setPin("")
  }

  // ── Plan handlers ──────────────────────────────────────────────────────────
  const openNewPlan = () => {
    setEditingPlan(null)
    setPlanForm({
      tier: "basic", name: "", price: 0, description: "", isActive: true,
      features: { pos: true, inventory: true, ewallet: false, reports: false, loyalty: false, utang: false, aiRestock: false, multiUser: false, exportData: false, marketIntelligence: false, delivery: false },
    })
    setPlanDialog(true)
  }

  // All features that Gold should have — used to fill missing keys in old Firestore docs
  const GOLD_ALL_TRUE: SubscriptionFeatures = {
    pos: true, inventory: true, ewallet: true, reports: true,
    loyalty: true, utang: true, aiRestock: true, multiUser: true,
    exportData: true, marketIntelligence: true, delivery: true,
  }
  const BASIC_FEATURES: SubscriptionFeatures = {
    pos: true, inventory: true, ewallet: true, reports: true,
    loyalty: false, utang: false, aiRestock: false, multiUser: false,
    exportData: false, marketIntelligence: false, delivery: false,
  }

  const openEditPlan = (plan: SubscriptionPlan) => {
    setEditingPlan(plan)
    // Fill in any missing feature keys from the canonical set so toggles render for all features
    const canonical = plan.tier === "gold" || plan.tier === "enterprise" ? GOLD_ALL_TRUE : BASIC_FEATURES
    setPlanForm({ ...plan, features: { ...canonical, ...plan.features } })
    setPlanDialog(true)
  }

  const savePlan = async () => {
    if (!planForm.name || planForm.price === undefined) return
    try {
      if (editingPlan?.id) {
        await updateSubscriptionPlan(editingPlan.id, planForm)
      } else {
        await addSubscriptionPlan(planForm as Omit<SubscriptionPlan, "id" | "updatedAt">)
      }
      toast({ title: editingPlan ? "Plan updated — features synced to all customers on this plan" : "Plan created" })
      setPlanDialog(false)
      load()
    } catch {
      toast({ title: "Failed to save plan", variant: "destructive" })
    }
  }

  // Sync all customer features from their assigned plan
  // Fills missing feature keys based on tier so old Firestore docs get updated
  const syncAllCustomerFeatures = async () => {
    if (!confirm("Sync features from plans to ALL customers? This will overwrite each customer's features with their plan's current features.")) return
    try {
      const planMap = new Map(plans.map(p => [p.id, p]))
      let synced = 0
      for (const c of customers) {
        const plan = planMap.get(c.planId)
        if (!plan) continue
        // Build complete features: start with tier defaults, overlay plan's stored features
        const tierDefaults = (plan.tier === "gold" || plan.tier === "enterprise") ? GOLD_ALL_TRUE : BASIC_FEATURES
        const completeFeatures: SubscriptionFeatures = { ...tierDefaults, ...(plan.features ?? {}) }
        // Also update the plan doc itself if it's missing keys
        const planKeys = Object.keys(plan.features ?? {})
        const allKeys = Object.keys(tierDefaults)
        if (allKeys.some(k => !planKeys.includes(k))) {
          await updateSubscriptionPlan(plan.id!, { features: completeFeatures })
        }
        await updateCustomerSubscription(c.id!, { features: completeFeatures })
        synced++
      }
      toast({ title: `Synced features for ${synced} customers (plans also updated)` })
      load()
    } catch {
      toast({ title: "Sync failed", variant: "destructive" })
    }
  }

  const deletePlan = async (id: string) => {
    if (!confirm("Delete this plan?")) return
    await deleteSubscriptionPlan(id)
    toast({ title: "Plan deleted" })
    load()
  }

  // ── Customer handlers ──────────────────────────────────────────────────────
  const openNewCust = () => {
    setEditingCust(null)
    const now = new Date()
    const end = new Date(); end.setMonth(end.getMonth() + 1)
    setCustForm({
      ownerName: "", ownerEmail: "", storeName: "", phone: "",
      planId: plans[0]?.id ?? "", tier: plans[0]?.tier ?? "basic",
      status: "active", notes: "",
      startDate: Timestamp.fromDate(now),
      endDate: Timestamp.fromDate(end),
    })
    setCustDialog(true)
  }

  const openEditCust = (c: CustomerSubscription) => {
    setEditingCust(c)
    setCustForm({ ...c })
    setCustDialog(true)
  }

  const saveCust = async () => {
    if (!custForm.ownerName || !custForm.storeName || !custForm.planId) return
    const selectedPlan = plans.find(p => p.id === custForm.planId)
    const payload = { ...custForm, tier: selectedPlan?.tier ?? custForm.tier, features: selectedPlan?.features ?? custForm.features }
    try {
      if (editingCust?.id) {
        await updateCustomerSubscription(editingCust.id, payload)
        toast({ title: "Subscription updated" })
      } else {
        // Generate 4-digit store ID and 6-digit PIN
        const storeId = String(Math.floor(1000 + Math.random() * 9000))
        const ownerPin = String(Math.floor(100000 + Math.random() * 900000))
        const username = (custForm.ownerName ?? "").split(" ")[0].toLowerCase()
        const newPayload = { ...payload, externalId: storeId, features: selectedPlan?.features } as Omit<CustomerSubscription, "id" | "createdAt" | "updatedAt">
        await addCustomerSubscription(newPayload)
        // Create owner user account automatically
        try {
          const { addStoreUser } = await import("@/lib/firebase/services")
          await addStoreUser({ name: custForm.ownerName ?? "", username, pin: ownerPin, role: "owner", externalId: storeId, isActive: true })
        } catch (userErr) { console.error("Auto-create owner user failed:", userErr) }
        // Send welcome email
        try {
          await fetch("/api/send-welcome", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ownerName: custForm.ownerName,
              ownerEmail: custForm.ownerEmail,
              storeName: custForm.storeName,
              storeId,
              ownerPin,
              planName: selectedPlan?.name,
              planPrice: selectedPlan?.price,
              appUrl: window.location.origin,
            }),
          })
        } catch {}
        toast({ title: "Subscription added!", description: `Store ID: ${storeId} · PIN: ${ownerPin} · Email sent to ${custForm.ownerEmail}` })
      }
      setCustDialog(false)
      load()
    } catch (err: any) {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" })
    }
  }

  const deleteCust = async (id: string) => {
    if (!confirm("Remove this customer subscription?")) return
    await deleteCustomerSubscription(id)
    toast({ title: "Removed" })
    load()
  }

  const filteredCustomers = customers.filter(c => {
    const matchesSearch = c.ownerName.toLowerCase().includes(search.toLowerCase()) ||
      c.storeName.toLowerCase().includes(search.toLowerCase()) ||
      c.ownerEmail.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === "all" || c.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const stats = {
    total: customers.length,
    active: customers.filter(c => c.status === "active").length,
    pending: customers.filter(c => c.status === "pending").length,
    expired: customers.filter(c => c.status === "expired").length,
    revenue: customers.filter(c => c.status === "active").reduce((sum, c) => {
      const plan = plans.find(p => p.id === c.planId)
      return sum + (plan?.price ?? 0)
    }, 0),
  }

  // ── PIN Gate ───────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <PWAInstallPrompt />
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Management</CardTitle>
            <CardDescription>Enter your admin PIN to continue</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Admin PIN</Label>
              <Input
                type="password"
                placeholder="Enter PIN"
                value={pin}
                onChange={e => { setPin(e.target.value); setPinError(false) }}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                className={pinError ? "border-destructive" : ""}
              />
              {pinError && <p className="text-xs text-destructive">Incorrect PIN</p>}
            </div>
            <Button className="w-full" onClick={handleLogin}>Login</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <PWAInstallPrompt />
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-7 w-7 text-primary" /> Management
          </h1>
          <p className="text-muted-foreground">Manage subscription plans & customers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button variant="ghost" size="sm" className="text-destructive" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        {[
          { label: "Total Customers", value: stats.total, color: "text-blue-600" },
          { label: "Active", value: stats.active, color: "text-green-600" },
          { label: "Pending Payment", value: stats.pending, color: "text-orange-600" },
          { label: "Expired", value: stats.expired, color: "text-red-600" },
          { label: "Monthly Revenue", value: `₱${stats.revenue.toLocaleString()}`, color: "text-yellow-600" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="plans">
        <TabsList className="mb-6 flex-wrap">
          <TabsTrigger value="plans"><CreditCard className="h-4 w-4 mr-1" /> Plans</TabsTrigger>
          <TabsTrigger value="customers"><Users className="h-4 w-4 mr-1" /> Customers</TabsTrigger>
          <TabsTrigger value="affiliates"><TrendingUp className="h-4 w-4 mr-1" /> Affiliates</TabsTrigger>
          <TabsTrigger value="stores"><Store className="h-4 w-4 mr-1" /> Store Data</TabsTrigger>
          <TabsTrigger value="visitors"><Globe className="h-4 w-4 mr-1" /> Visitors</TabsTrigger>
          <TabsTrigger value="kiosk"><Wallet className="h-4 w-4 mr-1" /> Kiosk</TabsTrigger>
          <TabsTrigger value="expenses"><Receipt className="h-4 w-4 mr-1" /> Expenses</TabsTrigger>
          <TabsTrigger value="delivery"><Truck className="h-4 w-4 mr-1" /> Delivery</TabsTrigger>
        </TabsList>

        {/* ── Plans Tab ── */}
        <TabsContent value="plans">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-lg">Subscription Plans</h2>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={syncAllCustomerFeatures}><RefreshCw className="h-4 w-4 mr-1" /> Sync Features to Customers</Button>
              <Button size="sm" onClick={openNewPlan}><Plus className="h-4 w-4 mr-1" /> New Plan</Button>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {plans.map(plan => (
              <Card key={plan.id} className={`relative ${!plan.isActive ? "opacity-60" : ""}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TIER_COLORS[plan.tier]}`}>
                        {plan.tier.toUpperCase()}
                      </span>
                      <CardTitle className="mt-1 text-xl">{plan.name}</CardTitle>
                      <p className="text-2xl font-bold text-primary mt-1">₱{plan.price.toLocaleString()}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditPlan(plan)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deletePlan(plan.id!)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{plan.description}</p>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 gap-1">
                    {(Object.keys(FEATURE_LABELS) as (keyof SubscriptionFeatures)[]).map(f => (
                      <div key={f} className="flex items-center gap-1 text-xs">
                        {plan.features[f]
                          ? <Check className="h-3 w-3 text-green-500 shrink-0" />
                          : <X className="h-3 w-3 text-muted-foreground shrink-0" />}
                        <span className={plan.features[f] ? "" : "text-muted-foreground"}>{FEATURE_LABELS[f]}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Switch
                      checked={plan.isActive}
                      onCheckedChange={async (v) => {
                        await updateSubscriptionPlan(plan.id!, { isActive: v })
                        load()
                      }}
                    />
                    <span className="text-xs text-muted-foreground">{plan.isActive ? "Active" : "Inactive"}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── Affiliates Tab ── */}
        <TabsContent value="affiliates">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
              <h2 className="font-semibold text-lg">Affiliate Management</h2>
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search affiliates..." className="pl-8" value={affiliateSearch} onChange={e => setAffiliateSearch(e.target.value)} />
              </div>
            </div>

            {/* Affiliate Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Total Affiliates", value: affiliates.length, color: "text-blue-600" },
                { label: "Active", value: affiliates.filter(a => a.isActive).length, color: "text-green-600" },
                { label: "Total Earned", value: `₱${affiliates.reduce((sum, a) => sum + (a.totalEarned || 0), 0).toLocaleString()}`, color: "text-yellow-600" },
                { label: "Pending Withdrawals", value: withdrawals.filter(w => w.status === "pending").length, color: "text-orange-600" },
              ].map(s => (
                <Card key={s.label}>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Affiliates List */}
            <div className="space-y-3">
              {affiliates.filter(a => a.name.toLowerCase().includes(affiliateSearch.toLowerCase()) || a.email.toLowerCase().includes(affiliateSearch.toLowerCase())).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No affiliates found</p>
                </div>
              ) : (
                affiliates.filter(a => a.name.toLowerCase().includes(affiliateSearch.toLowerCase()) || a.email.toLowerCase().includes(affiliateSearch.toLowerCase())).map(aff => {
                  const affWithdrawals = withdrawals.filter(w => w.affiliateId === aff.id)
                  const pendingWithdrawals = affWithdrawals.filter(w => w.status === "pending")
                  return (
                    <Card key={aff.id}>
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-0.5 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold">{aff.name}</p>
                              <Badge variant={aff.isActive ? "default" : "secondary"}>
                                {aff.isActive ? "Active" : "Inactive"}
                              </Badge>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono">
                                {aff.referralCode}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">{aff.email} {aff.phone && `· ${aff.phone}`}</p>
                            <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground mt-1">
                              <span>Referrals: <span className="font-semibold text-blue-600">{aff.totalReferrals || 0}</span></span>
                              <span>Earned: <span className="font-semibold text-green-600">₱{(aff.totalEarned || 0).toLocaleString()}</span></span>
                              <span>Wallet: <span className="font-semibold">₱{(aff.walletBalance || 0).toLocaleString()}</span></span>
                              <span>Withdrawn: <span className="font-semibold text-purple-600">₱{(aff.totalWithdrawn || 0).toLocaleString()}</span></span>
                            </div>
                            {pendingWithdrawals.length > 0 && (
                              <p className="text-xs text-orange-600 mt-1">⏳ {pendingWithdrawals.length} pending withdrawal{pendingWithdrawals.length > 1 ? "s" : ""}</p>
                            )}
                          </div>
                          <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                try {
                                  const db = getFirebaseDb()
                                  if (db) {
                                    await updateDoc(doc(db, "affiliates", aff.id!), { isActive: !aff.isActive })
                                    load()
                                  }
                                } catch (err) {
                                  toast({ title: "Error updating affiliate", variant: "destructive" })
                                }
                              }}
                            >
                              {aff.isActive ? "Deactivate" : "Activate"}
                            </Button>
                            {pendingWithdrawals.length > 0 && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  // Show pending withdrawals
                                  const msg = pendingWithdrawals.map(w => `₱${w.amount} to ${w.gcashNumber}`).join(", ")
                                  alert(`Pending: ${msg}`)
                                }}
                              >
                                View Pending
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </div>

            {/* Withdrawal Requests */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Withdrawal Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {withdrawals.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No withdrawal requests</p>
                  ) : (
                    withdrawals.map(w => {
                      const aff = affiliates.find(a => a.id === w.affiliateId)
                      return (
                        <div key={w.id} className="border rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-sm">{aff?.name}</p>
                              <p className="text-xs text-muted-foreground">{aff?.email}</p>
                            </div>
                            <Badge variant={
                              w.status === "approved" ? "default" :
                              w.status === "rejected" ? "destructive" : "secondary"
                            }>
                              {w.status}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span>₱{w.amount.toLocaleString()}</span>
                            <span className="text-xs text-muted-foreground">GCash: {w.gcashNumber}</span>
                          </div>
                          {w.status === "pending" && (
                            <div className="flex gap-2 pt-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 hover:text-green-700"
                                onClick={async () => {
                                  try {
                                    await updateWithdrawalStatus(w.id!, "approved", "", w.affiliateId, w.amount)
                                    load()
                                    toast({ title: "Withdrawal approved" })
                                  } catch (err) {
                                    toast({ title: "Error approving withdrawal", variant: "destructive" })
                                  }
                                }}
                              >
                                <Check className="h-3.5 w-3.5 mr-1" /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:text-red-700"
                                onClick={async () => {
                                  const reason = prompt("Rejection reason (optional):")
                                  try {
                                    await updateWithdrawalStatus(w.id!, "rejected", reason || "", w.affiliateId, w.amount)
                                    load()
                                    toast({ title: "Withdrawal rejected" })
                                  } catch (err) {
                                    toast({ title: "Error rejecting withdrawal", variant: "destructive" })
                                  }
                                }}
                              >
                                <X className="h-3.5 w-3.5 mr-1" /> Reject
                              </Button>
                            </div>
                          )}
                          {w.notes && <p className="text-xs text-muted-foreground italic">{w.notes}</p>}
                        </div>
                      )
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Store Data Tab ── */}
        <TabsContent value="stores">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <h2 className="font-semibold text-lg">View Store Data</h2>
              <Select value={selectedStore ?? ""} onValueChange={loadStoreData}>
                <SelectTrigger className="w-64"><SelectValue placeholder="Select a store..." /></SelectTrigger>
                <SelectContent>
                  {customers.filter(c => c.externalId).map(c => (
                    <SelectItem key={c.externalId} value={c.externalId!}>
                      {c.storeName} ({c.externalId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {storeDataLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>

            {selectedStore && !storeDataLoading && (
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Products */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Package className="h-4 w-4" /> Products ({storeProducts.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="max-h-80 overflow-y-auto">
                    {storeProducts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No products</p>
                    ) : (
                      <div className="space-y-2">
                        {storeProducts.slice(0, 20).map(p => (
                          <div key={p.id} className="flex justify-between text-sm border-b pb-1">
                            <span>{p.name}</span>
                            <span className="text-muted-foreground">₱{p.price} · Stock: {p.stock}</span>
                          </div>
                        ))}
                        {storeProducts.length > 20 && (
                          <p className="text-xs text-muted-foreground">...and {storeProducts.length - 20} more</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Sales */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" /> Recent Sales ({storeSales.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="max-h-80 overflow-y-auto">
                    {storeSales.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No sales</p>
                    ) : (
                      <div className="space-y-2">
                        {storeSales.slice(0, 20).map(s => (
                          <div key={s.id} className="flex justify-between text-sm border-b pb-1">
                            <span>{s.items.length} items</span>
                            <span className="font-medium">₱{s.total.toLocaleString()}</span>
                          </div>
                        ))}
                        {storeSales.length > 20 && (
                          <p className="text-xs text-muted-foreground">...and {storeSales.length - 20} more</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Summary Stats */}
                <Card className="lg:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Store Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Total Products</p>
                        <p className="text-xl font-bold">{storeProducts.length}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Total Sales</p>
                        <p className="text-xl font-bold">{storeSales.length}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Revenue (shown)</p>
                        <p className="text-xl font-bold">₱{storeSales.reduce((sum, s) => sum + s.total, 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Inventory Value</p>
                        <p className="text-xl font-bold">₱{storeProducts.reduce((sum, p) => sum + (p.price * p.stock), 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {!selectedStore && (
              <div className="text-center py-12 text-muted-foreground">
                <Store className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Select a store above to view its data</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Customers Tab ── */}
        <TabsContent value="customers">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <h2 className="font-semibold text-lg">Customer Subscriptions</h2>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search customers..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Button size="sm" variant="outline" onClick={() => sendExpiryNotices(customers, plans)} disabled={notifyingExpiry}>
                <Bell className={`h-4 w-4 mr-1 ${notifyingExpiry ? "animate-pulse" : ""}`} />
                {notifyingExpiry ? "Sending..." : "Send Expiry Notices"}
              </Button>
              <Button size="sm" onClick={openNewCust}><Plus className="h-4 w-4 mr-1" /> Add</Button>
            </div>
          </div>
          {/* Status Filter */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {(["all", "active", "pending", "expired", "suspended"] as const).map(s => {
              const count = s === "all" ? customers.length : customers.filter(c => c.status === s).length
              return (
                <Button
                  key={s}
                  variant={statusFilter === s ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(s)}
                  className="capitalize"
                >
                  {s} ({count})
                </Button>
              )
            })}
          </div>
          {notifySummary && (
            <div className="mb-4 rounded-lg border bg-muted px-4 py-2 text-sm text-muted-foreground">
              {notifySummary}
            </div>
          )}

          <div className="space-y-3">
            {filteredCustomers.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">No customers found</div>
            )}
            {filteredCustomers.map(c => {
              const plan = plans.find(p => p.id === c.planId)
              const startDate = c.startDate?.toDate?.()
              const endDate = c.endDate?.toDate?.()
              const today = new Date(); today.setHours(0,0,0,0)
              const endMidnight = endDate ? new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()) : null
              const daysLeft = endMidnight ? Math.ceil((endMidnight.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null
              const isExpiringSoon = daysLeft !== null && daysLeft <= 5 && daysLeft > 0
              const isExpired = daysLeft !== null && daysLeft <= 0
              const fmtDate = (d?: Date) => d ? d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "—"
              return (
                <Card key={c.id}>
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold">{c.ownerName}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status]}`}>
                            {c.status}
                          </span>
                          {plan && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${TIER_COLORS[plan.tier]}`}>
                              {plan.name} — ₱{plan.price}/mo
                            </span>
                          )}
                          {isExpiringSoon && c.status === "active" && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">⏰ Expiring in {daysLeft}d</span>
                          )}
                          {isExpired && c.status === "active" && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">🔴 Expired</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{c.storeName} · {c.ownerEmail}</p>
                        <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                          {c.xenditPaymentStatus && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${PAYMENT_COLORS[c.xenditPaymentStatus] ?? "bg-muted text-muted-foreground"}`}>
                              {PAYMENT_ICONS[c.xenditPaymentStatus]}
                              Xendit: {c.xenditPaymentStatus}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> Start: {fmtDate(startDate)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> End: {fmtDate(endDate)}
                          </span>
                          {daysLeft !== null && c.status === "active" && (
                            <span className={daysLeft <= 5 ? "text-orange-600 font-medium" : ""}>{daysLeft}d left</span>
                          )}
                        </div>
                        {c.notes && <p className="text-xs text-muted-foreground italic">{c.notes}</p>}
                      </div>
                      <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                        {c.status === "active" && c.externalId && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-green-600 hover:text-green-700"
                            disabled={sendingWelcome === c.id}
                            onClick={() => sendWelcomeEmail(c)}
                          >
                            {sendingWelcome === c.id
                              ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Sending...</>
                              : <><Mail className="h-3.5 w-3.5 mr-1" /> Send Welcome</>}
                          </Button>
                        )}
                        {c.status === "pending" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-blue-600 hover:text-blue-700"
                            disabled={sendingFollowUp === c.id}
                            onClick={() => sendFollowUp(c)}
                          >
                            {sendingFollowUp === c.id
                              ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Sending...</>
                              : <><Mail className="h-3.5 w-3.5 mr-1" /> Follow-up</>}
                          </Button>
                        )}
                        {c.xenditPaymentUrl && (
                          <a href={c.xenditPaymentUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm">
                              <ExternalLink className="h-3.5 w-3.5 mr-1" /> Invoice
                            </Button>
                          </a>
                        )}
                        <Button variant="outline" size="sm" onClick={() => openCustomerDetail(c)}>
                          <Eye className="h-3.5 w-3.5 mr-1" /> View Data
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openEditCust(c)}>
                          <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteCust(c.id!)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* ── Visitors Tab ── */}
        <TabsContent value="visitors">
          <VisitorsTab visits={visits} loading={visitsLoading} onRefresh={loadVisits} />
        </TabsContent>

        {/* ── Kiosk Tab ── */}
        <TabsContent value="kiosk">
          <KioskManagement />
        </TabsContent>

        <TabsContent value="expenses">
          <ExpensesManagement />
        </TabsContent>
        <TabsContent value="delivery">
          <DeliveryManagement />
        </TabsContent>
      </Tabs>
      <Dialog open={planDialog} onOpenChange={setPlanDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Edit Plan" : "New Plan"}</DialogTitle>
            <DialogDescription>Configure plan details and features</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Plan Name</Label>
                <Input value={planForm.name ?? ""} onChange={e => setPlanForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Basic" />
              </div>
              <div className="space-y-1">
                <Label>Tier</Label>
                <Select value={planForm.tier} onValueChange={v => setPlanForm(p => ({ ...p, tier: v as SubscriptionTier }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="gold">Gold</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Monthly Price (₱)</Label>
              <Input type="number" min={0} value={planForm.price ?? ""} onChange={e => setPlanForm(p => ({ ...p, price: Number(e.target.value) }))} placeholder="299" />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input value={planForm.description ?? ""} onChange={e => setPlanForm(p => ({ ...p, description: e.target.value }))} placeholder="Short description" />
            </div>
            <div className="space-y-2">
              <Label>Features</Label>
              <div className="grid grid-cols-2 gap-2 rounded-lg border p-3">
                {(Object.keys(FEATURE_LABELS) as (keyof SubscriptionFeatures)[]).map(f => (
                  <div key={f} className="flex items-center gap-2">
                    <Switch
                      checked={planForm.features?.[f] ?? false}
                      onCheckedChange={v => setPlanForm(p => ({ ...p, features: { ...(p.features as SubscriptionFeatures), [f]: v } }))}
                    />
                    <span className="text-sm">{FEATURE_LABELS[f]}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={planForm.isActive ?? true} onCheckedChange={v => setPlanForm(p => ({ ...p, isActive: v }))} />
              <Label>Active (visible to customers)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialog(false)}>Cancel</Button>
            <Button onClick={savePlan} disabled={!planForm.name || planForm.price === undefined}>Save Plan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Customer Dialog ── */}
      <Dialog open={custDialog} onOpenChange={setCustDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCust ? "Edit Subscription" : "Add Customer Subscription"}</DialogTitle>
            <DialogDescription>Manage customer subscription details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Owner Name *</Label>
                <Input value={custForm.ownerName ?? ""} onChange={e => setCustForm(p => ({ ...p, ownerName: e.target.value }))} placeholder="Juan dela Cruz" />
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={custForm.phone ?? ""} onChange={e => setCustForm(p => ({ ...p, phone: e.target.value }))} placeholder="09XX XXX XXXX" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Email *</Label>
              <Input type="email" value={custForm.ownerEmail ?? ""} onChange={e => setCustForm(p => ({ ...p, ownerEmail: e.target.value }))} placeholder="juan@email.com" />
            </div>
            <div className="space-y-1">
              <Label>Store Name *</Label>
              <Input value={custForm.storeName ?? ""} onChange={e => setCustForm(p => ({ ...p, storeName: e.target.value }))} placeholder="Juan's Sari-Sari Store" />
            </div>
            <div className="space-y-1">
              <Label>Subscription Plan *</Label>
              <Select value={custForm.planId} onValueChange={v => setCustForm(p => ({ ...p, planId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                <SelectContent>
                  {plans.filter(p => p.isActive).map(p => (
                    <SelectItem key={p.id} value={p.id!}>{p.name} — ₱{p.price}/mo</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={custForm.status} onValueChange={v => setCustForm(p => ({ ...p, status: v as CustomerSubscription["status"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={custForm.endDate instanceof Timestamp
                    ? custForm.endDate.toDate().toLocaleDateString("en-CA") // en-CA gives YYYY-MM-DD in local time
                    : ""}
                  onChange={e => {
                    const [y, m, d] = e.target.value.split("-").map(Number)
                    // Use local midnight — avoids UTC off-by-one-day bug
                    const localDate = new Date(y, m - 1, d, 23, 59, 59)
                    setCustForm(p => ({ ...p, endDate: Timestamp.fromDate(localDate) }))
                  }}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea value={custForm.notes ?? ""} onChange={e => setCustForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional notes..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustDialog(false)}>Cancel</Button>
            <Button onClick={saveCust} disabled={!custForm.ownerName || !custForm.storeName || !custForm.planId}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Customer Detail Dialog ── */}
      <Dialog open={!!detailCust} onOpenChange={v => { if (!v) setDetailCust(null) }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detailCust && (() => {
            const plan = plans.find(p => p.id === detailCust.planId)
            const startDate = detailCust.startDate?.toDate?.()
            const endDate = detailCust.endDate?.toDate?.()
            const fmtDate = (d?: Date) => d ? d.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "—"
            const today = new Date()
            const daysLeft = endDate ? Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Store className="h-5 w-5" /> {detailCust.storeName}
                  </DialogTitle>
                  <DialogDescription>Store subscription and data overview</DialogDescription>
                </DialogHeader>

                {/* Subscription Info */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Owner</p>
                    <p className="text-sm font-semibold">{detailCust.ownerName}</p>
                    <p className="text-xs text-muted-foreground">{detailCust.ownerEmail}</p>
                    {detailCust.phone && <p className="text-xs text-muted-foreground">{detailCust.phone}</p>}
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Plan</p>
                    <p className="text-sm font-semibold">{plan?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">₱{plan?.price?.toLocaleString() ?? 0}/mo · {detailCust.tier?.toUpperCase()}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[detailCust.status]}`}>
                      {detailCust.status}
                    </span>
                    {detailCust.xenditPaymentStatus && (
                      <p className="text-xs text-muted-foreground mt-1">Payment: {detailCust.xenditPaymentStatus}</p>
                    )}
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Start Date</p>
                    <p className="text-sm font-semibold">{fmtDate(startDate)}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground">End Date</p>
                    <p className="text-sm font-semibold">{fmtDate(endDate)}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Days Left</p>
                    <p className={`text-sm font-semibold ${daysLeft !== null && daysLeft <= 5 ? "text-orange-600" : daysLeft !== null && daysLeft <= 0 ? "text-red-600" : ""}`}>
                      {daysLeft !== null ? (daysLeft > 0 ? `${daysLeft} days` : "Expired") : "—"}
                    </p>
                  </div>
                </div>

                {detailCust.externalId && (
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Store ID</p>
                    <p className="text-sm font-mono font-semibold">{detailCust.externalId}</p>
                  </div>
                )}

                {detailCust.notes && (
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Notes</p>
                    <p className="text-sm">{detailCust.notes}</p>
                  </div>
                )}

                {/* Store Data */}
                {detailCust.externalId && (
                  <div className="space-y-3 pt-2">
                    <p className="text-sm font-semibold">Store Data</p>
                    {detailLoading ? (
                      <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading store data...
                      </div>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2">
                        {/* Products */}
                        <div className="rounded-lg border p-3">
                          <p className="text-xs font-semibold flex items-center gap-1 mb-2">
                            <Package className="h-3.5 w-3.5" /> Products ({detailProducts.length})
                          </p>
                          {detailProducts.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No products yet</p>
                          ) : (
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                              {detailProducts.slice(0, 15).map(p => (
                                <div key={p.id} className="flex justify-between text-xs border-b pb-1">
                                  <span className="truncate mr-2">{p.name}</span>
                                  <span className="text-muted-foreground shrink-0">₱{p.price} · {p.stock} stock</span>
                                </div>
                              ))}
                              {detailProducts.length > 15 && (
                                <p className="text-xs text-muted-foreground">+{detailProducts.length - 15} more</p>
                              )}
                            </div>
                          )}
                        </div>
                        {/* Sales */}
                        <div className="rounded-lg border p-3">
                          <p className="text-xs font-semibold flex items-center gap-1 mb-2">
                            <TrendingUp className="h-3.5 w-3.5" /> Recent Sales ({detailSales.length})
                          </p>
                          {detailSales.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No sales yet</p>
                          ) : (
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                              {detailSales.slice(0, 15).map(s => (
                                <div key={s.id} className="flex justify-between text-xs border-b pb-1">
                                  <span>{s.items.length} item{s.items.length > 1 ? "s" : ""}</span>
                                  <span className="font-medium">₱{s.total.toLocaleString()}</span>
                                </div>
                              ))}
                              {detailSales.length > 15 && (
                                <p className="text-xs text-muted-foreground">+{detailSales.length - 15} more</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {/* Summary row */}
                    {!detailLoading && (detailProducts.length > 0 || detailSales.length > 0) && (
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-lg bg-muted p-2 text-center">
                          <p className="text-xs text-muted-foreground">Products</p>
                          <p className="text-lg font-bold">{detailProducts.length}</p>
                        </div>
                        <div className="rounded-lg bg-muted p-2 text-center">
                          <p className="text-xs text-muted-foreground">Sales</p>
                          <p className="text-lg font-bold">{detailSales.length}</p>
                        </div>
                        <div className="rounded-lg bg-muted p-2 text-center">
                          <p className="text-xs text-muted-foreground">Revenue</p>
                          <p className="text-lg font-bold">₱{detailSales.reduce((s, x) => s + x.total, 0).toLocaleString()}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!detailCust.externalId && (
                  <p className="text-sm text-muted-foreground text-center py-4">No store ID assigned — store data unavailable</p>
                )}
              </>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Visitors Tab Component ──────────────────────────────────────────────────
const CHART_COLORS = [
  "#EFBF04", "#3b82f6", "#22c55e", "#f97316", "#a855f7",
  "#ec4899", "#14b8a6", "#f43f5e", "#6366f1", "#84cc16",
]

const VISITORS_PER_PAGE = 25

function VisitorsTab({ visits, loading, onRefresh }: { visits: SiteVisit[]; loading: boolean; onRefresh: () => void }) {
  const [visitorPage, setVisitorPage] = useState(1)
  useEffect(() => { if (visits.length === 0 && !loading) onRefresh() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // Reset page when visits change
  useEffect(() => { setVisitorPage(1) }, [visits.length])

  const uniqueIPs = new Set(visits.map(v => v.ip)).size
  const uniqueCountries = new Set(visits.map(v => v.country)).size
  const pwaVisits = visits.filter(v => v.isPWA).length

  // Country breakdown
  const countryMap = new Map<string, { country: string; code: string; count: number }>()
  visits.forEach(v => {
    const ex = countryMap.get(v.country)
    if (ex) ex.count++
    else countryMap.set(v.country, { country: v.country, code: v.countryCode, count: 1 })
  })
  const countryData = Array.from(countryMap.values()).sort((a, b) => b.count - a.count)

  // Page breakdown
  const pageMap = new Map<string, number>()
  visits.forEach(v => pageMap.set(v.page, (pageMap.get(v.page) || 0) + 1))
  const pageData = Array.from(pageMap.entries()).map(([page, count]) => ({ page, count })).sort((a, b) => b.count - a.count).slice(0, 10)

  // Today's visits
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todayVisits = visits.filter(v => {
    const d = v.createdAt?.toDate?.()
    return d && d >= today
  })

  // City breakdown
  const cityMap = new Map<string, { city: string; country: string; count: number }>()
  visits.forEach(v => {
    const key = `${v.city}, ${v.country}`
    const ex = cityMap.get(key)
    if (ex) ex.count++
    else cityMap.set(key, { city: v.city, country: v.country, count: 1 })
  })
  const cityData = Array.from(cityMap.values()).sort((a, b) => b.count - a.count).slice(0, 15)

  const fmtDate = (v: SiteVisit) => {
    const d = v.createdAt?.toDate?.()
    return d ? d.toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-lg">Site Visitors</h2>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total Visits", value: visits.length, color: "text-blue-600" },
          { label: "Today", value: todayVisits.length, color: "text-green-600" },
          { label: "Unique IPs", value: uniqueIPs, color: "text-purple-600" },
          { label: "Countries", value: uniqueCountries, color: "text-orange-600" },
          { label: "PWA Visits", value: pwaVisits, color: "text-pink-600" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Country Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4" /> Visits by Country
            </CardTitle>
          </CardHeader>
          <CardContent>
            {countryData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No visit data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(200, countryData.length * 36)}>
                <BarChart data={countryData} layout="vertical" margin={{ left: 0, right: 20 }}>
                  <XAxis type="number" fontSize={11} />
                  <YAxis type="category" dataKey="country" width={120} fontSize={11} tick={{ fill: "#64748b" }} />
                  <Tooltip
                    formatter={(value: number) => [`${value} visits`, "Visits"]}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {countryData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top Pages */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Pages</CardTitle>
          </CardHeader>
          <CardContent>
            {pageData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data</p>
            ) : (
              <div className="space-y-2">
                {pageData.map(p => {
                  const pct = visits.length > 0 ? (p.count / visits.length) * 100 : 0
                  return (
                    <div key={p.page} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-mono truncate mr-2">{p.page}</span>
                        <span className="text-muted-foreground shrink-0">{p.count} ({pct.toFixed(1)}%)</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Cities */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Cities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {cityData.map((c, i) => (
                <div key={`${c.city}-${c.country}`} className="flex justify-between text-sm border-b pb-1.5">
                  <span>{i + 1}. {c.city}</span>
                  <span className="text-muted-foreground">{c.country} · {c.count}</span>
                </div>
              ))}
              {cityData.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No data</p>}
            </div>
          </CardContent>
        </Card>

        {/* Country List */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Country Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {countryData.map((c, i) => (
                <div key={c.country} className="flex items-center justify-between text-sm border-b pb-1.5">
                  <span className="flex items-center gap-2">
                    <span className="text-lg">{countryFlag(c.code)}</span>
                    <span>{c.country}</span>
                  </span>
                  <span className="font-semibold">{c.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Visitors Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent Visitors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-3">Time</th>
                  <th className="pb-2 pr-3">IP</th>
                  <th className="pb-2 pr-3">Country</th>
                  <th className="pb-2 pr-3">City</th>
                  <th className="pb-2 pr-3">Page</th>
                  <th className="pb-2 pr-3">PWA</th>
                  <th className="pb-2">Referrer</th>
                </tr>
              </thead>
              <tbody>
                {visits.slice((visitorPage - 1) * VISITORS_PER_PAGE, visitorPage * VISITORS_PER_PAGE).map(v => (
                  <tr key={v.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-1.5 pr-3 whitespace-nowrap">{fmtDate(v)}</td>
                    <td className="py-1.5 pr-3 font-mono">{v.ip}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">{countryFlag(v.countryCode)} {v.country}</td>
                    <td className="py-1.5 pr-3">{v.city}</td>
                    <td className="py-1.5 pr-3 font-mono">{v.page}</td>
                    <td className="py-1.5 pr-3">
                      {v.isPWA ? <span className="text-pink-600 font-semibold">📱 PWA</span> : <span className="text-muted-foreground">Web</span>}
                    </td>
                    <td className="py-1.5 truncate max-w-[150px]">{v.referrer ? (() => { try { return new URL(v.referrer).hostname } catch { return v.referrer } })() : "—"}</td>
                  </tr>
                ))}
                {visits.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No visitors recorded yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {visits.length > VISITORS_PER_PAGE && (() => {
            const totalPages = Math.ceil(visits.length / VISITORS_PER_PAGE)
            return (
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-muted-foreground">
                  Showing {(visitorPage - 1) * VISITORS_PER_PAGE + 1}–{Math.min(visitorPage * VISITORS_PER_PAGE, visits.length)} of {visits.length}
                </p>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" disabled={visitorPage === 1} onClick={() => setVisitorPage(1)}>«</Button>
                  <Button variant="outline" size="sm" disabled={visitorPage === 1} onClick={() => setVisitorPage(p => p - 1)}>‹</Button>
                  <span className="text-xs px-2">{visitorPage} / {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={visitorPage === totalPages} onClick={() => setVisitorPage(p => p + 1)}>›</Button>
                  <Button variant="outline" size="sm" disabled={visitorPage === totalPages} onClick={() => setVisitorPage(totalPages)}>»</Button>
                </div>
              </div>
            )
          })()}
        </CardContent>
      </Card>
    </div>
  )
}

// Convert country code to flag emoji
function countryFlag(code: string): string {
  if (!code || code.length !== 2) return "🌐"
  const offset = 127397
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => c.charCodeAt(0) + offset))
}

// ── Kiosk Management Component ──────────────────────────────────────────────
const ALL_CHANNELS = [
  { id: "QRPH", name: "QRPH", type: "QR", desc: "GCash / Maya QR scan" },
  { id: "SHOPEEPAY", name: "ShopeePay", type: "E-Wallet", desc: "One-time payment" },
  { id: "BPI", name: "BPI", type: "Direct Debit", desc: "Bank direct debit" },
  { id: "CHINABANK", name: "Chinabank", type: "Direct Debit", desc: "Bank direct debit" },
  { id: "RCBC", name: "RCBC", type: "Direct Debit", desc: "Bank direct debit" },
  { id: "UBP", name: "UnionBank (UBP)", type: "Direct Debit", desc: "Bank direct debit" },
  { id: "CEBUANA", name: "Cebuana", type: "Over-The-Counter", desc: "OTC payment" },
  { id: "LBC", name: "LBC", type: "Over-The-Counter", desc: "OTC payment" },
  { id: "BILLEASE", name: "BillEase", type: "PayLater", desc: "Buy now pay later" },
]

interface CashinTxn {
  id: string
  txnId: string
  amountInserted: number
  amount: number
  fee: number
  xenditCost: number
  xenditVat: number
  xenditTotal: number
  adminFee: number
  sellerEarning: number
  sendAmount: number
  channel: string
  accountName: string
  accountNumber: string
  storeId: string
  storeName: string
  status: string
  createdAt: any
}

function KioskManagement() {
  const { toast } = useToast()
  const [enabledChannels, setEnabledChannels] = useState<string[]>([])
  const [transactions, setTransactions] = useState<CashinTxn[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingFees, setSavingFees] = useState(false)
  const [configDocId, setConfigDocId] = useState<string | null>(null)
  // Fee settings
  const [commSettingsId, setCommSettingsId] = useState<string | null>(null)
  const [xenditFlatFee, setXenditFlatFee] = useState("10")
  const [adminChargeRate, setAdminChargeRate] = useState("1")

  const load = async () => {
    setLoading(true)
    try {
      const db = getFirebaseDb()
      if (!db) return

      // Load channel config
      const cfgSnap = await getDocs(query(collection(db, "kioskSettings"), where("type", "==", "paymentChannels")))
      if (!cfgSnap.empty) {
        setEnabledChannels(cfgSnap.docs[0].data().enabled || [])
        setConfigDocId(cfgSnap.docs[0].id)
      } else {
        setEnabledChannels(ALL_CHANNELS.map(c => c.id))
      }

      // Load commission settings (all stores share one global admin-set fee)
      // We load the first commissionSettings doc as the global template
      const commSnap = await getDocs(collection(db, "commissionSettings"))
      if (!commSnap.empty) {
        const data = commSnap.docs[0].data()
        setCommSettingsId(commSnap.docs[0].id)
        setXenditFlatFee(String(data.xenditFlatFee ?? 10))
        setAdminChargeRate(String(((data.adminChargeRate ?? 0.01) * 100).toFixed(2)))
      }

      // Load transactions
      const txnSnap = await getDocs(query(collection(db, "cashinTransactions"), orderBy("createdAt", "desc"), firestoreLimit(100)))
      setTransactions(txnSnap.docs.map(d => ({ id: d.id, ...d.data() }) as CashinTxn))
    } catch {
      toast({ title: "Error loading kiosk data", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleChannel = (id: string) => {
    setEnabledChannels(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
  }

  const saveChannels = async () => {
    setSaving(true)
    try {
      const db = getFirebaseDb()
      if (!db) return
      const docId = configDocId || "paymentChannels"
      await setDoc(doc(db, "kioskSettings", docId), {
        type: "paymentChannels",
        enabled: enabledChannels,
        updatedAt: Timestamp.now(),
      })
      setConfigDocId(docId)
      toast({ title: "Payment channels saved" })
    } catch {
      toast({ title: "Failed to save", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const saveFees = async () => {
    const xendit = parseFloat(xenditFlatFee)
    const admin = parseFloat(adminChargeRate)
    if (isNaN(xendit) || xendit < 5 || xendit > 20) {
      toast({ title: "Xendit flat fee must be ₱5–20", variant: "destructive" }); return
    }
    if (isNaN(admin) || admin < 0.1 || admin > 50) {
      toast({ title: "Admin charge must be 0.1%–50%", variant: "destructive" }); return
    }
    setSavingFees(true)
    try {
      const db = getFirebaseDb()
      if (!db) return
      // Update ALL commissionSettings docs so every store gets the new admin/xendit rates
      const commSnap = await getDocs(collection(db, "commissionSettings"))
      const batch = (await import("firebase/firestore")).writeBatch(db)
      commSnap.docs.forEach(d => {
        batch.update(d.ref, {
          xenditFlatFee: xendit,
          adminChargeRate: admin / 100,
          updatedAt: Timestamp.now(),
        })
      })
      await batch.commit()
      toast({ title: "Fee settings saved for all stores" })
    } catch {
      toast({ title: "Failed to save fee settings", variant: "destructive" })
    } finally {
      setSavingFees(false)
    }
  }

  const statusColor = (s: string) => {
    if (s === "PAID" || s === "COMPLETED") return "bg-green-100 text-green-700"
    if (s === "PENDING") return "bg-yellow-100 text-yellow-700"
    if (s === "EXPIRED") return "bg-gray-100 text-gray-500"
    if (s === "FAILED") return "bg-red-100 text-red-700"
    return "bg-gray-100 text-gray-500"
  }

  const fmtDate = (t: any) => {
    const d = t?.toDate?.()
    return d ? d.toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"
  }

  const stats = {
    total: transactions.length,
    paid: transactions.filter(t => t.status === "PAID" || t.status === "COMPLETED").length,
    pending: transactions.filter(t => t.status === "PENDING").length,
    revenue: transactions.filter(t => t.status === "PAID" || t.status === "COMPLETED").reduce((s, t) => s + (t.fee || 0), 0),
    volume: transactions.filter(t => t.status === "PAID" || t.status === "COMPLETED").reduce((s, t) => s + (t.amount || 0), 0),
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-lg">Kiosk Cash-In Management</h2>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total Txns", value: stats.total, color: "text-blue-600" },
          { label: "Completed", value: stats.paid, color: "text-green-600" },
          { label: "Pending", value: stats.pending, color: "text-yellow-600" },
          { label: "Volume", value: `₱${stats.volume.toLocaleString()}`, color: "text-purple-600" },
          { label: "Total Fees", value: `₱${stats.revenue.toLocaleString()}`, color: "text-green-600" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Left column: Fee Settings + Payment Channels */}
        <div className="lg:col-span-2 space-y-4">
        {/* Fee Settings */}
        <Card className="border-orange-200 bg-orange-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Platform Fee Settings</CardTitle>
            <CardDescription className="text-xs">Applied to all stores. Shown to customers as combined "Service Fee".</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Xendit Flat Fee (₱) <span className="font-normal text-muted-foreground">range: ₱5–20</span></Label>
              <Input
                type="number" step="1" min="5" max="20"
                value={xenditFlatFee}
                onChange={e => setXenditFlatFee(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Fixed peso cost per transaction charged by Xendit</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Admin Charge (%) <span className="font-normal text-muted-foreground">range: 0.1%–50%</span></Label>
              <Input
                type="number" step="0.1" min="0.1" max="50"
                value={adminChargeRate}
                onChange={e => setAdminChargeRate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">% of inserted amount that goes to admin</p>
            </div>
            {/* Live preview */}
            {(() => {
              const amt = 1000
              const xFee = parseFloat(xenditFlatFee) || 0
              const xVat = Math.ceil(xFee * 0.12 * 100) / 100
              const xTotal = Math.ceil(xFee + xVat)
              const aFee = amt >= 100 ? Math.ceil(amt * ((parseFloat(adminChargeRate) || 0) / 100)) : 0
              return (
                <div className="rounded-lg bg-white border p-3 text-xs space-y-1">
                  <p className="font-semibold text-muted-foreground mb-1">Preview on ₱1,000</p>
                  <div className="flex justify-between"><span className="text-red-500">Xendit fee</span><span>-₱{xFee}</span></div>
                  <div className="flex justify-between"><span className="text-red-400">Xendit VAT (12%)</span><span>-₱{xVat.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-orange-500">Admin charge ({adminChargeRate}%)</span><span>-₱{aFee}</span></div>
                  <div className="flex justify-between font-bold border-t pt-1"><span>Platform deduction</span><span>₱{xTotal + aFee}</span></div>
                </div>
              )
            })()}
            <Button size="sm" className="w-full bg-orange-500 hover:bg-orange-600 text-white" onClick={saveFees} disabled={savingFees}>
              {savingFees ? "Saving..." : "Save Fee Settings"}
            </Button>
          </CardContent>
        </Card>

        {/* Payment Channels */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payment Channels</CardTitle>
            <CardDescription className="text-xs">Enable/disable channels for the kiosk</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {ALL_CHANNELS.map(ch => (
              <div key={ch.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{ch.name}</p>
                  <p className="text-xs text-muted-foreground">{ch.type} · {ch.desc}</p>
                </div>
                <Switch
                  checked={enabledChannels.includes(ch.id)}
                  onCheckedChange={() => toggleChannel(ch.id)}
                />
              </div>
            ))}
            <Button size="sm" className="w-full mt-2" onClick={saveChannels} disabled={saving}>
              {saving ? "Saving..." : "Save Channels"}
            </Button>
          </CardContent>
        </Card>
        </div> {/* end left column */}

        {/* Transaction Log */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Cash-In Transactions — Full Breakdown</CardTitle>
            <CardDescription className="text-xs">Last 100 transactions with fee breakdown per transaction</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-2">Time</th>
                    <th className="pb-2 pr-2">Store</th>
                    <th className="pb-2 pr-2">Customer</th>
                    <th className="pb-2 pr-2">Inserted</th>
                    <th className="pb-2 pr-2">Xendit</th>
                    <th className="pb-2 pr-2">VAT</th>
                    <th className="pb-2 pr-2">Admin</th>
                    <th className="pb-2 pr-2">Seller</th>
                    <th className="pb-2 pr-2">Sent</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(t => {
                    const inserted = t.amountInserted ?? t.amount ?? 0
                    const xendit = t.xenditCost ?? 0
                    const vat = t.xenditVat ?? Math.ceil(xendit * 0.12 * 100) / 100
                    const admin = t.adminFee ?? 0
                    const seller = t.sellerEarning ?? 0
                    const sent = t.sendAmount ?? (inserted - (t.fee ?? 0))
                    return (
                      <tr key={t.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-1.5 pr-2 whitespace-nowrap">{fmtDate(t.createdAt)}</td>
                        <td className="py-1.5 pr-2 truncate max-w-[80px]">{t.storeName || t.storeId}</td>
                        <td className="py-1.5 pr-2">
                          <div>{t.accountName || "—"}</div>
                          {t.accountNumber && <div className="text-muted-foreground font-mono">{t.accountNumber}</div>}
                        </td>
                        <td className="py-1.5 pr-2 font-medium">₱{inserted.toLocaleString()}</td>
                        <td className="py-1.5 pr-2 text-red-500">₱{xendit}</td>
                        <td className="py-1.5 pr-2 text-red-400">₱{vat.toFixed(2)}</td>
                        <td className="py-1.5 pr-2 text-orange-500">₱{admin}</td>
                        <td className="py-1.5 pr-2 text-green-600 font-medium">₱{seller}</td>
                        <td className="py-1.5 pr-2 text-blue-600 font-medium">₱{sent.toLocaleString()}</td>
                        <td className="py-1.5">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor(t.status)}`}>
                            {t.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {transactions.length === 0 && (
                    <tr><td colSpan={10} className="text-center py-8 text-muted-foreground">No transactions yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Legend */}
            <div className="flex gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Xendit fee</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> Admin fee</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Seller commission</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Amount sent to customer</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ── Delivery Management Component (Superadmin) ─────────────────────────────

function DeliveryManagement() {
  const { toast } = useToast()
  const [banners, setBanners] = useState<{ id: string; imageUrl: string; title: string; link: string; order: number; active: boolean; createdAt: any }[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const { getAllDeliveryBanners } = await import("@/lib/firebase/services")
      const b = await getAllDeliveryBanners()
      setBanners(b as any[])
    } catch { toast({ title: "Error loading banners", variant: "destructive" }) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdd = async (file: File) => {
    setUploading(true)
    try {
      const { uploadDeliveryImage, addDeliveryBanner } = await import("@/lib/firebase/services")
      const url = await uploadDeliveryImage(file, "banners")
      await addDeliveryBanner({ imageUrl: url, title: "", link: "", order: banners.length, active: true })
      toast({ title: "Banner added" })
      load()
    } catch { toast({ title: "Failed to add banner", variant: "destructive" }) }
    finally { setUploading(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this banner?")) return
    const { deleteDeliveryBanner } = await import("@/lib/firebase/services")
    await deleteDeliveryBanner(id)
    toast({ title: "Banner removed" })
    load()
  }

  const handleToggle = async (id: string, active: boolean) => {
    const { updateDeliveryBanner } = await import("@/lib/firebase/services")
    await updateDeliveryBanner(id, { active })
    load()
  }

  const handleUpdate = async (id: string, field: "title" | "link", value: string) => {
    const { updateDeliveryBanner } = await import("@/lib/firebase/services")
    await updateDeliveryBanner(id, { [field]: value })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-lg">Delivery Homepage Banners</h2>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">Manage the slide banners shown on the /delivery homepage. Only you (superadmin) can control these.</p>

      <Card>
        <CardContent className="p-4 space-y-3">
          {banners.length === 0 && !loading && (
            <div className="text-center py-8 text-muted-foreground">
              <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No banners yet. Add one below.</p>
            </div>
          )}
          {banners.map(b => (
            <div key={b.id} className="flex items-center gap-3 border rounded-lg p-3">
              <img src={b.imageUrl} alt="" className="h-16 w-28 rounded-lg object-cover shrink-0" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <Input placeholder="Title (optional)" defaultValue={b.title ?? ""} onBlur={e => handleUpdate(b.id, "title", e.target.value)} className="h-8 text-sm" />
                <Input placeholder="Link (e.g. /delivery?store=1234)" defaultValue={b.link ?? ""} onBlur={e => handleUpdate(b.id, "link", e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="flex flex-col items-center gap-2 shrink-0">
                <Switch checked={b.active} onCheckedChange={v => handleToggle(b.id, v)} />
                <span className="text-[10px] text-muted-foreground">{b.active ? "Active" : "Hidden"}</span>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 shrink-0" onClick={() => handleDelete(b.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <label className="cursor-pointer block">
            <Button variant="outline" className="w-full gap-2" disabled={uploading} asChild>
              <span><Plus className="h-4 w-4" /> {uploading ? "Uploading..." : "Add Banner Image"}</span>
            </Button>
            <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleAdd(e.target.files[0]) }} />
          </label>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Expenses / Bills Management Component ───────────────────────────────────

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

interface Expense {
  id: string
  title: string
  amount: number
  month: string
  year: number
  category: string
  notes: string
  receiptUrl: string
  createdAt: any
}

const EXPENSE_CATEGORIES = [
  "Rent", "Electricity", "Water", "Internet", "Supplies",
  "Salary", "Transportation", "Food", "Maintenance", "Xendit Fees",
  "Government", "Insurance", "Marketing", "Miscellaneous",
]

function ExpensesManagement() {
  const { toast } = useToast()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const now = new Date()
  const [filterMonth, setFilterMonth] = useState(MONTHS[now.getMonth()])
  const [filterYear, setFilterYear] = useState(now.getFullYear())

  const [form, setForm] = useState({
    title: "",
    amount: "",
    month: MONTHS[now.getMonth()],
    year: String(now.getFullYear()),
    category: "Miscellaneous",
    notes: "",
  })
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const loadExpenses = async () => {
    setLoading(true)
    try {
      const db = getFirebaseDb()
      if (!db) return
      const snap = await getDocs(query(collection(db, "adminExpenses"), orderBy("createdAt", "desc")))
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Expense))
    } catch {
      toast({ title: "Error loading expenses", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadExpenses() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = expenses.filter(e => e.month === filterMonth && e.year === filterYear)
  const totalFiltered = filtered.reduce((s, e) => s + e.amount, 0)
  const totalAll = expenses.reduce((s, e) => s + e.amount, 0)

  // Group by category
  const byCategory = new Map<string, number>()
  filtered.forEach(e => byCategory.set(e.category, (byCategory.get(e.category) || 0) + e.amount))
  const categoryData = Array.from(byCategory.entries()).map(([cat, amt]) => ({ cat, amt })).sort((a, b) => b.amt - a.amt)

  const openNew = () => {
    setEditingId(null)
    setForm({ title: "", amount: "", month: MONTHS[now.getMonth()], year: String(now.getFullYear()), category: "Miscellaneous", notes: "" })
    setReceiptFile(null)
    setReceiptPreview(null)
    setDialogOpen(true)
  }

  const openEdit = (e: Expense) => {
    setEditingId(e.id)
    setForm({ title: e.title, amount: String(e.amount), month: e.month, year: String(e.year), category: e.category, notes: e.notes || "" })
    setReceiptFile(null)
    setReceiptPreview(e.receiptUrl || null)
    setDialogOpen(true)
  }

  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setReceiptFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setReceiptPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!form.title.trim() || !form.amount) {
      toast({ title: "Title and amount are required", variant: "destructive" }); return
    }
    setUploading(true)
    try {
      const db = getFirebaseDb()
      if (!db) throw new Error("DB not configured")

      let receiptUrl = editingId ? (expenses.find(e => e.id === editingId)?.receiptUrl || "") : ""

      // Upload receipt image if provided
      if (receiptFile) {
        const { getFirebaseStorage } = await import("@/lib/firebase/config")
        const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage")
        const storage = getFirebaseStorage()
        if (storage) {
          const fileName = `expenses/${Date.now()}_${receiptFile.name}`
          const storageRef = ref(storage, fileName)
          await uploadBytes(storageRef, receiptFile)
          receiptUrl = await getDownloadURL(storageRef)
        }
      }

      const data = {
        title: form.title.trim(),
        amount: parseFloat(form.amount),
        month: form.month,
        year: parseInt(form.year),
        category: form.category,
        notes: form.notes.trim(),
        receiptUrl,
      }

      if (editingId) {
        const { updateDoc, doc: firestoreDoc } = await import("firebase/firestore")
        await updateDoc(firestoreDoc(db, "adminExpenses", editingId), { ...data, updatedAt: Timestamp.now() })
        toast({ title: "Expense updated" })
      } else {
        const { addDoc: firestoreAdd } = await import("firebase/firestore")
        await firestoreAdd(collection(db, "adminExpenses"), { ...data, createdAt: Timestamp.now() })
        toast({ title: "Expense added" })
      }

      setDialogOpen(false)
      loadExpenses()
    } catch (err: any) {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this expense?")) return
    try {
      const db = getFirebaseDb()
      if (!db) return
      const { deleteDoc: firestoreDel, doc: firestoreDoc } = await import("firebase/firestore")
      await firestoreDel(firestoreDoc(db, "adminExpenses", id))
      toast({ title: "Expense deleted" })
      loadExpenses()
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" })
    }
  }

  const fmtDate = (t: any) => {
    const d = t?.toDate?.()
    return d ? d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—"
  }

  const years = Array.from(new Set(expenses.map(e => e.year).concat(now.getFullYear()))).sort((a, b) => b - a)

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="font-semibold text-lg">Expenses / Bills</h2>
        <div className="flex gap-2 items-center flex-wrap">
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(filterYear)} onValueChange={v => setFilterYear(Number(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadExpenses} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Add Expense</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{filterMonth} {filterYear} Total</p>
            <p className="text-2xl font-bold text-red-600">₱{totalFiltered.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{filterMonth} Entries</p>
            <p className="text-2xl font-bold text-blue-600">{filtered.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">All-Time Total</p>
            <p className="text-2xl font-bold text-orange-600">₱{totalAll.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">All-Time Entries</p>
            <p className="text-2xl font-bold text-purple-600">{expenses.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Category Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">By Category — {filterMonth}</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No expenses this month</p>
            ) : (
              <div className="space-y-2">
                {categoryData.map(c => {
                  const pct = totalFiltered > 0 ? (c.amt / totalFiltered) * 100 : 0
                  return (
                    <div key={c.cat} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>{c.cat}</span>
                        <span className="text-muted-foreground">₱{c.amt.toLocaleString()} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-red-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expense List */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Expenses — {filterMonth} {filterYear}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Receipt className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No expenses for {filterMonth} {filterYear}</p>
                </div>
              ) : (
                filtered.map(e => (
                  <div key={e.id} className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex gap-3 flex-1 min-w-0">
                        {e.receiptUrl ? (
                          <img
                            src={e.receiptUrl}
                            alt="Receipt"
                            className="w-14 h-14 rounded-lg object-cover border cursor-pointer shrink-0"
                            onClick={() => setPreviewUrl(e.receiptUrl)}
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <Receipt className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{e.title}</p>
                          <div className="flex items-center gap-2 flex-wrap mt-0.5">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{e.category}</span>
                            <span className="text-xs text-muted-foreground">{fmtDate(e.createdAt)}</span>
                          </div>
                          {e.notes && <p className="text-xs text-muted-foreground mt-1 truncate">{e.notes}</p>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-red-600">₱{e.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        <div className="flex gap-1 mt-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(e)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(e.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Expense" : "Add Expense"}</DialogTitle>
            <DialogDescription>Record a bill or expense with receipt</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Title / Description *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Electric bill, Rent" />
            </div>
            <div className="space-y-1">
              <Label>Amount (₱) *</Label>
              <Input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Month</Label>
                <Select value={form.month} onValueChange={v => setForm(f => ({ ...f, month: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Year</Label>
                <Input type="number" min="2024" max="2030" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Receipt Image</Label>
              <div className="flex gap-3 items-start">
                {receiptPreview ? (
                  <img src={receiptPreview} alt="Receipt" className="w-20 h-20 rounded-lg object-cover border" />
                ) : (
                  <div className="w-20 h-20 rounded-lg border-2 border-dashed flex items-center justify-center text-muted-foreground">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="receipt-upload" className="cursor-pointer">
                    <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border text-sm hover:bg-muted transition-colors">
                      <Upload className="h-3.5 w-3.5" /> Choose File
                    </div>
                  </Label>
                  <input id="receipt-upload" type="file" accept="image/*" className="hidden" onChange={handleReceiptChange} />
                  {receiptPreview && (
                    <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={() => { setReceiptFile(null); setReceiptPreview(null) }}>
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes (optional)</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Additional details..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={uploading}>Cancel</Button>
            <Button onClick={handleSave} disabled={uploading || !form.title.trim() || !form.amount}>
              {uploading ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Saving...</> : editingId ? "Update" : "Add Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Preview */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-lg p-2">
          <DialogHeader>
            <DialogTitle>Receipt</DialogTitle>
            <DialogDescription>Receipt image preview</DialogDescription>
          </DialogHeader>
          {previewUrl && <img src={previewUrl} alt="Receipt" className="w-full rounded-lg" />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
