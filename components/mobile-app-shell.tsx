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
    <div className="min-h-screen bg-background">
      {/* Native-style header */}
      {(title || headerAction) && (
        <div className="sticky top-0 z-40 bg-background border-b border-border/50 shadow-sm">
          <div className="container mx-auto px-4 py-2.5">
            <div className="flex items-center justify-between gap-2">
              {/* Left: page title + store identity */}
              <div className="flex-1 min-w-0">
                {title && (
                  <h1 className="text-[15px] font-bold text-foreground truncate leading-tight">
                    {title}
                  </h1>
                )}
                {/* Store identity row */}
                {storeName && (
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-[11px] font-semibold text-primary truncate max-w-[140px]">
                      {storeName}
                    </span>
                    {storeId && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        · ID {storeId}
                      </span>
                    )}
                    {branchName && (
                      <span className="text-[9px] bg-blue-100 text-blue-700 font-semibold px-1.5 py-0.5 rounded-full">
                        {branchName}
                      </span>
                    )}
                  </div>
                )}
                {/* Fallback subtitle if no session yet */}
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
            <div className="border-t border-border/40 bg-background px-4 py-2">
              {stickyBar}
            </div>
          )}
        </div>
      )}

      {/* Content area */}
      <div
        className={cn(
          "container mx-auto pb-24",
          !noPadding && "px-4 py-4",
          className
        )}
      >
        {children}
      </div>
    </div>
  )
}

// Native-style card component
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
        "bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden",
        onClick && "active:scale-[0.98] transition-transform cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

// Native-style section header
export function MobileSectionHeader({
  title,
  action,
}: {
  title: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {title}
      </h2>
      {action}
    </div>
  )
}
