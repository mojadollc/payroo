"use client"

import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface MobileAppShellProps {
  children: ReactNode
  title?: string
  className?: string
}

export function MobileAppShell({ children, title, className }: MobileAppShellProps) {
  return (
    <div className="min-h-screen bg-neutral-50">
      {title && (
        <div className="bg-primary px-5 pt-14 pb-6">
          <h1 className="text-xl font-bold text-amber-950">{title}</h1>
        </div>
      )}
      <div className={cn("px-5 py-4 pb-24", className)}>{children}</div>
    </div>
  )
}

export function MobileCard({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      className={cn(
        "bg-white rounded-2xl p-4 shadow-sm",
        onClick && "active:scale-[0.98] transition-transform cursor-pointer"
      )}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
