"use client"

import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface FloatingActionButtonProps {
  onClick: () => void
  icon: ReactNode
  label?: string
  badge?: number
  className?: string
  size?: "default" | "sm"
  position?: "bottom-right" | "bottom-left" | "bottom-center"
}

export function FloatingActionButton({
  onClick,
  icon,
  label,
  badge,
  className,
  size = "default",
  position = "bottom-right",
}: FloatingActionButtonProps) {
  const positionClasses = {
    "bottom-right": "bottom-24 right-4",
    "bottom-left": "bottom-24 left-4",
    "bottom-center": "bottom-24 left-1/2 -translate-x-1/2",
  }

  const sizeClasses =
    size === "sm"
      ? label
        ? "rounded-full px-3.5 h-11 text-sm gap-1.5 shadow-lg"
        : "rounded-full w-12 h-12 shadow-lg"
      : label
        ? "rounded-full px-6 h-14 shadow-2xl shadow-primary/50"
        : "rounded-full w-16 h-16 shadow-2xl shadow-primary/50"

  return (
    <button
      onClick={onClick}
      className={cn(
        "fixed z-40 md:hidden",
        "flex items-center justify-center",
        "bg-primary text-primary-foreground",
        "active:scale-95 transition-all duration-200",
        "font-semibold",
        sizeClasses,
        positionClasses[position],
        className
      )}
    >
      <div className="relative flex items-center justify-center">
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
