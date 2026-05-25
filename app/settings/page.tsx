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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
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

const FEATURE_INFO: Record<keyof SubscriptionFeatures, { label: string }> = {
  pos: { label: "POS System" },
  inventory: { label: "Inventory" },
  ewallet: { label: "E-Wallet" },
  reports: { label: "Reports" },
  loyalty: { label: "Loyalty" },
  utang: { label: "Utang" },
  aiRestock: { label: "AI Restock" },
  multiUser: { label: "Multi-User" },
  exportData: { label: "Export" },
  marketIntelligence: { label: "Market Intel" },
  delivery: { label: "Delivery" },
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
  const [region, setRegion] = useState("")
  const [province, setProvince] = useState("")
  const [city, setCity] = useState("")
  const [barangay, setBarangay] = useState("")
  const [locationSaved, setLocationSaved] = useState(false)

  // Dialog states
  const [editField, setEditField] = useState<"name" | "address" | "phone" | "type" | "location" | null>(null)

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
    setEditField(null)
  }

  const handleSaveStoreAddress = async () => {
    await saveStoreSettings({ address: storeAddressInput })
    setStoreAddress(storeAddressInput)
    localStorage.removeItem("pos_subscription")
    toast({ title: "Store address updated" })
    setEditField(null)
  }

  const handleSaveStorePhone = async () => {
    await saveStoreSettings({ phone: storePhoneInput })
    setStorePhone(storePhoneInput)
    localStorage.removeItem("pos_subscription")
    toast({ title: "Store phone updated" })
    setEditField(null)
  }

  const handleSaveBusinessType = async (type: BusinessType) => {
    setBusinessType(type)
    await saveStoreSettings({ businessType: type })
    localStorage.setItem("businessType", type)
    localStorage.removeItem("pos_subscription")
    window.dispatchEvent(new Event("businesstype"))
    toast({ title: `Business type set to ${getBusinessConfig(type).label}` })
    setEditField(null)
  }

  const handleSaveLocation = async () => {
    if (!region || !city) {
      toast({ title: "Region and City are required", variant: "destructive" })
      return
    }
    await saveStoreSettings({ region, province, city, barangay })
    setLocationSaved(true)
    toast({ title: "Store location saved" })
    setEditField(null)
  }

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
        } finally { setFetchingLocation(false) }
      },
      () => { toast({ title: "Location access denied", variant: "destructive" }); setFetchingLocation(false) }
    )
  }

  const handleClearAllData = async () => {
    if (!window.confirm("DANGER: Delete ALL data? This cannot be undone.")) return
    if (!window.confirm("SECOND CONFIRMATION: Are you absolutely sure?")) return
    try {
      await clearAllData()
      toast({ title: "All data cleared", description: "Please refresh the page." })
    } catch {
      toast({ title: "Error", description: "Failed to clear data.", variant: "destructive" })
    }
  }

  const daysLeft = endDate ? Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null
  const tierCfg = TIER_CONFIG[tier || "basic"] || TIER_CONFIG.basic
  const enabledFeatures = Object.entries(features).filter(([, v]) => v).map(([k]) => k)
  const disabledFeatures = Object.entries(features).filter(([, v]) => !v).map(([k]) => k)
  const cfg = getBusinessConfig(businessType)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background border-b shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-3">
          <h1 className="text-[17px] font-bold">Settings</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 pb-24 space-y-6">

        {/* Subscription Card */}
        <div className="rounded-2xl border overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-slate-50 to-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${tierCfg.bg} ${tierCfg.color}`}>{tierCfg.icon}</div>
              <div>
                <div className="text-[14px] font-bold">{tier?.toUpperCase()} Plan</div>
                <div className="text-[11px] text-muted-foreground">
                  {isActive ? (daysLeft !== null ? `${daysLeft} days left` : "Active") : "Expired"}
                </div>
              </div>
            </div>
            <Link href="/subscription">
              <Button size="sm" variant="outline" className="h-8 text-[12px] rounded-lg">
                {isActive ? "Manage" : "Renew"} <ChevronRight className="h-3 w-3 ml-0.5" />
              </Button>
            </Link>
          </div>
          <div className="px-4 py-2.5 flex flex-wrap gap-1.5 border-t">
            {enabledFeatures.map(key => (
              <span key={key} className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">
                {FEATURE_INFO[key as keyof SubscriptionFeatures]?.label}
              </span>
            ))}
            {disabledFeatures.map(key => (
              <span key={key} className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400 font-medium line-through">
                {FEATURE_INFO[key as keyof SubscriptionFeatures]?.label}
              </span>
            ))}
          </div>
        </div>

        {/* Store Info Section */}
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-2">Store Information</p>
          <div className="rounded-2xl border overflow-hidden divide-y">
            {/* Store Name */}
            <button className="w-full flex items-center gap-3 p-3.5 hover:bg-muted/50 active:bg-muted transition-colors text-left" onClick={() => setEditField("name")}>
              <div className="p-2 bg-blue-100 rounded-xl"><Store className="h-4 w-4 text-blue-600" /></div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium">Store Name</div>
                <div className="text-[12px] text-muted-foreground truncate">{storeName}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </button>

            {/* Address */}
            <button className="w-full flex items-center gap-3 p-3.5 hover:bg-muted/50 active:bg-muted transition-colors text-left" onClick={() => setEditField("address")}>
              <div className="p-2 bg-green-100 rounded-xl"><MapPin className="h-4 w-4 text-green-600" /></div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium">Address</div>
                <div className="text-[12px] text-muted-foreground truncate">{storeAddress || "Not set"}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </button>

            {/* Phone */}
            <button className="w-full flex items-center gap-3 p-3.5 hover:bg-muted/50 active:bg-muted transition-colors text-left" onClick={() => setEditField("phone")}>
              <div className="p-2 bg-purple-100 rounded-xl"><Phone className="h-4 w-4 text-purple-600" /></div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium">Contact Number</div>
                <div className="text-[12px] text-muted-foreground truncate">{storePhone || "Not set"}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </button>

            {/* Business Type */}
            <button className="w-full flex items-center gap-3 p-3.5 hover:bg-muted/50 active:bg-muted transition-colors text-left" onClick={() => setEditField("type")}>
              <div className="p-2 bg-yellow-100 rounded-xl"><Building2 className="h-4 w-4 text-yellow-600" /></div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium">Business Type</div>
                <div className="text-[12px] text-muted-foreground truncate">{cfg.label}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </button>
          </div>
        </div>

        {/* Market Intelligence */}
        {features.marketIntelligence && (
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-2">Market Intelligence</p>
            <div className="rounded-2xl border overflow-hidden">
              <button className="w-full flex items-center gap-3 p-3.5 hover:bg-muted/50 active:bg-muted transition-colors text-left" onClick={() => setEditField("location")}>
                <div className="p-2 bg-teal-100 rounded-xl"><Globe className="h-4 w-4 text-teal-600" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium">Store Location</div>
                  <div className="text-[12px] text-muted-foreground truncate">
                    {city && region ? `${city}, ${region}` : "Not set"}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </button>
            </div>
          </div>
        )}

        {/* Danger Zone */}
        <div>
          <p className="text-[11px] font-semibold text-destructive uppercase tracking-wide px-1 mb-2">Danger Zone</p>
          <div className="rounded-2xl border border-destructive/20 overflow-hidden">
            <button className="w-full flex items-center gap-3 p-3.5 hover:bg-red-50 active:bg-red-100 transition-colors text-left" onClick={handleClearAllData}>
              <div className="p-2 bg-red-100 rounded-xl"><ServerCrash className="h-4 w-4 text-red-600" /></div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-destructive">Clear All Data</div>
                <div className="text-[12px] text-muted-foreground">Delete all products, sales & transactions</div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Edit Store Name Dialog */}
      <Dialog open={editField === "name"} onOpenChange={(o) => !o && setEditField(null)}>
        <DialogContent className="max-w-sm p-4">
          <DialogHeader>
            <DialogTitle className="text-[15px]">Store Name</DialogTitle>
            <DialogDescription className="text-[12px]">This appears in your navbar and receipts</DialogDescription>
          </DialogHeader>
          <Input value={storeNameInput} onChange={e => setStoreNameInput(e.target.value)} className="h-10 text-[14px] mt-2" placeholder="Enter store name" />
          <Button onClick={handleSaveStoreName} disabled={!storeNameInput.trim() || storeNameInput === storeName} className="w-full h-10 mt-2 text-[13px]">Save</Button>
        </DialogContent>
      </Dialog>

      {/* Edit Address Dialog */}
      <Dialog open={editField === "address"} onOpenChange={(o) => !o && setEditField(null)}>
        <DialogContent className="max-w-sm p-4">
          <DialogHeader>
            <DialogTitle className="text-[15px]">Store Address</DialogTitle>
            <DialogDescription className="text-[12px]">Used on receipts and reports</DialogDescription>
          </DialogHeader>
          <Input value={storeAddressInput} onChange={e => setStoreAddressInput(e.target.value)} className="h-10 text-[14px] mt-2" placeholder="Enter address" />
          <Button variant="outline" onClick={handleFetchLocation} disabled={fetchingLocation} className="w-full h-9 mt-1 text-[12px] gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> {fetchingLocation ? "Fetching..." : "Use My Location"}
          </Button>
          <Button onClick={handleSaveStoreAddress} disabled={!storeAddressInput.trim() || storeAddressInput === storeAddress} className="w-full h-10 mt-1 text-[13px]">Save</Button>
        </DialogContent>
      </Dialog>

      {/* Edit Phone Dialog */}
      <Dialog open={editField === "phone"} onOpenChange={(o) => !o && setEditField(null)}>
        <DialogContent className="max-w-sm p-4">
          <DialogHeader>
            <DialogTitle className="text-[15px]">Contact Number</DialogTitle>
            <DialogDescription className="text-[12px]">Printed on receipts</DialogDescription>
          </DialogHeader>
          <Input value={storePhoneInput} onChange={e => setStorePhoneInput(e.target.value)} className="h-10 text-[14px] mt-2" placeholder="09XX-XXX-XXXX" type="tel" />
          <Button onClick={handleSaveStorePhone} disabled={!storePhoneInput.trim() || storePhoneInput === storePhone} className="w-full h-10 mt-2 text-[13px]">Save</Button>
        </DialogContent>
      </Dialog>

      {/* Business Type Dialog */}
      <Dialog open={editField === "type"} onOpenChange={(o) => !o && setEditField(null)}>
        <DialogContent className="max-w-sm p-4 max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[15px]">Business Type</DialogTitle>
            <DialogDescription className="text-[12px]">Choose what best describes your store</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 mt-2">
            {BUSINESS_TYPE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleSaveBusinessType(opt.value as BusinessType)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all active:scale-[0.98] ${
                  businessType === opt.value ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <div>
                  <div className="text-[13px] font-medium">{opt.label}</div>
                  <div className="text-[11px] text-muted-foreground">{opt.description}</div>
                </div>
                {businessType === opt.value && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Location Dialog */}
      <Dialog open={editField === "location"} onOpenChange={(o) => !o && setEditField(null)}>
        <DialogContent className="max-w-sm p-4">
          <DialogHeader>
            <DialogTitle className="text-[15px]">Store Location</DialogTitle>
            <DialogDescription className="text-[12px]">For market intelligence data</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px]">Region *</Label>
                <select value={region} onChange={e => setRegion(e.target.value)} className="w-full h-9 rounded-lg border px-2 text-[13px] mt-1">
                  <option value="">Select</option>
                  {PH_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-[11px]">Province</Label>
                <Input value={province} onChange={e => setProvince(e.target.value)} className="h-9 text-[13px] mt-1" placeholder="e.g. Cebu" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px]">City *</Label>
                <Input value={city} onChange={e => setCity(e.target.value)} className="h-9 text-[13px] mt-1" placeholder="e.g. Cebu City" />
              </div>
              <div>
                <Label className="text-[11px]">Barangay</Label>
                <Input value={barangay} onChange={e => setBarangay(e.target.value)} className="h-9 text-[13px] mt-1" placeholder="e.g. Lahug" />
              </div>
            </div>
            <Button onClick={handleSaveLocation} disabled={!region || !city} className="w-full h-10 text-[13px]">Save Location</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
