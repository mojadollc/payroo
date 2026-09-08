"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  Store, Package, TrendingUp, Settings, Home,
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"

const NAV_ITEMS = [
  { href: "/home",     label: "Home",     icon: Home },
  { href: "/pos",      label: "POS",      icon: Store },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/reports",  label: "Reports",  icon: TrendingUp },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function MobileBottomNav() {
  const pathname = usePathname()
  const { user, loading } = useAuth()

  if (!user || loading) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden safe-area-bottom">
      <div className="mx-4 mb-3 rounded-2xl bg-white shadow-[0_2px_20px_rgba(0,0,0,0.08)] border border-neutral-100">
        <div className="flex items-stretch justify-around">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon
            const active = pathname === item.href || (item.href !== "/home" && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center flex-1 py-2.5 gap-1 min-h-[52px] active:scale-95 transition-transform ${
                  active ? "text-primary" : "text-neutral-400"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : "stroke-[1.5]"}`} />
                <span className={`text-[10px] font-medium ${active ? "text-primary" : "text-neutral-400"}`}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
