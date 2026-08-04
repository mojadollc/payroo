"use client"

import { useEffect, useState } from "react"
import { Building2, Check, ChevronDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  getStoreId,
  getMainStoreId,
  getCachedBranches,
  switchBranch,
  type CachedBranch,
} from "@/lib/store-id"
import { listBranches } from "@/lib/firebase/branch-services"
import { useAuth } from "@/hooks/use-auth"

/**
 * Compact branch switcher for the navbar / mobile header.
 * Owner & subadmin can switch; cashiers stay on their assigned branch.
 */
export function BranchSwitcher({ className }: { className?: string }) {
  const { user } = useAuth()
  const [branches, setBranches] = useState<CachedBranch[]>(() => getCachedBranches())
  const [loading, setLoading] = useState(false)
  const [activeId, setActiveId] = useState(getStoreId())

  const canSwitch = !user || user.role === "owner" || user.role === "subadmin"

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!canSwitch) return
      setLoading(true)
      try {
        const list = await listBranches(getMainStoreId())
        if (cancelled) return
        setBranches(
          list.map(b => ({
            externalId: b.branchExternalId,
            name: b.branchName,
            isMain: !!b.isMain,
          }))
        )
        setActiveId(getStoreId())
      } catch (e) {
        console.warn("[BranchSwitcher]", e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [canSwitch])

  // Only show when there is more than one location
  if (!canSwitch || branches.length <= 1) {
    return null
  }

  const active = branches.find(b => b.externalId === activeId) || branches[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-8 gap-1.5 max-w-[160px] ${className || ""}`}
        >
          <Building2 className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate text-xs font-medium">{active?.name || "Branch"}</span>
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin shrink-0" />
          ) : (
            <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Switch branch
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {branches.map(b => {
          const isActive = b.externalId === activeId
          return (
            <DropdownMenuItem
              key={b.externalId}
              disabled={isActive}
              onClick={() => {
                if (!isActive) switchBranch(b.externalId, b.name)
              }}
              className="flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-sm">{b.name}</div>
                <div className="text-[10px] text-muted-foreground">
                  ID: {b.externalId}
                  {b.isMain ? " · Main" : ""}
                </div>
              </div>
              {isActive && <Check className="h-4 w-4 text-primary shrink-0" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
