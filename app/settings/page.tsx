"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  Store, MapPin, Phone, ServerCrash, Building2, Globe, Brain, Crown,
  Lock, ArrowRight, Check, X, Zap, Star, ChevronRight, Settings2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { clearAllData, getStoreSettings, saveStoreSettings } from "@/lib/firebase/services"
import { DEFAULT_STORE_NAME } from "@/components/navbar"
import { BUSINESS_TYPE_OPTIONS, getBusinessConfig, type BusinessType } from "@/lib/business-config"
import { useSubscription } from "@/hooks/use-subscription"
import { MobileAppShell, MobileCard, MobileSectionHeader } from "@/components/mobile-app-shell"
import type { SubscriptionFeatures } from "@/lib/firebase/types"

const PH_REGIONS = [
  "NCR", "CAR", "Region I", "Region II", "Region III", "Region IV-A",
  "MIMAROPA", "Region V", "Region VI", "Region VII", "Region VIII",
  "Region IX", "Region X", "Region XI", "Region XII", "Region XIII", "BARMM",
]

const FEATURE_INFO: Record<keyof SubscriptionFeatures, { label: string; desc: string }> = {
  pos: { label: "POS System", desc: "Process sales and manage cart" },
  inventory: { label: "Inventory", desc: "Track stock and products" },
  ewallet: { label: "E-Wallet", desc: "GCash & Maya transactions" },
  reports: { label: "Reports", desc: "Sales & profit analytics" },
  loyalty: { label: "Loyalty", desc: "Customer rewards program" },
  utang: { label: "Utang", desc: "Credit/debt tracking" },
  aiRestock: { label: "AI Restock", desc: "Smart reorder suggestions" },
  multiUser: { label: "Multi-User", desc: "Staff & cashier accounts" },
  exportData: { label: "Export", desc: "Download reports as CSV" },
  marketIntelligence: { label: "Market Intel", desc: "Regional sales insights" },
  delivery: { label: "Delivery", desc: "Online delivery store" },
}

const TIER_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string; gradient: string }> = {
  basic: { icon: <Zap className="h-5 w-5" />, color: "text-slate-600", bg: "bg-slate-100", gradient: "from-slate-50 to-slate-100" },
  gold: { icon: <Star className="h-5 w-5" />, color: "text-yellow-600", bg: "bg-yellow-100", gradient: "from-yellow-50 to-amber-100" },
  enterprise: { icon: <Crown className="h-5 w-5" />, color: "text-purple-600", bg: "bg-purple-100", gradient: "from-purple-50 to-purple-100" },
}

