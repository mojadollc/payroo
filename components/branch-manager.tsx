"use client"

import { useEffect, useState } from "react"
import { Building2, Plus, MapPin, Phone, Trash2, Loader2, Store } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { getStoreId, getMainStoreId, switchBranch, cacheBranches } from "@/lib/store-id"
import { useAuth } from "@/hooks/use-auth"

interface Branch {
  id: string
  mainExternalId: string
  branchExternalId: string
  branchName: string
  address?: string
  phone?: string
  isActive: boolean
  isMain?: boolean
}

export function BranchManager() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const activeId = getStoreId()

  const [form, setForm] = useState({
    branchName: "", branchExternalId: "", address: "", phone: "", ownerPin: "",
  })

  const isOwner = user?.role === "owner"

  const reload = async () => {
    setLoading(true)
    try {
      const mainId = getMainStoreId()
      if (!mainId) { setLoading(false); return }

      const res = await fetch(`/api/branches?mainExternalId=${mainId}`)
      const { data, error } = await res.json()
      if (error) throw new Error(error)

      // Get main store name from subscription cache
      let mainName = "Main Store"
      try {
        const subRaw = localStorage.getItem("pos_subscription")
        if (subRaw) {
          const sub = JSON.parse(subRaw)
          if (sub?.storeName) mainName = sub.storeName
        }
      } catch {}

      const list: Branch[] = [
        { id: "main", mainExternalId: mainId, branchExternalId: mainId, branchName: mainName, isActive: true, isMain: true },
        ...(data ?? []),
      ]

      cacheBranches(list.map(b => ({ externalId: b.branchExternalId, name: b.branchName, isMain: !!b.isMain })))
      setBranches(list)
    } catch (e) {
      console.error(e)
      toast({ title: "Failed to load branches", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { reload() }, [])

  const generateId = () => {
    const n = String(Math.floor(1000 + Math.random() * 9000))
    setForm(f => ({ ...f, branchExternalId: n }))
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isOwner) { toast({ title: "Only the owner can add branches", variant: "destructive" }); return }
    setSaving(true)
    try {
      const mainId = getMainStoreId()
      const res = await fetch("/api/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mainExternalId: mainId, ...form }),
      })
      const { data, error } = await res.json()
      if (error) throw new Error(error)
      toast({ title: "Branch created", description: `${form.branchName} (ID: ${form.branchExternalId}) is ready.` })
      setShowAdd(false)
      setForm({ branchName: "", branchExternalId: "", address: "", phone: "", ownerPin: "" })
      await reload()
    } catch (err) {
      toast({ title: "Could not create branch", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async (b: Branch) => {
    if (b.isMain || b.id === "main") return
    if (!confirm(`Deactivate branch "${b.branchName}"?`)) return
    try {
      await fetch("/api/branches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: b.id, isActive: false }),
      })
      toast({ title: "Branch deactivated" })
      if (activeId === b.branchExternalId) { switchBranch(getMainStoreId()); return }
      await reload()
    } catch {
      toast({ title: "Failed to deactivate", variant: "destructive" })
    }
  }

  if (!isOwner && !user) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" />
              Branches / Multi-Store
            </CardTitle>
            <CardDescription className="mt-1">
              Manage other locations under your main store. Each branch has its own inventory,
              sales, and e-wallet. Switch branch anytime from the top bar.
            </CardDescription>
          </div>
          {isOwner && (
            <Button size="sm" className="shrink-0 gap-1" onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4" /> Add Branch
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading branches...
          </div>
        ) : (
          branches.map(b => {
            const isActive = b.branchExternalId === activeId
            return (
              <div
                key={b.id || b.branchExternalId}
                className={`flex items-start justify-between gap-3 rounded-lg border p-3 ${isActive ? "border-primary bg-primary/5" : ""}`}
              >
                <div className="min-w-0 flex gap-3">
                  <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Store className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm flex items-center gap-2">
                      <span className="truncate">{b.branchName}</span>
                      {b.isMain && <span className="text-[10px] uppercase tracking-wide bg-primary/10 text-primary px-1.5 py-0.5 rounded">Main</span>}
                      {isActive && <span className="text-[10px] uppercase tracking-wide bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Active</span>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Store ID: <span className="font-mono">{b.branchExternalId}</span>
                    </div>
                    {(b.address || b.phone) && (
                      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        {b.address && <div className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {b.address}</div>}
                        {b.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" /> {b.phone}</div>}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  {!isActive && (
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => switchBranch(b.branchExternalId, b.branchName)}>
                      Switch
                    </Button>
                  )}
                  {!b.isMain && isOwner && (
                    <Button size="sm" variant="ghost" className="h-8 text-xs text-destructive" onClick={() => handleDeactivate(b)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })
        )}

        {!loading && branches.length <= 1 && (
          <p className="text-sm text-muted-foreground text-center py-2">
            You only have one store. Click <strong>Add Branch</strong> to register another location.
          </p>
        )}
      </CardContent>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add branch store</DialogTitle>
            <DialogDescription>
              Creates a separate Store ID with its own products, sales, and stock.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="branchName">Branch name *</Label>
              <Input id="branchName" placeholder="e.g. Store 2 – Ayala" value={form.branchName} onChange={e => setForm({ ...form, branchName: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="branchExternalId">Branch Store ID *</Label>
              <div className="flex gap-2">
                <Input id="branchExternalId" placeholder="4–8 digits/chars" value={form.branchExternalId} onChange={e => setForm({ ...form, branchExternalId: e.target.value.replace(/\s/g, "") })} required minLength={4} maxLength={8} className="font-mono" />
                <Button type="button" variant="outline" onClick={generateId}>Generate</Button>
              </div>
              <p className="text-[11px] text-muted-foreground">Staff can log in with this ID + PIN.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address">Address (optional)</Label>
              <Input id="address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input id="phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ownerPin">Branch owner PIN (optional)</Label>
              <Input id="ownerPin" type="password" inputMode="numeric" placeholder="PIN for branch login" value={form.ownerPin} onChange={e => setForm({ ...form, ownerPin: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAdd(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Creating..." : "Create branch"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
