"use client"

import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface FloatingActionButtonProps {
  onClick: () => void
  icon: ReactNode
  label?: string
  badge?: number
  className?: string
  position?: "bottom-right" | "bottom-left" | "bottom-center"
}

export function FloatingActionButton({
  onClick,
  icon,
  label,
  badge,
  className,
  position = "bottom-right",
}: FloatingActionButtonProps) {
  const positionClasses = {
    "bottom-right": "bottom-24 right-4",
    "bottom-left": "bottom-24 left-4",
    "bottom-center": "bottom-24 left-1/2 -translate-x-1/2",
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "fixed z-40 md:hidden",
        "flex items-center justify-center gap-2",
        "bg-primary text-primary-foreground",
        "shadow-2xl shadow-primary/50",
        "active:scale-95 transition-all duration-200",
        "font-semibold",
        label ? "rounded-full px-6 h-14" : "rounded-full w-16 h-16",
        positionClasses[position],
        className
      )}
    >
      <div className="relative">
        {icon}
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-background">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </div>
      {label && <span>{label}</span>}
    </button>
  )
}
