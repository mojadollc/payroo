"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Store, MapPin, Phone, ServerCrash, Building2, Globe, Brain, Crown, Lock, ArrowRight, Check, X, Calendar, Zap, Star } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { clearAllData, getStoreSettings, saveStoreSettings } from "@/lib/firebase/services"
import { DEFAULT_STORE_NAME } from "@/components/navbar"
import { BUSINESS_TYPE_OPTIONS, getBusinessConfig, type BusinessType } from "@/lib/business-config"
import { useSubscription } from "@/hooks/use-subscription"
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
}

const TIER_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  basic: { icon: <Zap className="h-4 w-4" />, color: "text-slate-600", bg: "bg-slate-100" },
  gold: { icon: <Star className="h-4 w-4" />, color: "text-yellow-600", bg: "bg-yellow-100" },
  enterprise: { icon: <Crown className="h-4 w-4" />, color: "text-purple-600", bg: "bg-purple-100" },
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

  // Location fields for market intelligence
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
    // Bust the subscription cache so any component reading storeName gets fresh data
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

  // Count remaining full calendar days in local time
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
          // Auto-fill location fields from reverse geocode
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
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your store configuration</p>
      </div>

      <div className="space-y-6">

        {/* ── Subscription Plan Overview ── */}
        <Card className={`border-2 ${tier === "gold" ? "border-yellow-300 bg-gradient-to-r from-yellow-50 to-amber-50" : tier === "enterprise" ? "border-purple-300 bg-gradient-to-r from-purple-50 to-purple-100" : "border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100"}`}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <span className={`p-1.5 rounded-lg ${tierCfg.bg} ${tierCfg.color}`}>{tierCfg.icon}</span>
                  {tier?.toUpperCase()} Plan
                </CardTitle>
                <CardDescription className="mt-1">
                  {ownerName && <span className="font-medium">{ownerName}</span>}
                  {subStoreName && <span> · {subStoreName}</span>}
                </CardDescription>
              </div>
              <Badge className={`${tierCfg.bg} ${tierCfg.color} border-0`}>
                {isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Expired Banner */}
            {!isActive && endDate && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4 space-y-2">
                <p className="text-sm font-semibold text-red-700">🔴 Your subscription has expired</p>
                <p className="text-xs text-red-600">
                  Your plan expired on <strong>{endDate.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}</strong>.
                  The <strong>POS and all features are locked</strong> until you renew your subscription.
                </p>
                <Link href="/subscription">
                  <Button size="sm" className="mt-1 bg-red-600 hover:bg-red-700 text-white gap-1">
                    <ArrowRight className="h-3.5 w-3.5" /> Renew Now
                  </Button>
                </Link>
              </div>
            )}

            {/* Status Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div className="bg-background/60 rounded-lg p-2">
                <p className="text-xs text-muted-foreground">Status</p>
                <p className={`font-semibold ${isActive ? "text-green-600" : "text-red-600"}`}>
                  {isActive ? "✓ Active" : "✗ Inactive"}
                </p>
              </div>
              <div className="bg-background/60 rounded-lg p-2">
                <p className="text-xs text-muted-foreground">Expires</p>
                <p className="font-semibold">
                  {endDate ? endDate.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "N/A"}
                </p>
              </div>
              <div className="bg-background/60 rounded-lg p-2">
                <p className="text-xs text-muted-foreground">Days Left</p>
                <p className={`font-semibold ${daysLeft !== null && daysLeft <= 7 ? "text-orange-600" : ""}`}>
                  {daysLeft !== null ? `${daysLeft} days` : "N/A"}
                </p>
              </div>
              <div className="bg-background/60 rounded-lg p-2">
                <p className="text-xs text-muted-foreground">Features</p>
                <p className="font-semibold">{enabledFeatures.length} / {Object.keys(features).length}</p>
              </div>
            </div>

            {/* Enabled Features */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Your Features</p>
              <div className="flex flex-wrap gap-1.5">
                {enabledFeatures.map(key => (
                  <span key={key} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
                    <Check className="h-3 w-3" /> {FEATURE_INFO[key as keyof SubscriptionFeatures]?.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Disabled Features (Upgrade Prompt) */}
            {disabledFeatures.length > 0 && (
              <div className="border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Locked Features — Upgrade to unlock
                </p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {disabledFeatures.map(key => (
                    <span key={key} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                      <X className="h-3 w-3" /> {FEATURE_INFO[key as keyof SubscriptionFeatures]?.label}
                    </span>
                  ))}
                </div>
                <Link href="/subscription">
                  <Button size="sm" className="gap-1">
                    <ArrowRight className="h-3.5 w-3.5" /> Upgrade Plan
                  </Button>
                </Link>
              </div>
            )}

            {/* Renew Warning */}
            {daysLeft !== null && daysLeft <= 7 && isActive && (
              <div className="bg-orange-100 border border-orange-200 rounded-lg p-3 text-sm text-orange-800">
                ⚠️ Your subscription expires in {daysLeft} days.
                <Link href="/subscription" className="underline font-medium ml-1">Renew now →</Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />

        {/* ── Business Type ── */}
        <div>
          <h2 className="text-lg font-semibold mb-1">Business Type</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Choose your business type to adapt the POS, inventory labels, units, and categories.
          </p>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4" /> Select Business Type
              </CardTitle>
              <CardDescription>This changes how items, stock, and services are labeled throughout the app.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {BUSINESS_TYPE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleSaveBusinessType(opt.value as BusinessType)}
                    className={`text-left rounded-lg border p-3 transition-all hover:border-primary ${
                      businessType === opt.value
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border"
                    }`}
                  >
                    <div className="font-medium text-sm">{opt.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{opt.description}</div>
                  </button>
                ))}
              </div>
              {businessType && (
                <div className="mt-3 rounded-lg bg-muted p-3 text-xs space-y-1">
                  {(() => {
                    const cfg = getBusinessConfig(businessType)
                    return (
                      <>
                        <p><span className="font-medium">Item label:</span> {cfg.itemLabel}</p>
                        <p><span className="font-medium">Price label:</span> {cfg.priceLabel}</p>
                        <p><span className="font-medium">Stock label:</span> {cfg.stockLabel}</p>
                        <p><span className="font-medium">Default units:</span> {cfg.units.slice(0, 5).join(", ")}</p>
                        <p><span className="font-medium">Categories:</span> {cfg.defaultCategories.slice(0, 4).join(", ")}...</p>
                      </>
                    )
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* ── Store Information ── */}
        <div>
          <h2 className="text-lg font-semibold mb-1">Store Information</h2>
          <p className="text-sm text-muted-foreground mb-4">Update your store's public details.</p>
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Store className="h-4 w-4" /> Store Name
                </CardTitle>
                <CardDescription>This name appears in the navbar and receipts.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    value={storeNameInput}
                    onChange={e => setStoreNameInput(e.target.value)}
                    placeholder="Enter store name"
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSaveStoreName}
                    disabled={storeNameInput.trim() === storeName || !storeNameInput.trim()}
                  >
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MapPin className="h-4 w-4" /> Store Address
                </CardTitle>
                <CardDescription>Your store's physical address. Used on receipts and reports.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={storeAddressInput}
                    onChange={e => setStoreAddressInput(e.target.value)}
                    placeholder="Enter store address"
                    className="flex-1"
                  />
                  <Button variant="outline" onClick={handleFetchLocation} disabled={fetchingLocation}>
                    <MapPin className="h-4 w-4 mr-1" />
                    {fetchingLocation ? "Fetching..." : "Use My Location"}
                  </Button>
                  <Button
                    onClick={handleSaveStoreAddress}
                    disabled={storeAddressInput.trim() === storeAddress}
                  >
                    Save
                  </Button>
                </div>
                {storeAddress && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {storeAddress}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Phone className="h-4 w-4" /> Contact Number
                </CardTitle>
                <CardDescription>Your store's phone number. Printed on receipts.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    value={storePhoneInput}
                    onChange={e => setStorePhoneInput(e.target.value)}
                    placeholder="e.g. 09XX-XXX-XXXX"
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSaveStorePhone}
                    disabled={storePhoneInput.trim() === storePhone}
                  >
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Market Intelligence Location (only if feature enabled) ── */}
        {features.marketIntelligence && (
          <>
            <Separator />
            <div>
              <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" /> Market Intelligence Location
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Set your store's exact location so your sales data contributes to the network-wide
                consumer behavior map. This data is anonymized and aggregated — your store name is never shared.
              </p>
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Globe className="h-4 w-4 text-primary" /> Store Location
                  </CardTitle>
                  <CardDescription>
                    Used to tag your sales data by region, city, and barangay for market insights.
                    Click "Use My Location" above to auto-fill these fields.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="region">Region <span className="text-destructive">*</span></Label>
                      <select
                        id="region"
                        value={region}
                        onChange={e => setRegion(e.target.value)}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="">Select region</option>
                        {PH_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="province">Province</Label>
                      <Input
                        id="province"
                        value={province}
                        onChange={e => setProvince(e.target.value)}
                        placeholder="e.g. Cebu Province"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="city">City / Municipality <span className="text-destructive">*</span></Label>
                      <Input
                        id="city"
                        value={city}
                        onChange={e => setCity(e.target.value)}
                        placeholder="e.g. Cebu City"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="barangay">Barangay</Label>
                      <Input
                        id="barangay"
                        value={barangay}
                        onChange={e => setBarangay(e.target.value)}
                        placeholder="e.g. Lahug"
                      />
                    </div>
                  </div>

                  {/* Preview */}
                  {(region || city) && (
                    <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span>
                        {[barangay, city, province, region].filter(Boolean).join(", ")}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <p className="text-xs text-muted-foreground">
                      {locationSaved
                        ? "✅ Location saved — your sales now feed the market intelligence network"
                        : "⚠️ Location not set — sales data won't appear in market insights"}
                    </p>
                    <Button onClick={handleSaveLocation} disabled={!region || !city} size="sm">
                      Save Location
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        <Separator />

        {/* ── Danger Zone ── */}
        <div>
          <h2 className="text-lg font-semibold text-destructive mb-1">Danger Zone</h2>
          <p className="text-sm text-muted-foreground mb-4">Irreversible actions. Proceed with caution.</p>
          <Card className="border-destructive">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base text-destructive">
                <ServerCrash className="h-4 w-4" /> Clear All Application Data
              </CardTitle>
              <CardDescription>
                Permanently deletes all products, sales history, and transactions. Categories are preserved.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={handleClearAllData}>Clear All Data</Button>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  )
}
