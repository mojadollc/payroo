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
 * Branch switcher — always offers Main + linked branches.
 * Never hides when you are on a branch (so you can switch back).
 */
export function BranchSwitcher({ className }: { className?: string }) {
  const { user } = useAuth()
  const [branches, setBranches] = useState<CachedBranch[]>(() => getCachedBranches())
  const [loading, setLoading] = useState(false)
  const [activeId, setActiveId] = useState("")
  const [mounted, setMounted] = useState(false)

  const canSwitch = !user || user.role === "owner" || user.role === "subadmin"

  useEffect(() => {
    setMounted(true)
    setActiveId(getStoreId())
  }, [])

  useEffect(() => {
    if (!canSwitch || !mounted) return
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const list = await listBranches(getMainStoreId())
        if (cancelled) return
        const mapped = list.map(b => ({
          externalId: b.branchExternalId,
          name: b.branchName,
          isMain: !!b.isMain,
        }))
        setBranches(mapped)
        setActiveId(getStoreId())
      } catch (e) {
        console.warn("[BranchSwitcher]", e)
        // Keep cached list so user can still switch back to main
        const cached = getCachedBranches()
        if (cached.length) setBranches(cached)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [canSwitch, mounted])

  // Avoid hydration mismatch — render nothing until client mounted
  if (!mounted || !canSwitch) return null

  // Show if we have 2+ locations OR we're not on main (so user can return)
  const mainId = getMainStoreId()
  const notOnMain = activeId && mainId && activeId !== mainId
  if (branches.length <= 1 && !notOnMain) return null

  // Ensure main is present in the list when not on main
  let displayList = branches
  if (notOnMain && !branches.some(b => b.externalId === mainId)) {
    displayList = [
      { externalId: mainId, name: "Main Store", isMain: true },
      ...branches,
    ]
  }

  const active =
    displayList.find(b => b.externalId === activeId) ||
    displayList[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-8 gap-1.5 max-w-[180px] ${className || ""}`}
        >
          <Building2 className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate text-xs font-medium">
            {active?.name || "Branch"}
          </span>
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
        {displayList.map(b => {
          const isActive = b.externalId === activeId
          return (
            <DropdownMenuItem
              key={b.externalId}
              disabled={isActive}
              onSelect={(e) => {
                e.preventDefault()
                if (!isActive) switchBranch(b.externalId, b.name)
              }}
              className="flex items-center justify-between gap-2 cursor-pointer"
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
