"use client"

import { useState, useEffect } from "react"
import { Plus, Minus, Trash2, Edit2, Save, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { db } from "@/lib/firebase/config"
import { collection, addDoc, updateDoc, deleteDoc, doc, query, where, onSnapshot, serverTimestamp } from "firebase/firestore"
import { offlineGetElistas, offlineAddElista, offlineUpdateElista, offlineDeleteElista } from "@/lib/offline/services"
import { isOnline } from "@/lib/offline/sync-engine"

interface ListaItem {
  id?: string
  name: string
  qty?: number
  price?: number
  amount?: number
  notes?: string
}

interface Lista {
  id?: string
  title: string
  items: ListaItem[]
  createdAt: any
  updatedAt: any
  userId: string
}

export default function EListaPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [listas, setListas] = useState<Lista[]>([])
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingLista, setEditingLista] = useState<Lista | null>(null)
  const [viewingLista, setViewingLista] = useState<Lista | null>(null)

  const [title, setTitle] = useState("")
  const [items, setItems] = useState<ListaItem[]>([{ name: "", qty: 1, price: undefined, notes: "" }])
  const [submitting, setSubmitting] = useState(false)
  const deletedIds = useState<Set<string>>(() => new Set())[0]

  useEffect(() => {
    if (!user?.id) return

    // Load from IndexedDB first (works offline)
    offlineGetElistas(user.id).then(data => {
      if (data.length > 0) setListas(data as Lista[])
    })

    // If online, also subscribe to real-time updates
    if (!db || !isOnline()) return
    const q = query(collection(db, "elistas"), where("userId", "==", user.id))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs
        .filter(d => !deletedIds.has(d.id))
        .map(d => ({ id: d.id, ...d.data() } as Lista))
      setListas(data.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()))
      // Keep IndexedDB in sync with Firestore snapshot
      snapshot.docChanges().forEach(change => {
        if (change.type === "removed") {
          offlineDeleteElista(change.doc.id).catch(() => {})
        }
      })
    })
    return () => unsubscribe()
  }, [user])

  const resetForm = () => {
    setTitle("")
    setItems([{ name: "", qty: 1, price: undefined, notes: "" }])
  }

  const handleAddItem = () => {
    setItems([...items, { name: "", qty: 1, price: undefined, notes: "" }])
  }

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return
    setItems(items.filter((_, i) => i !== index))
  }

  const handleItemChange = (index: number, field: keyof ListaItem, value: any) => {
    const updated = [...items]
    updated[index] = { ...updated[index], [field]: value }
    setItems(updated)
  }

  const handleCreate = async () => {
    if (submitting) return
    if (!user?.id || !title.trim()) {
      toast({ title: "Error", description: !user?.id ? "Please sign in" : "Title is required", variant: "destructive" })
      return
    }
    const validItems = items.filter(item => item.name.trim()).map(item => ({
      name: item.name,
      qty: item.qty || 1,
      price: item.price || null,
      amount: (item.qty || 1) * (item.price || 0) || null,
      notes: item.notes || null,
    }))
    if (validItems.length === 0) {
      toast({ title: "Error", description: "Add at least one item", variant: "destructive" })
      return
    }
    setSubmitting(true)
    try {
      const newLista: Lista = {
        title: title.trim(),
        items: validItems,
        userId: user.id,
        createdAt: { toMillis: () => Date.now() } as any,
        updatedAt: { toMillis: () => Date.now() } as any,
      }

      if (isOnline() && db) {
        const docRef = await addDoc(collection(db, "elistas"), {
          title: title.trim(),
          items: validItems,
          userId: user.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
        newLista.id = docRef.id
      } else {
        await offlineAddElista({ title: title.trim(), items: validItems, userId: user.id })
        const fresh = await offlineGetElistas(user.id)
        setListas(fresh as Lista[])
        toast({ title: "Success", description: "e-Lista saved offline" })
        setIsCreateOpen(false)
        resetForm()
        setSubmitting(false)
        return
      }
      // Optimistic: add to state immediately
      setListas(prev => [newLista, ...prev])
      toast({ title: "Success", description: "e-Lista created" })
      setIsCreateOpen(false)
      resetForm()
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "Failed to create e-Lista", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async () => {
    if (submitting || !editingLista?.id || !title.trim()) return
    const validItems = items.filter(item => item.name.trim()).map(item => ({
      name: item.name,
      qty: item.qty || 1,
      price: item.price || null,
      amount: (item.qty || 1) * (item.price || 0) || null,
      notes: item.notes || null,
    }))
    if (validItems.length === 0) {
      toast({ title: "Error", description: "Add at least one item", variant: "destructive" })
      return
    }
    setSubmitting(true)
    try {
      if (isOnline() && db) {
        await updateDoc(doc(db, "elistas", editingLista.id), {
          title: title.trim(),
          items: validItems,
          updatedAt: serverTimestamp(),
        })
      } else {
        await offlineUpdateElista(editingLista.id, { title: title.trim(), items: validItems })
      }
      // Optimistic: update state immediately
      setListas(prev => prev.map(l => l.id === editingLista.id ? { ...l, title: title.trim(), items: validItems, updatedAt: { toMillis: () => Date.now() } as any } : l))
      toast({ title: "Success", description: "e-Lista updated" })
      setEditingLista(null)
      resetForm()
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "Failed to update e-Lista", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this e-Lista?")) return
    // Track deleted ID so snapshot never re-adds it
    deletedIds.add(id)
    // Immediately remove from UI
    setListas(prev => prev.filter(l => l.id !== id))
    try {
      // Always delete from IndexedDB first so cache never restores it
      await offlineDeleteElista(id)
      if (isOnline() && db) {
        await deleteDoc(doc(db, "elistas", id))
      }
      toast({ title: "Deleted", description: "e-Lista removed" })
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" })
    }
  }

  const openEdit = (lista: Lista) => {
    setEditingLista(lista)
    setTitle(lista.title)
    setItems(lista.items.length > 0 ? lista.items.map(i => ({ ...i, qty: i.qty || 1 })) : [{ name: "", qty: 1, price: undefined, notes: "" }])
  }

  const calculateTotal = (listItems: ListaItem[]) => {
    return listItems.reduce((sum, item) => sum + ((item.qty || 1) * (item.price || 0)), 0)
  }

  const isFormOpen = isCreateOpen || !!editingLista

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background border-b shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-[17px] font-bold">e-Lista</h1>
            <p className="text-[12px] text-muted-foreground">Shopping lists</p>
          </div>
          <Button size="sm" onClick={() => { resetForm(); setIsCreateOpen(true) }} className="h-9 bg-yellow-500 hover:bg-yellow-600 text-[13px]">
            <Plus className="h-4 w-4 mr-1" /> New
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-4 pb-24 space-y-3">
        {listas.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="text-[15px] font-medium mb-1">No lists yet</p>
            <p className="text-[13px] text-muted-foreground">Tap "New" to create your first e-Lista</p>
          </div>
        ) : (
          listas.map((lista) => {
            const total = calculateTotal(lista.items)
            return (
              <div
                key={lista.id}
                className="bg-card border rounded-xl p-3 active:scale-[0.99] transition-transform cursor-pointer"
                onClick={() => setViewingLista(lista)}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[15px] font-semibold truncate flex-1">{lista.title}</h3>
                  <div className="flex items-center gap-1 ml-2">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openEdit(lista) }}>
                      <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleDelete(lista.id!) }}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
                {/* Items preview */}
                <div className="space-y-0.5">
                  {lista.items.slice(0, 4).map((item, i) => (
                    <div key={i} className="flex items-center text-[13px]">
                      <span className="text-muted-foreground truncate flex-1">{item.name}</span>
                      <span className="text-muted-foreground mx-2">{item.qty || 1}pc{(item.qty || 1) > 1 ? "s" : ""}</span>
                      {item.price ? <span className="font-medium w-16 text-right">₱{((item.qty || 1) * item.price).toFixed(2)}</span> : <span className="w-16" />}
                    </div>
                  ))}
                  {lista.items.length > 4 && (
                    <p className="text-[11px] text-muted-foreground">+{lista.items.length - 4} more items</p>
                  )}
                </div>
                {total > 0 && (
                  <div className="flex justify-between items-center mt-2 pt-2 border-t text-[13px]">
                    <span className="font-medium">Total</span>
                    <span className="font-bold text-green-600">₱{total.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={(open) => { if (!open) { setIsCreateOpen(false); setEditingLista(null); resetForm() } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-[16px]">{editingLista ? "Edit Lista" : "New Lista"}</DialogTitle>
            <DialogDescription className="text-[13px]">{editingLista ? "Update items and prices" : "Add items with quantity and price"}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-[12px] text-muted-foreground">Title</Label>
              <Input placeholder="e.g., Grocery, Restock" value={title} onChange={(e) => setTitle(e.target.value)} className="h-9 text-[14px] mt-1" />
            </div>

            {/* Items table */}
            <div className="space-y-1">
              <div className="grid grid-cols-[1fr_90px_70px_28px] gap-1.5 text-[11px] text-muted-foreground font-medium px-0.5">
                <span>Item</span>
                <span className="text-center">Qty</span>
                <span className="text-right">Price</span>
                <span></span>
              </div>
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-[1fr_90px_70px_28px] gap-1.5 items-center">
                  <Input
                    placeholder="Item name"
                    value={item.name}
                    onChange={(e) => handleItemChange(index, "name", e.target.value)}
                    className="h-9 text-[14px]"
                  />
                  <div className="flex items-center justify-center gap-0.5">
                    <Button type="button" size="icon" variant="outline" className="h-7 w-7 shrink-0" onClick={() => handleItemChange(index, "qty", Math.max(1, (item.qty || 1) - 1))}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-7 text-center text-[14px] font-medium">{item.qty || 1}</span>
                    <Button type="button" size="icon" variant="outline" className="h-7 w-7 shrink-0" onClick={() => handleItemChange(index, "qty", (item.qty || 1) + 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="₱0"
                    value={item.price || ""}
                    onChange={(e) => handleItemChange(index, "price", e.target.value ? parseFloat(e.target.value) : undefined)}
                    className="h-9 text-[14px] text-right pr-1.5"
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive/50" onClick={() => handleRemoveItem(index)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="ghost" size="sm" className="w-full h-8 text-[12px] text-yellow-700" onClick={handleAddItem}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
              </Button>
            </div>

            {calculateTotal(items) > 0 && (
              <div className="flex justify-between items-center pt-2 border-t text-[14px]">
                <span className="font-medium">Total</span>
                <span className="font-bold text-green-600">₱{calculateTotal(items).toFixed(2)}</span>
              </div>
            )}
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" size="sm" onClick={() => { setIsCreateOpen(false); setEditingLista(null); resetForm() }} className="text-[13px]">Cancel</Button>
            <Button size="sm" onClick={editingLista ? handleUpdate : handleCreate} disabled={submitting} className="bg-yellow-500 hover:bg-yellow-600 text-[13px] disabled:opacity-60">
              <Save className="h-3.5 w-3.5 mr-1" /> {editingLista ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewingLista} onOpenChange={(open) => { if (!open) setViewingLista(null) }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-[16px]">{viewingLista?.title}</DialogTitle>
            <DialogDescription className="text-[12px]">{viewingLista?.items.length} item{(viewingLista?.items.length || 0) !== 1 ? "s" : ""}</DialogDescription>
          </DialogHeader>

          {viewingLista && (
            <div className="mt-2">
              {/* Column headers */}
              <div className="grid grid-cols-[1fr_40px_60px_70px] gap-1 text-[11px] text-muted-foreground font-medium pb-1.5 border-b">
                <span>Item</span>
                <span className="text-center">Pcs</span>
                <span className="text-right">Price</span>
                <span className="text-right">Total</span>
              </div>

              {/* Items */}
              <div className="divide-y divide-border/40">
                {viewingLista.items.map((item, index) => {
                  const lineTotal = (item.qty || 1) * (item.price || 0)
                  return (
                    <div key={index} className="grid grid-cols-[1fr_40px_60px_70px] gap-1 items-center py-2">
                      <div className="min-w-0">
                        <span className="text-[14px] font-medium truncate block">{item.name}</span>
                        {item.notes && <span className="text-[11px] text-muted-foreground">{item.notes}</span>}
                      </div>
                      <span className="text-[13px] text-center text-muted-foreground">{item.qty || 1}</span>
                      <span className="text-[13px] text-right text-muted-foreground">{item.price ? `₱${item.price}` : "—"}</span>
                      <span className="text-[13px] text-right font-semibold text-green-600">{lineTotal > 0 ? `₱${lineTotal.toFixed(2)}` : "—"}</span>
                    </div>
                  )
                })}
              </div>

              {calculateTotal(viewingLista.items) > 0 && (
                <div className="flex justify-between items-center pt-3 mt-1 border-t-2">
                  <span className="text-[14px] font-semibold">Total</span>
                  <span className="text-[15px] font-bold text-green-600">₱{calculateTotal(viewingLista.items).toFixed(2)}</span>
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm" className="flex-1 text-[13px]" onClick={() => setViewingLista(null)}>Close</Button>
                <Button size="sm" className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-[13px]" onClick={() => { if (viewingLista) { openEdit(viewingLista); setViewingLista(null) } }}>
                  <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
