"use client"

import { ReactNode, useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { getSession } from "@/lib/pos-session"

interface MobileAppShellProps {
  children: ReactNode
  title?: string
  subtitle?: string
  headerAction?: ReactNode
  stickyBar?: ReactNode
  className?: string
  noPadding?: boolean
}

export function MobileAppShell({
  children,
  title,
  subtitle,
  headerAction,
  stickyBar,
  className,
  noPadding = false,
}: MobileAppShellProps) {
  const [session, setSession_] = useState<ReturnType<typeof getSession>>(null)

  useEffect(() => {
    setSession_(getSession())
    const handler = () => setSession_(getSession())
    window.addEventListener("storename", handler)
    return () => window.removeEventListener("storename", handler)
  }, [])

  const storeName = session?.storeName
  const storeId = session?.externalId
  const branchName = session?.branchName

  return (
    <div className="min-h-screen bg-[oklch(0.97_0.008_90)]">
      {/* Glass header */}
      {(title || headerAction) && (
        <div className="sticky top-0 z-40 glass-header">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                {title && (
                  <h1 className="text-[16px] font-bold text-foreground truncate leading-tight tracking-tight">
                    {title}
                  </h1>
                )}
                {storeName && (
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-[11px] font-semibold text-primary truncate max-w-[140px]">
                      {storeName}
                    </span>
                    {storeId && (
                      <span className="text-[10px] text-muted-foreground font-mono">· {storeId}</span>
                    )}
                    {branchName && (
                      <span className="text-[9px] bg-primary/15 text-primary font-semibold px-2 py-0.5 rounded-full">
                        {branchName}
                      </span>
                    )}
                  </div>
                )}
                {!storeName && subtitle && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{subtitle}</p>
                )}
              </div>
              {headerAction && (
                <div className="ml-2 flex-shrink-0">{headerAction}</div>
              )}
            </div>
          </div>
          {stickyBar && (
            <div className="border-t border-border/30 px-4 py-2.5">
              {stickyBar}
            </div>
          )}
        </div>
      )}

      {/* Content area */}
      <div
        className={cn(
          "mx-auto pb-28",
          !noPadding && "px-4 py-4",
          className
        )}
      >
        {children}
      </div>
    </div>
  )
}

// Modern glass card
export function MobileCard({
  children,
  className,
  onClick,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
}) {
  return (
    <div
      className={cn(
        "bg-white/80 backdrop-blur-sm rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.06)] border border-white/60 overflow-hidden",
        onClick && "active:scale-[0.97] transition-all duration-150 cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

// Section header
export function MobileSectionHeader({
  title,
  action,
}: {
  title: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
        {title}
      </h2>
      {action}
    </div>
  )
}
