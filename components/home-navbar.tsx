"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"

export function HomeNavbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const links = [
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "#pricing" },
    { label: "Business Types", href: "#business-types" },
    { label: "FAQ", href: "#faq" },
  ]

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-white/95 backdrop-blur border-b shadow-sm" : "bg-transparent"}`}>
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.svg" alt="PayrooPOS" className="h-9 w-9 rounded-xl" />
            <div className="leading-tight">
              <span className="font-bold text-lg text-foreground">Payroo POS</span>
              <span className="block text-[10px] text-muted-foreground leading-none">by MOJADOO</span>
            </div>
          </Link>

          {/* Desktop links */}
          <nav className="hidden md:flex items-center gap-1">
            {links.map(l => (
              <a key={l.href} href={l.href} className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted">
                {l.label}
              </a>
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-2">
            <Link href="/affiliate">
              <Button variant="ghost" size="sm">🎁 Earn ₱150</Button>
            </Link>
            <Link href="/management">
              <Button variant="ghost" size="sm">Management</Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">Owner Login</Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="sm">Staff Login</Button>
            </Link>
            <Link href="#pricing">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>

          {/* Mobile toggle */}
          <button className="md:hidden p-2 rounded-md hover:bg-muted" onClick={() => setMobileOpen(v => !v)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-b shadow-lg px-4 pb-4 space-y-1">
          {links.map(l => (
            <a key={l.href} href={l.href} onClick={() => setMobileOpen(false)}
              className="block px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-muted">
              {l.label}
            </a>
          ))}
          <div className="pt-2 flex flex-col gap-2 border-t mt-2">
            <Link href="/affiliate" onClick={() => setMobileOpen(false)}>
              <Button variant="outline" className="w-full">🎁 Earn ₱150 — Affiliate</Button>
            </Link>
            <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
              <Button variant="outline" className="w-full">Owner Login</Button>
            </Link>
            <Link href="/login" onClick={() => setMobileOpen(false)}>
              <Button variant="ghost" className="w-full">Staff Login</Button>
            </Link>
            <Link href="/management" onClick={() => setMobileOpen(false)}>
              <Button variant="ghost" className="w-full">Management</Button>
            </Link>
            <Link href="#pricing" onClick={() => setMobileOpen(false)}>
              <Button className="w-full">Get Started</Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
