"use client"

import { FeatureGate } from "@/components/feature-gate"
import { useState, useEffect } from "react"
import { Users, Plus, Pencil, Trash2, Eye, EyeOff, ShieldCheck, UserCog, User, RefreshCw, ChevronDown, Key, Settings2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { useSubscription } from "@/hooks/use-subscription"
import type { StoreUser, UserRole, SubscriptionFeatures, SubadminPermissions } from "@/lib/firebase/types"
import { MobileAppShell, MobileCard, MobileSectionHeader } from "@/components/mobile-app-shell"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { FloatingActionButton } from "@/components/ui/floating-action-button"

const ROLE_CONFIG: Record<UserRole, { label: string; color: string; bgColor: string; icon: React.ReactNode; desc: string }> = {
  owner: {
    label: "Owner", color: "text-purple-700", bgColor: "bg-purple-100",
    icon: <ShieldCheck className="h-3.5 w-3.5" />,
    desc: "Full access to all features",
  },
  subadmin: {
    label: "Sub-Admin", color: "text-blue-700", bgColor: "bg-blue-100",
    icon: <UserCog className="h-3.5 w-3.5" />,
    desc: "Access to owner-assigned features",
  },
  cashier: {
    label: "Cashier", color: "text-green-700", bgColor: "bg-green-100",
    icon: <User className="h-3.5 w-3.5" />,
    desc: "POS only — process sales",
  },
}

const FEATURE_LABELS: Record<keyof SubscriptionFeatures, string> = {
  pos: "POS",
  inventory: "Inventory",
  ewallet: "E-Wallet",
  reports: "Reports",
  loyalty: "Loyalty",
  utang: "Utang",
  aiRestock: "AI Restock",
  multiUser: "Multi-User",
  exportData: "Export Data",
  marketIntelligence: "Market Intel",
  delivery: "Delivery",
}

const DEFAULT_ALLOWED: Partial<SubscriptionFeatures> = {
  pos: true, inventory: true, ewallet: false, reports: false,
  loyalty: false, utang: false, aiRestock: false, multiUser: false,
  exportData: false, marketIntelligence: false, delivery: false,
}

const DEFAULT_PERMISSIONS: SubadminPermissions = {
  manageUsers: false,
  manageSettings: false,
}

const PERMISSION_LABELS: Record<keyof SubadminPermissions, string> = {
  manageUsers: "User Management",
  manageSettings: "Settings",
}

const EMPTY_FORM = { name: "", username: "", pin: "", role: "cashier" as UserRole, isActive: true, allowedFeatures: DEFAULT_ALLOWED, permissions: DEFAULT_PERMISSIONS }

export default function UsersPage() {
  return (
    <FeatureGate feature="multiUser">
      <UsersPageContent />
    </FeatureGate>
  )
}

function UsersPageContent() {
  const { toast } = useToast()
  const { user: currentUser, can } = useAuth()
  const { features: planFeatures } = useSubscription()

  const [users, setUsers] = useState<StoreUser[]>([])
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<StoreUser | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [showPin, setShowPin] = useState(false)
  const [saving, setSaving] = useState(false)

  const externalId = typeof window !== "undefined" ? (localStorage.getItem("pos_ext_id") ?? "") : ""

  const load = async () => {
    if (!externalId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/store-users?externalId=${externalId}`)
      const { data } = await res.json()
      setUsers(data ?? [])
    } catch {
      toast({ title: "Failed to load users", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Only owner and subadmin can access this page
  if (!can("subadmin")) {
    return (
      <MobileAppShell title="Users" subtitle="User management">
        <div className="min-h-[60vh] flex items-center justify-center">
          <MobileCard className="p-8 text-center max-w-sm mx-auto">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
              <ShieldCheck className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="font-semibold text-lg">Access Denied</p>
            <p className="text-sm text-muted-foreground mt-1">You don't have permission to manage users.</p>
          </MobileCard>
        </div>
      </MobileAppShell>
    )
  }

  const openNew = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowPin(false)
    setDialogOpen(true)
  }

  const openEdit = (u: StoreUser) => {
    setEditing(u)
    setForm({
      name: u.name,
      username: u.username,
      pin: u.pin,
      role: u.role,
      isActive: u.isActive,
      allowedFeatures: u.allowedFeatures ?? DEFAULT_ALLOWED,
      permissions: { ...DEFAULT_PERMISSIONS, ...u.permissions },
    })
    setShowPin(false)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.username.trim() || !form.pin.trim()) {
      toast({ title: "Please fill in all fields", variant: "destructive" })
      return
    }
    if (form.pin.length !== 6) {
      toast({ title: "PIN must be exactly 6 digits", variant: "destructive" })
      return
    }
    // Cashiers can only be added by owner/subadmin; only owner can add subadmin
    if (form.role === "subadmin" && !can("owner")) {
      toast({ title: "Only the owner can add Sub-Admins", variant: "destructive" })
      return
    }
    if (form.role === "owner") {
      toast({ title: "Cannot create another owner account", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const payload: any = { ...form, username: form.username.toLowerCase().trim() }
      // Only save allowedFeatures and permissions for subadmin
      if (form.role !== "subadmin") {
        delete payload.allowedFeatures
        delete payload.permissions
      }
      
      if (editing?.id) {
        await fetch("/api/store-users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing.id, ...payload }) })
        toast({ title: "User updated" })
      } else {
        await fetch("/api/store-users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, externalId }) })
        toast({ title: "User created", description: `${form.name} can now log in as ${form.role}` })
      }
      setDialogOpen(false)
      load()
    } catch (err: any) {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (u: StoreUser) => {
    if (u.role === "owner") { toast({ title: "Cannot delete the owner account", variant: "destructive" }); return }
    if (!confirm(`Remove ${u.name}?`)) return
    await fetch(`/api/store-users?id=${u.id}`, { method: "DELETE" })
    toast({ title: "User removed" })
    load()
  }

  const handleToggleActive = async (u: StoreUser) => {
    if (u.role === "owner") return
    // Subadmins can only toggle cashiers
    if (!can("owner") && u.role === "subadmin") return
    await fetch("/api/store-users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: u.id, isActive: !u.isActive }) })
    toast({ title: u.isActive ? `${u.name} disabled` : `${u.name} enabled` })
    load()
  }

  // Stats
  const ownerCount = users.filter(u => u.role === "owner").length
  const subadminCount = users.filter(u => u.role === "subadmin").length
  const cashierCount = users.filter(u => u.role === "cashier").length
  const activeCount = users.filter(u => u.isActive).length

  return (
    <MobileAppShell
      title="Users"
      subtitle="Manage team access"
      headerAction={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-9">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" className="h-9" onClick={openNew}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline ml-1.5">Add</span>
          </Button>
        </div>
      }
    >
      {/* Mobile View */}
      <div className="md:hidden space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <MobileCard className="p-4 bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-purple-500 rounded-lg">
                <Users className="h-4 w-4 text-white" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Total Users</span>
            </div>
            <div className="text-2xl font-bold text-purple-600">{users.length}</div>
            <div className="text-xs text-muted-foreground mt-1">{activeCount} active</div>
          </MobileCard>

          <MobileCard className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-green-500 rounded-lg">
                <User className="h-4 w-4 text-white" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Cashiers</span>
            </div>
            <div className="text-2xl font-bold text-green-600">{cashierCount}</div>
            <div className="text-xs text-muted-foreground mt-1">POS access</div>
          </MobileCard>

          <MobileCard className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-blue-500 rounded-lg">
                <UserCog className="h-4 w-4 text-white" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Sub-Admins</span>
            </div>
            <div className="text-2xl font-bold text-blue-600">{subadminCount}</div>
            <div className="text-xs text-muted-foreground mt-1">Limited access</div>
          </MobileCard>

          <MobileCard className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-orange-500 rounded-lg">
                <ShieldCheck className="h-4 w-4 text-white" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Owners</span>
            </div>
            <div className="text-2xl font-bold text-orange-600">{ownerCount}</div>
            <div className="text-xs text-muted-foreground mt-1">Full access</div>
          </MobileCard>
        </div>

        {/* Role Legend */}
        <MobileCard className="p-3">
          <div className="grid grid-cols-3 gap-2">
            {(Object.entries(ROLE_CONFIG) as [UserRole, typeof ROLE_CONFIG[UserRole]][]).map(([role, cfg]) => (
              <div key={role} className="text-center p-2 rounded-lg bg-muted/30">
                <div className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${cfg.bgColor} ${cfg.color}`}>
                  {cfg.icon} {cfg.label}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{cfg.desc}</p>
              </div>
            ))}
          </div>
        </MobileCard>

        {/* User List */}
        <div>
          <MobileSectionHeader title="All Users" />
          {users.length === 0 && !loading && (
            <MobileCard className="p-8 text-center">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No users yet</p>
              <p className="text-sm text-muted-foreground mt-1">Add a cashier or sub-admin to get started</p>
            </MobileCard>
          )}
          <div className="space-y-3">
            {users.map(u => {
              const cfg = ROLE_CONFIG[u.role]
              const isCurrentUser = u.id === currentUser?.id
              return (
                <MobileCard key={u.id} className={`p-4 ${!u.isActive ? "opacity-60" : ""}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/10 text-xl font-bold text-primary">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-semibold text-base">{u.name}</p>
                        {isCurrentUser && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">(you)</span>}
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bgColor} ${cfg.color}`}>
                          {cfg.icon} {cfg.label}
                        </span>
                        {!u.isActive && <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Inactive</span>}
                      </div>
                      <p className="text-sm text-muted-foreground">@{u.username}</p>
                      {u.role === "subadmin" && u.allowedFeatures && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {(Object.entries(u.allowedFeatures) as [keyof SubscriptionFeatures, boolean][]).filter(([, v]) => v).map(([k]) => (
                            <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{FEATURE_LABELS[k]}</span>
                          ))}
                          {u.permissions && (Object.entries(u.permissions) as [keyof SubadminPermissions, boolean][]).filter(([, v]) => v).map(([k]) => (
                            <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-600">{PERMISSION_LABELS[k]}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                    {u.role !== "owner" && (can("owner") || (can("subadmin") && u.role === "cashier")) && (
                      <>
                        <div className="flex items-center gap-2 flex-1">
                          <Switch
                            checked={u.isActive}
                            onCheckedChange={() => handleToggleActive(u)}
                            title={u.isActive ? "Disable user" : "Enable user"}
                          />
                          <span className="text-xs text-muted-foreground">{u.isActive ? "Active" : "Inactive"}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-blue-600 hover:bg-blue-50 rounded-lg" onClick={() => openEdit(u)} title="Edit user">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-red-50 rounded-lg" onClick={() => handleDelete(u)} title="Delete user">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {u.role === "owner" && can("owner") && isCurrentUser && (
                      <Button variant="outline" size="sm" className="ml-auto" onClick={() => openEdit(u)}>
                        <Key className="h-4 w-4 mr-1.5" />
                        Change PIN
                      </Button>
                    )}
                  </div>
                </MobileCard>
              )
            })}
          </div>
        </div>
      </div>

      {/* Desktop View */}
      <div className="hidden md:block space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-3 md:grid-cols-4">
          <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Users className="h-8 w-8 text-purple-600" />
                <div className="text-right">
                  <div className="text-lg font-bold text-purple-700">{users.length}</div>
                  <div className="text-xs text-purple-600 font-medium">Total Users</div>
                </div>
              </div>
              <div className="text-xs text-purple-600/80">{activeCount} active</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <ShieldCheck className="h-8 w-8 text-orange-600" />
                <div className="text-right">
                  <div className="text-lg font-bold text-orange-700">{ownerCount}</div>
                  <div className="text-xs text-orange-600 font-medium">Owners</div>
                </div>
              </div>
              <div className="text-xs text-orange-600/80">Full access</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <UserCog className="h-8 w-8 text-blue-600" />
                <div className="text-right">
                  <div className="text-lg font-bold text-blue-700">{subadminCount}</div>
                  <div className="text-xs text-blue-600 font-medium">Sub-Admins</div>
                </div>
              </div>
              <div className="text-xs text-blue-600/80">Limited access</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <User className="h-8 w-8 text-green-600" />
                <div className="text-right">
                  <div className="text-lg font-bold text-green-700">{cashierCount}</div>
                  <div className="text-xs text-green-600 font-medium">Cashiers</div>
                </div>
              </div>
              <div className="text-xs text-green-600/80">POS only</div>
            </CardContent>
          </Card>
        </div>

        {/* Role Legend */}
        <div className="grid grid-cols-3 gap-3">
          {(Object.entries(ROLE_CONFIG) as [UserRole, typeof ROLE_CONFIG[UserRole]][]).map(([role, cfg]) => (
            <Card key={role} className="border-dashed">
              <CardContent className="p-3 space-y-1">
                <div className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bgColor} ${cfg.color}`}>
                  {cfg.icon} {cfg.label}
                </div>
                <p className="text-xs text-muted-foreground">{cfg.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* User List */}
        {users.length === 0 && !loading && (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No users yet</p>
            <p className="text-sm">Add a cashier or sub-admin to get started</p>
          </div>
        )}
        <div className="space-y-3">
          {users.map(u => {
            const cfg = ROLE_CONFIG[u.role]
            const isCurrentUser = u.id === currentUser?.id
            return (
              <Card key={u.id} className={!u.isActive ? "opacity-60" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-bold">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold">{u.name}</p>
                          {isCurrentUser && <span className="text-xs text-muted-foreground">(you)</span>}
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bgColor} ${cfg.color}`}>
                            {cfg.icon} {cfg.label}
                          </span>
                          {!u.isActive && <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Inactive</span>}
                        </div>
                        <p className="text-sm text-muted-foreground">@{u.username}</p>
                        {u.role === "subadmin" && u.allowedFeatures && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(Object.entries(u.allowedFeatures) as [keyof SubscriptionFeatures, boolean][]).filter(([, v]) => v).map(([k]) => (
                              <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{FEATURE_LABELS[k]}</span>
                            ))}
                            {u.permissions && (Object.entries(u.permissions) as [keyof SubadminPermissions, boolean][]).filter(([, v]) => v).map(([k]) => (
                              <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-600">{PERMISSION_LABELS[k]}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {u.role !== "owner" && (can("owner") || (can("subadmin") && u.role === "cashier")) && (
                        <Switch
                          checked={u.isActive}
                          onCheckedChange={() => handleToggleActive(u)}
                          title={u.isActive ? "Disable user" : "Enable user"}
                        />
                      )}
                      {u.role !== "owner" && (can("owner") || (can("subadmin") && u.role === "cashier")) && (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)} title="Edit user">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(u)} title="Delete user">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      {u.role === "owner" && can("owner") && isCurrentUser && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)} title="Edit your PIN">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Floating Add Button (Mobile) */}
      <FloatingActionButton
        icon={<Plus className="h-7 w-7" />}
        label="Add User"
        onClick={openNew}
      />

      {/* Add/Edit Bottom Sheet (Mobile) & Dialog (Desktop) */}
      <BottomSheet
        open={dialogOpen}
        onClose={() => { if (!saving) setDialogOpen(false) }}
        title={editing ? "Edit User" : "Add New User"}
        description="Set user role, username, and PIN"
      >
        <div className="pb-24 md:pb-0 space-y-4">
          <UserForm
            form={form}
            setForm={setForm}
            showPin={showPin}
            setShowPin={setShowPin}
            saving={saving}
            editing={editing}
            planFeatures={planFeatures}
            canOwner={can("owner")}
          />
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button className="flex-1 h-12 rounded-xl" onClick={handleSave} disabled={saving || !form.name || !form.username || !form.pin}>
              {saving ? "Saving..." : editing ? "Save Changes" : "Create User"}
            </Button>
          </div>
        </div>
      </BottomSheet>

      {/* Desktop Dialog */}
      <Dialog open={dialogOpen} onOpenChange={v => { if (!saving) setDialogOpen(v) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit User" : "Add New User"}</DialogTitle>
            <DialogDescription>Set user role, username, and PIN</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <UserForm
              form={form}
              setForm={setForm}
              showPin={showPin}
              setShowPin={setShowPin}
              saving={saving}
              editing={editing}
              planFeatures={planFeatures}
              canOwner={can("owner")}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name || !form.username || !form.pin}>
              {saving ? "Saving..." : editing ? "Save Changes" : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MobileAppShell>
  )
}

// Extracted form component to avoid duplication
function UserForm({ form, setForm, showPin, setShowPin, saving, editing, planFeatures, canOwner }: {
  form: typeof EMPTY_FORM
  setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>
  showPin: boolean
  setShowPin: React.Dispatch<React.SetStateAction<boolean>>
  saving: boolean
  editing: StoreUser | null
  planFeatures: SubscriptionFeatures
  canOwner: boolean
}) {
  return (
    <>
      <div className="space-y-1">
        <Label>Full Name *</Label>
        <Input
          placeholder="e.g. Maria Santos"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          disabled={saving}
          className="h-12 rounded-xl"
        />
      </div>
      <div className="space-y-1">
        <Label>Username *</Label>
        <Input
          placeholder="e.g. maria"
          value={form.username}
          onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/\s/g, "") }))}
          disabled={saving || (!!editing && editing.role === "owner")}
          className="h-12 rounded-xl"
        />
        <p className="text-xs text-muted-foreground">Lowercase, no spaces. Used to log in.</p>
      </div>
      <div className="space-y-1">
        <Label>PIN * <span className="text-muted-foreground text-xs">(6 digits)</span></Label>
        <div className="relative">
          <Input
            type={showPin ? "text" : "password"}
            placeholder="e.g. 123456"
            value={form.pin}
            onChange={e => setForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
            disabled={saving}
            maxLength={6}
            className="h-12 rounded-xl pr-10"
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            onClick={() => setShowPin(v => !v)}
            tabIndex={-1}
          >
            {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className="space-y-1">
        <Label>Role *</Label>
        <Select
          value={form.role}
          onValueChange={v => setForm(f => ({ ...f, role: v as UserRole }))}
          disabled={saving || editing?.role === "owner"}
        >
          <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            {canOwner && <SelectItem value="subadmin">Sub-Admin — manage inventory & features</SelectItem>}
            <SelectItem value="cashier">Cashier — POS only</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          checked={form.isActive}
          onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))}
          disabled={saving}
        />
        <Label>Active (can log in)</Label>
      </div>

      {/* Feature permissions for subadmin */}
      {form.role === "subadmin" && (
        <div className="space-y-2 border rounded-xl p-3 bg-muted/30">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Settings2 className="h-4 w-4" /> Allowed Features
          </Label>
          <p className="text-xs text-muted-foreground">Select which features this sub-admin can access (based on your plan)</p>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {(Object.keys(FEATURE_LABELS) as (keyof SubscriptionFeatures)[]).map(feat => {
              const planHas = planFeatures[feat]
              const isAllowed = form.allowedFeatures?.[feat] ?? false
              // POS is always allowed
              if (feat === "pos") return null
              // Skip features not in plan
              if (!planHas) return null
              return (
                <div key={feat} className="flex items-center gap-2">
                  <Switch
                    checked={isAllowed}
                    onCheckedChange={v => setForm(f => ({
                      ...f,
                      allowedFeatures: { ...f.allowedFeatures, [feat]: v }
                    }))}
                    disabled={saving}
                  />
                  <span className="text-xs">{FEATURE_LABELS[feat]}</span>
                </div>
              )
            })}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">POS is always enabled. Only features in your plan are shown.</p>
        </div>
      )}

      {/* Management permissions for subadmin */}
      {form.role === "subadmin" && (
        <div className="space-y-2 border rounded-xl p-3 bg-muted/30">
          <Label className="text-sm font-medium">Management Access</Label>
          <p className="text-xs text-muted-foreground">Allow this sub-admin to access management pages</p>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {(Object.keys(PERMISSION_LABELS) as (keyof SubadminPermissions)[]).map(perm => (
              <div key={perm} className="flex items-center gap-2">
                <Switch
                  checked={form.permissions?.[perm] ?? false}
                  onCheckedChange={v => setForm(f => ({
                    ...f,
                    permissions: { ...f.permissions, [perm]: v }
                  }))}
                  disabled={saving}
                />
                <span className="text-xs">{PERMISSION_LABELS[perm]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
