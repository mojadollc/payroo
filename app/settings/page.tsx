"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  Store, MapPin, Phone, Crown, ChevronRight, Zap, Star,
  HandCoins, Receipt, Star as Loyalty, Brain, FileText, ListChecks, Truck, Users, BarChart2,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useSubscription } from "@/hooks/use-subscription"
import { getStoreId } from "@/lib/store-id"
import { useAuth } from "@/hooks/use-auth"

const QUICK_SETTINGS = [
  { href: "/utang",         label: "Utang",         icon: HandCoins,  desc: "Credit tracking" },
  { href: "/loyalty",       label: "Loyalty",       icon: Loyalty,    desc: "Customer rewards" },
  { href: "/restock",       label: "AI Restock",    icon: Brain,      desc: "Smart ordering" },
  { href: "/elista",        label: "e-Lista",       icon: FileText,   desc: "Customer list" },
  { href: "/checklist",     label: "Checklist",     icon: ListChecks, desc: "Daily tasks" },
  { href: "/delivery-manage", label: "Delivery",    icon: Truck,      desc: "Online orders" },
  { href: "/bills",         label: "Pay Bills",     icon: Receipt,    desc: "Bill payments" },
  { href: "/market-intelligence", label: "Market Intel", icon: BarChart2, desc: "Trends" },
  { href: "/users",         label: "Users",         icon: Users,      desc: "Staff & roles" },
]

export default function SettingsPage() {
  const { toast } = useToast()
  const { tier, isActive, endDate, features } = useSubscription()
  const { user } = useAuth()
  const [storeName, setStoreName] = useState("My Store")

  useEffect(() => {
    const storeId = getStoreId()
    if (!storeId) return
    fetch(`/api/store-settings?storeId=${storeId}`)
      .then(r => r.json())
      .then(({ data }) => {
        if (data?.name) setStoreName(data.name)
      })
  }, [])

  const daysLeft = endDate
    ? Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null

  const isOwner = user?.role === "owner"

  const visibleSettings = QUICK_SETTINGS.filter(item => {
    if (!isOwner) return false
    if (item.href === "/loyalty" && !features.loyalty) return false
    if (item.href === "/restock" && !features.aiRestock) return false
    if (item.href === "/market-intelligence" && !features.marketIntelligence) return false
    if (item.href === "/delivery-manage" && !features.delivery) return false
    if (item.href === "/utang" && !features.utang) return false
    if (item.href === "/users" && !features.multiUser) return false
    return true
  })

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      {/* Header */}
      <div className="bg-primary px-5 pt-14 pb-6">
        <h1 className="text-xl font-bold text-amber-950">Settings</h1>
      </div>

      <div className="px-5 -mt-3 space-y-4">
        {/* Subscription Card */}
        <Link href="/subscription">
          <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                tier === "gold" ? "bg-yellow-100" : tier === "enterprise" ? "bg-purple-100" : "bg-neutral-100"
              }`}>
                {tier === "gold" ? (
                  <Star className="h-5 w-5 text-yellow-600" />
                ) : tier === "enterprise" ? (
                  <Crown className="h-5 w-5 text-purple-600" />
                ) : (
                  <Zap className="h-5 w-5 text-neutral-600" />
                )}
              </div>
              <div>
                <p className="font-semibold text-sm text-neutral-900">
                  {tier ? tier.charAt(0).toUpperCase() + tier.slice(1) + " Plan" : "Free Plan"}
                </p>
                <p className="text-xs text-neutral-500">
                  {isActive
                    ? daysLeft !== null ? `${daysLeft} days remaining` : "Active"
                    : "Expired"}
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-neutral-300" />
          </div>
        </Link>

        {/* Store Info */}
        <Link href="/settings/store">
          <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <Store className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-sm text-neutral-900">{storeName}</p>
                <p className="text-xs text-neutral-500">Edit store details</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-neutral-300" />
          </div>
        </Link>

        {/* Features Grid */}
        {isOwner && visibleSettings.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2">Features</p>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-neutral-100">
              {visibleSettings.map((item) => {
                const Icon = item.icon
                return (
                  <Link key={item.href} href={item.href}>
                    <div className="flex items-center gap-3 p-3.5 active:bg-neutral-50 transition-colors">
                      <Icon className="h-5 w-5 text-neutral-400" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-neutral-900">{item.label}</p>
                        <p className="text-xs text-neutral-400">{item.desc}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-neutral-300" />
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* App Info */}
        <p className="text-center text-xs text-neutral-400 pt-4">
          Payroo POS v2.0 · Made with ❤️ in the Philippines
        </p>
      </div>
    </div>
  )
}