export default function SettingsPage() {
  const { toast } = useToast()
  const { tier, features, isActive, endDate, storeName: subStoreName, ownerName } = useSubscription()

  const [storeName, setStoreName] = useState(DEFAULT_STORE_NAME)
  const [storeNameInput, setStoreNameInput] = useState(DEFAULT_STORE_NAME)
  const [storeAddress, setStoreAddress] = useState("")
  const [storeAddressInput, setStoreAddressInput] = useState("")
  const [storePhone, setStorePhone] = useState("")
  const [storePhoneInput, setStorePhoneInput] = useState("")
  const [businessType, setBusinessType] = useState<BusinessType>("retail")
  const [fetchingLocation, setFetchingLocation] = useState(false)
  const [region, setRegion] = useState("")
  const [province, setProvince] = useState("")
  const [city, setCity] = useState("")
  const [barangay, setBarangay] = useState("")
  const [locationSaved, setLocationSaved] = useState(false)

  useEffect(() => {
    getStoreSettings().then((s) => {
      if (s?.name) { setStoreName(s.name); setStoreNameInput(s.name) }
      if (s?.address) { setStoreAddress(s.address); setStoreAddressInput(s.address) }
      if (s?.phone) { setStorePhone(s.phone); setStorePhoneInput(s.phone) }
      if (s?.businessType) setBusinessType(s.businessType as BusinessType)
      if (s?.region) setRegion(s.region)
      if (s?.province) setProvince(s.province)
      if (s?.city) setCity(s.city)
      if (s?.barangay) setBarangay(s.barangay)
    })
  }, [])

  const handleSaveStoreName = async () => {
    await saveStoreSettings({ name: storeNameInput })
    setStoreName(storeNameInput)
    localStorage.setItem("storeName", storeNameInput)
    localStorage.removeItem("pos_subscription")
    window.dispatchEvent(new Event("storename"))
    toast({ title: "Store name updated" })
  }

  const handleSaveStoreAddress = async () => {
    await saveStoreSettings({ address: storeAddressInput })
    setStoreAddress(storeAddressInput)
    localStorage.removeItem("pos_subscription")
    toast({ title: "Store address updated" })
  }

  const handleSaveStorePhone = async () => {
    await saveStoreSettings({ phone: storePhoneInput })
    setStorePhone(storePhoneInput)
    localStorage.removeItem("pos_subscription")
    toast({ title: "Store phone updated" })
  }

  const handleSaveBusinessType = async (type: BusinessType) => {
    setBusinessType(type)
    await saveStoreSettings({ businessType: type })
    localStorage.setItem("businessType", type)
    localStorage.removeItem("pos_subscription")
    window.dispatchEvent(new Event("businesstype"))
    toast({ title: `Business type set to ${getBusinessConfig(type).label}` })
  }

  const handleSaveLocation = async () => {
    if (!region || !city) {
      toast({ title: "Region and City are required", variant: "destructive" })
      return
    }
    await saveStoreSettings({ region, province, city, barangay })
    setLocationSaved(true)
    toast({ title: "Store location saved", description: "Your sales data will now contribute to market intelligence." })
  }

  const daysLeft = endDate ? (() => {
    const now = new Date()
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endMidnight = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())
    return Math.max(0, Math.ceil((endMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24)))
  })() : null

  const tierCfg = TIER_CONFIG[tier || "basic"] || TIER_CONFIG.basic
  const enabledFeatures = Object.entries(features).filter(([, v]) => v).map(([k]) => k)
  const disabledFeatures = Object.entries(features).filter(([, v]) => !v).map(([k]) => k)

  const handleFetchLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Geolocation not supported", variant: "destructive" })
      return
    }
    setFetchingLocation(true)
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json`
          )
          const data = await res.json()
          const addr = data.address ?? {}
          setStoreAddressInput(data.display_name ?? `${coords.latitude}, ${coords.longitude}`)
          if (addr.city || addr.town || addr.municipality) setCity(addr.city ?? addr.town ?? addr.municipality)
          if (addr.state) setProvince(addr.state)
          if (addr.suburb || addr.village || addr.neighbourhood) setBarangay(addr.suburb ?? addr.village ?? addr.neighbourhood)
        } catch {
          setStoreAddressInput(`${coords.latitude}, ${coords.longitude}`)
        } finally {
          setFetchingLocation(false)
        }
      },
      () => {
        toast({ title: "Location access denied", variant: "destructive" })
        setFetchingLocation(false)
      }
    )
  }

  const handleClearAllData = async () => {
    if (!window.confirm("DANGER: Delete ALL data? This includes products, sales, and all transaction history. This cannot be undone.")) return
    if (!window.confirm("SECOND CONFIRMATION: Are you absolutely sure?")) return
    try {
      await clearAllData()
      toast({ title: "All data cleared", description: "Please refresh the page." })
    } catch {
      toast({ title: "Error", description: "Failed to clear data.", variant: "destructive" })
    }
  }

  return (
    <MobileAppShell
      title="Settings"
      subtitle="Store configuration"
      headerAction={
        <div className={`p-2 rounded-xl ${tierCfg.bg} ${tierCfg.color}`}>
          <Settings2 className="h-5 w-5" />
        </div>
      }
    >
      <div className="space-y-5">

        {/* ── Subscription Plan Card ── */}
        <div>
          <MobileSectionHeader title="Subscription" />
          <MobileCard className={`bg-gradient-to-br ${tierCfg.gradient} border-0`}>
            <div className="p-4">
              {/* Header row */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-2xl ${tierCfg.bg} ${tierCfg.color}`}>
                    {tierCfg.icon}
                  </div>
                  <div>
                    <div className="font-bold text-base">{tier?.toUpperCase()} Plan</div>
                    {ownerName && <div className="text-xs text-muted-foreground">{ownerName}{subStoreName ? ` · ${subStoreName}` : ""}</div>}
                  </div>
                </div>
                <Badge className={`${isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"} border-0 font-semibold`}>
                  {isActive ? "Active" : "Inactive"}
                </Badge>
              </div>

              {/* Expired Banner */}
              {!isActive && endDate && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 mb-3 space-y-2">
                  <p className="text-sm font-semibold text-red-700">🔴 Subscription expired</p>
                  <p className="text-xs text-red-600">
                    Expired on <strong>{endDate.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}</strong>.
                    All features are locked.
                  </p>
                  <Link href="/subscription">
                    <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white gap-1 w-full mt-1">
                      <ArrowRight className="h-3.5 w-3.5" /> Renew Now
                    </Button>
                  </Link>
                </div>
              )}

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-white/60 rounded-xl p-2.5 text-center">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Expires</p>
                  <p className="text-xs font-bold leading-tight">
                    {endDate ? endDate.toLocaleDateString("en-PH", { month: "short", day: "numeric" }) : "N/A"}
                  </p>
                </div>
                <div className="bg-white/60 rounded-xl p-2.5 text-center">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Days Left</p>
                  <p className={`text-xs font-bold leading-tight ${daysLeft !== null && daysLeft <= 7 ? "text-orange-600" : ""}`}>
                    {daysLeft !== null ? `${daysLeft}d` : "N/A"}
                  </p>
                </div>
                <div className="bg-white/60 rounded-xl p-2.5 text-center">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Features</p>
                  <p className="text-xs font-bold leading-tight">{enabledFeatures.length}/{Object.keys(features).length}</p>
                </div>
              </div>

              {/* Enabled features */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {enabledFeatures.map(key => (
                  <span key={key} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">
                    <Check className="h-3 w-3" /> {FEATURE_INFO[key as keyof SubscriptionFeatures]?.label}
                  </span>
                ))}
              </div>

              {/* Locked features */}
              {disabledFeatures.length > 0 && (
                <div className="border-t border-black/5 pt-3">
                  <p className="text-[11px] font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Locked — upgrade to unlock
                  </p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {disabledFeatures.map(key => (
                      <span key={key} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-black/5 text-muted-foreground">
                        <X className="h-3 w-3" /> {FEATURE_INFO[key as keyof SubscriptionFeatures]?.label}
                      </span>
                    ))}
                  </div>
                  <Link href="/subscription">
                    <Button size="sm" className="w-full gap-1 rounded-xl">
                      <ArrowRight className="h-3.5 w-3.5" /> Upgrade Plan
                    </Button>
                  </Link>
                </div>
              )}

              {/* Renew warning */}
              {daysLeft !== null && daysLeft <= 7 && isActive && (
                <div className="bg-orange-100 border border-orange-200 rounded-xl p-3 text-sm text-orange-800 mt-2">
                  ⚠️ Expires in {daysLeft} days.{" "}
                  <Link href="/subscription" className="underline font-semibold">Renew →</Link>
                </div>
              )}
            </div>
          </MobileCard>
        </div>

        {/* ── Business Type ── */}
        <div>
          <MobileSectionHeader title="Business Type" />
          <MobileCard>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 gap-2">
                {BUSINESS_TYPE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleSaveBusinessType(opt.value as BusinessType)}
                    className={`flex items-center justify-between text-left rounded-2xl border-2 p-3.5 transition-all active:scale-[0.98] ${
                      businessType === opt.value
                        ? "border-primary bg-primary/5"
                        : "border-border bg-background"
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-sm">{opt.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{opt.description}</div>
                    </div>
                    {businessType === opt.value && (
                      <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 ml-3">
                        <Check className="h-3.5 w-3.5 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              {businessType && (() => {
                const cfg = getBusinessConfig(businessType)
                return (
                  <div className="rounded-2xl bg-muted p-3 text-xs space-y-1 text-muted-foreground">
                    <p><span className="font-semibold text-foreground">Item:</span> {cfg.itemLabel} · <span className="font-semibold text-foreground">Price:</span> {cfg.priceLabel} · <span className="font-semibold text-foreground">Stock:</span> {cfg.stockLabel}</p>
                    <p><span className="font-semibold text-foreground">Units:</span> {cfg.units.slice(0, 5).join(", ")}</p>
                    <p><span className="font-semibold text-foreground">Categories:</span> {cfg.defaultCategories.slice(0, 4).join(", ")}…</p>
                  </div>
                )
              })()}
            </div>
          </MobileCard>
        </div>

        {/* ── Store Information ── */}
        <div>
          <MobileSectionHeader title="Store Information" />
          <MobileCard>
            {/* Store Name */}
            <div className="p-4 border-b border-border/50">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-blue-100 rounded-xl">
                  <Store className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Store Name</p>
                  <p className="text-xs text-muted-foreground">Appears in navbar & receipts</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Input
                  value={storeNameInput}
                  onChange={e => setStoreNameInput(e.target.value)}
                  placeholder="Enter store name"
                  className="flex-1 h-11 rounded-xl"
                />
                <Button
                  onClick={handleSaveStoreName}
                  disabled={storeNameInput.trim() === storeName || !storeNameInput.trim()}
                  className="h-11 px-5 rounded-xl"
                >
                  Save
                </Button>
              </div>
            </div>

            {/* Store Address */}
            <div className="p-4 border-b border-border/50">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-green-100 rounded-xl">
                  <MapPin className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Store Address</p>
                  <p className="text-xs text-muted-foreground">Used on receipts and reports</p>
                </div>
              </div>
              <div className="space-y-2">
                <Input
                  value={storeAddressInput}
                  onChange={e => setStoreAddressInput(e.target.value)}
                  placeholder="Enter store address"
                  className="h-11 rounded-xl"
                />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleFetchLocation} disabled={fetchingLocation} className="flex-1 h-11 rounded-xl gap-1.5">
                    <MapPin className="h-4 w-4" />
                    {fetchingLocation ? "Fetching…" : "Use My Location"}
                  </Button>
                  <Button
                    onClick={handleSaveStoreAddress}
                    disabled={storeAddressInput.trim() === storeAddress}
                    className="h-11 px-5 rounded-xl"
                  >
                    Save
                  </Button>
                </div>
                {storeAddress && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 px-1">
                    <MapPin className="h-3 w-3 shrink-0" /> {storeAddress}
                  </p>
                )}
              </div>
            </div>

            {/* Contact Number */}
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-purple-100 rounded-xl">
                  <Phone className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Contact Number</p>
                  <p className="text-xs text-muted-foreground">Printed on receipts</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Input
                  value={storePhoneInput}
                  onChange={e => setStorePhoneInput(e.target.value)}
                  placeholder="e.g. 09XX-XXX-XXXX"
                  className="flex-1 h-11 rounded-xl"
                />
                <Button
                  onClick={handleSaveStorePhone}
                  disabled={storePhoneInput.trim() === storePhone}
                  className="h-11 px-5 rounded-xl"
                >
                  Save
                </Button>
              </div>
            </div>
          </MobileCard>
        </div>

        {/* ── Market Intelligence Location ── */}
        {features.marketIntelligence && (
          <div>
            <MobileSectionHeader
              title="Market Intelligence"
              action={
                <span className="text-xs text-primary font-semibold flex items-center gap-1">
                  <Brain className="h-3.5 w-3.5" /> Location
                </span>
              }
            />
            <MobileCard>
              <div className="p-4 space-y-3">
                <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-2xl">
                  <Globe className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Set your store location so your sales data contributes to the network-wide consumer behavior map. Data is anonymized — your store name is never shared.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="region" className="text-xs font-semibold">Region <span className="text-destructive">*</span></Label>
                    <select
                      id="region"
                      value={region}
                      onChange={e => setRegion(e.target.value)}
                      className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Select region</option>
                      {PH_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="province" className="text-xs font-semibold">Province</Label>
                    <Input id="province" value={province} onChange={e => setProvince(e.target.value)} placeholder="e.g. Cebu" className="h-11 rounded-xl" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="city" className="text-xs font-semibold">City / Municipality <span className="text-destructive">*</span></Label>
                    <Input id="city" value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Cebu City" className="h-11 rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="barangay" className="text-xs font-semibold">Barangay</Label>
                    <Input id="barangay" value={barangay} onChange={e => setBarangay(e.target.value)} placeholder="e.g. Lahug" className="h-11 rounded-xl" />
                  </div>
                </div>

                {(region || city) && (
                  <div className="rounded-xl bg-muted px-3 py-2.5 text-xs text-muted-foreground flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    {[barangay, city, province, region].filter(Boolean).join(", ")}
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <p className="text-xs text-muted-foreground">
                    {locationSaved ? "✅ Location saved" : "⚠️ Location not set"}
                  </p>
                  <Button onClick={handleSaveLocation} disabled={!region || !city} size="sm" className="rounded-xl px-5">
                    Save Location
                  </Button>
                </div>
              </div>
            </MobileCard>
          </div>
        )}

        {/* ── Danger Zone ── */}
        <div>
          <MobileSectionHeader title="Danger Zone" />
          <MobileCard className="border-destructive/30">
            <div className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-red-100 rounded-2xl">
                  <ServerCrash className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-destructive">Clear All Application Data</p>
                  <p className="text-xs text-muted-foreground">Permanently deletes all products, sales & transactions</p>
                </div>
              </div>
              <Button variant="destructive" onClick={handleClearAllData} className="w-full h-11 rounded-xl">
                Clear All Data
              </Button>
            </div>
          </MobileCard>
        </div>

      </div>
    </MobileAppShell>
  )
}
