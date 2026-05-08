"use client"

import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface MobileAppShellProps {
  children: ReactNode
  title?: string
  subtitle?: string
  headerAction?: ReactNode
  className?: string
  noPadding?: boolean
}

export function MobileAppShell({
  children,
  title,
  subtitle,
  headerAction,
  className,
  noPadding = false,
}: MobileAppShellProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Native-style header */}
      {(title || headerAction) && (
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border/50 shadow-sm">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                {title && (
                  <h1 className="text-lg font-bold text-foreground truncate">
                    {title}
                  </h1>
                )}
                {subtitle && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {subtitle}
                  </p>
                )}
              </div>
              {headerAction && (
                <div className="ml-3 flex-shrink-0">{headerAction}</div>
              )}
            </div>
          </div>
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
