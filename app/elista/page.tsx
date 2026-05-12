"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, Edit2, Save, FileText } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { MobileAppShell, MobileCard, MobileSectionHeader } from "@/components/mobile-app-shell"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { FloatingActionButton } from "@/components/ui/floating-action-button"
import { db } from "@/lib/firebase/config"
import { collection, addDoc, updateDoc, deleteDoc, doc, query, where, onSnapshot, serverTimestamp } from "firebase/firestore"

interface ListaItem {
  id?: string
  name: string
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
  
  // Form state
  const [title, setTitle] = useState("")
  const [items, setItems] = useState<ListaItem[]>([{ name: "", amount: undefined, notes: "" }])

  useEffect(() => {
    if (!user?.id) return
    const q = query(collection(db, "elistas"), where("userId", "==", user.id))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lista))
      setListas(data.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()))
    })
    return () => unsubscribe()
  }, [user])

  const resetForm = () => {
    setTitle("")
    setItems([{ name: "", amount: undefined, notes: "" }])
  }

  const handleAddItem = () => {
    setItems([...items, { name: "", amount: undefined, notes: "" }])
  }

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleItemChange = (index: number, field: keyof ListaItem, value: any) => {
    const updated = [...items]
    updated[index] = { ...updated[index], [field]: value }
    setItems(updated)
  }

  const handleCreate = async () => {
    if (!user?.id || !title.trim()) {
      toast({ title: "Error", description: !user?.id ? "Please sign in" : "Title is required", variant: "destructive" })
      return
    }

    const validItems = items.filter(item => item.name.trim()).map(item => ({
      name: item.name,
      amount: item.amount || null,
      notes: item.notes || null,
    }))
    
    if (validItems.length === 0) {
      toast({ title: "Error", description: "Add at least one item", variant: "destructive" })
      return
    }

    try {
      await addDoc(collection(db, "elistas"), {
        title: title.trim(),
        items: validItems,
        userId: user.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      toast({ title: "Success", description: "e-Lista created" })
      setIsCreateOpen(false)
      resetForm()
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "Failed to create e-Lista", variant: "destructive" })
    }
  }

  const handleUpdate = async () => {
    if (!editingLista?.id || !title.trim()) return

    const validItems = items.filter(item => item.name.trim()).map(item => ({
      name: item.name,
      amount: item.amount || null,
      notes: item.notes || null,
    }))
    
    if (validItems.length === 0) {
      toast({ title: "Error", description: "Add at least one item", variant: "destructive" })
      return
    }

    try {
      await updateDoc(doc(db, "elistas", editingLista.id), {
        title: title.trim(),
        items: validItems,
        updatedAt: serverTimestamp(),
      })
      toast({ title: "Success", description: "e-Lista updated" })
      setEditingLista(null)
      resetForm()
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "Failed to update e-Lista", variant: "destructive" })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this e-Lista?")) return
    try {
      await deleteDoc(doc(db, "elistas", id))
      toast({ title: "Success", description: "e-Lista deleted" })
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "Failed to delete e-Lista", variant: "destructive" })
    }
  }

  const openEdit = (lista: Lista) => {
    setEditingLista(lista)
    setTitle(lista.title)
    setItems(lista.items.length > 0 ? lista.items : [{ name: "", amount: undefined, notes: "" }])
  }

  const calculateTotal = (items: ListaItem[]) => {
    return items.reduce((sum, item) => sum + (item.amount || 0), 0)
  }

  const downloadLista = (lista: Lista) => {
    const total = calculateTotal(lista.items)
    let text = `${lista.title}\n${"=".repeat(50)}\n\n`
    
    lista.items.forEach((item, i) => {
      text += `${i + 1}. ${item.name}`
      if (item.amount) text += ` - ₱${item.amount.toFixed(2)}`
      if (item.notes) text += `\n   Notes: ${item.notes}`
      text += "\n"
    })
    
    if (total > 0) {
      text += `\n${"=".repeat(50)}\nTOTAL: ₱${total.toFixed(2)}\n`
    }

    const blob = new Blob([text], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${lista.title.replace(/[^a-z0-9]/gi, "_")}.txt`
    a.click()
  }

  const printLista = (lista: Lista) => {
    const total = calculateTotal(lista.items)
    const win = window.open("", "_blank")
    if (!win) return

    let html = `
      <html>
        <head>
          <title>${lista.title}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
            h1 { border-bottom: 3px solid #EFBF04; padding-bottom: 10px; }
            .item { padding: 10px 0; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; }
            .item-name { flex: 1; }
            .item-amount { font-weight: bold; color: #059669; }
            .notes { font-size: 12px; color: #666; margin-top: 4px; }
            .total { margin-top: 20px; padding-top: 10px; border-top: 2px solid #333; font-size: 18px; font-weight: bold; text-align: right; }
          </style>
        </head>
        <body>
          <h1>${lista.title}</h1>
    `

    lista.items.forEach((item, i) => {
      html += `<div class="item">`
      html += `<div class="item-name">${i + 1}. ${item.name}`
      if (item.notes) html += `<div class="notes">${item.notes}</div>`
      html += `</div>`
      if (item.amount) html += `<div class="item-amount">₱${item.amount.toFixed(2)}</div>`
      html += `</div>`
    })

    if (total > 0) {
      html += `<div class="total">TOTAL: ₱${total.toFixed(2)}</div>`
    }

    html += `
          <script>window.onload = () => { window.print(); window.close(); }</script>
        </body>
      </html>
    `

    win.document.write(html)
    win.document.close()
  }

  return (
    <MobileAppShell
      title="e-Lista"
      subtitle="Create and manage lists"
    >
      {/* Mobile View */}
      <div className="md:hidden space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <MobileCard className="p-4 bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-yellow-500 rounded-lg">
                <FileText className="h-4 w-4 text-white" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Total Listas</span>
            </div>
            <div className="text-2xl font-bold text-yellow-600">{listas.length}</div>
          </MobileCard>

          <MobileCard className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-green-500 rounded-lg">
                <Plus className="h-4 w-4 text-white" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Total Items</span>
            </div>
            <div className="text-2xl font-bold text-green-600">
              {listas.reduce((sum, l) => sum + l.items.length, 0)}
            </div>
          </MobileCard>
        </div>

        {/* Listas Grid */}
        {listas.length === 0 ? (
          <MobileCard className="p-8 text-center">
            <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-40" />
            <p className="text-lg font-semibold mb-2">No e-Listas yet</p>
            <p className="text-sm text-muted-foreground mb-4">Create your first list to get started</p>
            <Button onClick={() => { resetForm(); setIsCreateOpen(true) }} className="bg-yellow-500 hover:bg-yellow-600">
              <Plus className="h-4 w-4 mr-2" /> Create e-Lista
            </Button>
          </MobileCard>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {listas.map((lista) => {
              const total = calculateTotal(lista.items)
              return (
                <MobileCard 
                  key={lista.id} 
                  onClick={() => setViewingLista(lista)}
                  className="p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <FileText className="h-4 w-4 text-yellow-600" />
                    </div>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-destructive hover:bg-red-50"
                      onClick={(e) => { e.stopPropagation(); handleDelete(lista.id!) }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <h3 className="font-semibold text-sm truncate mb-1">{lista.title}</h3>
                  <p className="text-xs text-muted-foreground mb-2">
                    {lista.items.length} item{lista.items.length !== 1 ? "s" : ""}
                  </p>
                  {total > 0 && (
                    <div className="text-lg font-bold text-green-600">₱{total.toFixed(2)}</div>
                  )}
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="w-full mt-3 h-9"
                    onClick={(e) => { e.stopPropagation(); openEdit(lista) }}
                  >
                    <Edit2 className="h-3 w-3 mr-1" /> Edit
                  </Button>
                </MobileCard>
              )
            })}
          </div>
        )}
      </div>

      {/* Desktop View */}
      <div className="hidden md:block">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">e-Lista</h1>
            <p className="text-sm text-muted-foreground">Create and manage your lists</p>
          </div>
          <Button onClick={() => { resetForm(); setIsCreateOpen(true) }}>
            <Plus className="h-4 w-4 mr-2" /> New Lista
          </Button>
        </div>

        {listas.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-semibold mb-2">No e-Listas yet</p>
              <p className="text-sm text-muted-foreground mb-4">Create your first list to get started</p>
              <Button onClick={() => { resetForm(); setIsCreateOpen(true) }}>
                <Plus className="h-4 w-4 mr-2" /> Create e-Lista
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {listas.map((lista) => {
              const total = calculateTotal(lista.items)
              return (
                <Card key={lista.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setViewingLista(lista)}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span className="truncate">{lista.title}</span>
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">Items: </span>
                        {lista.items.slice(0, 3).map((item, idx) => (
                          <span key={idx}>
                            {item.name}
                            {idx < Math.min(2, lista.items.length - 1) ? ", " : ""}
                          </span>
                        ))}
                        {lista.items.length > 3 && (
                          <span className="text-primary font-medium"> +{lista.items.length - 3} more...</span>
                        )}
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Items:</span>
                        <span className="font-semibold">{lista.items.length}</span>
                      </div>
                      {total > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Total:</span>
                          <span className="font-bold text-green-600">₱{total.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex gap-2 mt-4">
                        <Button size="sm" variant="outline" className="flex-1" onClick={(e) => { e.stopPropagation(); openEdit(lista) }}>
                          <Edit2 className="h-3 w-3 mr-1" /> Edit
                        </Button>
                        <Button size="sm" variant="outline" className="text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(lista.id!) }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Floating Add Button (Mobile) */}
      <FloatingActionButton
        icon={<Plus className="h-7 w-7" />}
        label="New Lista"
        onClick={() => { resetForm(); setIsCreateOpen(true) }}
      />

      {/* Create/Edit Bottom Sheet (Mobile) / Dialog (Desktop) */}
      <>
        {/* Desktop Dialog */}
        <div className="hidden md:block">
          <Dialog open={isCreateOpen || !!editingLista} onOpenChange={(open) => { if (!open) { setIsCreateOpen(false); setEditingLista(null); resetForm() } }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingLista ? "Edit e-Lista" : "Create e-Lista"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" placeholder="e.g., Shopping List, Restock Items" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="space-y-3">
                  <Label>Items</Label>
                  {items.map((item, index) => (
                    <Card key={index} className="p-3">
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <Input placeholder="Item name" value={item.name} onChange={(e) => handleItemChange(index, "name", e.target.value)} />
                          </div>
                          <div className="w-32">
                            <Input type="number" placeholder="Amount" value={item.amount || ""} onChange={(e) => handleItemChange(index, "amount", e.target.value ? parseFloat(e.target.value) : undefined)} />
                          </div>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleRemoveItem(index)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <Input placeholder="Notes (optional)" value={item.notes || ""} onChange={(e) => handleItemChange(index, "notes", e.target.value)} className="text-sm" />
                      </div>
                    </Card>
                  ))}
                  <Button type="button" variant="outline" className="w-full bg-yellow-400 hover:bg-yellow-500 text-black border-yellow-500" onClick={handleAddItem}>
                    <Plus className="h-4 w-4 mr-2" /> Add Item
                  </Button>
                </div>
                {calculateTotal(items) > 0 && (
                  <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <span className="font-semibold">Total:</span>
                    <span className="text-xl font-bold text-green-600">₱{calculateTotal(items).toFixed(2)}</span>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setIsCreateOpen(false); setEditingLista(null); resetForm() }}>Cancel</Button>
                <Button onClick={editingLista ? handleUpdate : handleCreate}>
                  <Save className="h-4 w-4 mr-2" /> {editingLista ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Mobile Bottom Sheet */}
        <div className="md:hidden">
          <BottomSheet
            open={isCreateOpen || !!editingLista}
            onClose={() => { setIsCreateOpen(false); setEditingLista(null); resetForm() }}
            title={editingLista ? "Edit e-Lista" : "Create e-Lista"}
            description={editingLista ? "Update your list" : "Create a new list"}
          >
            <div className="pb-20 space-y-4">
              <div>
                <Label htmlFor="title-mobile">Title</Label>
                <Input id="title-mobile" placeholder="e.g., Shopping List" value={title} onChange={(e) => setTitle(e.target.value)} className="h-12" />
              </div>
              <div className="space-y-3">
                <Label>Items</Label>
                {items.map((item, index) => (
                  <MobileCard key={index} className="p-3">
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Input placeholder="Item name" value={item.name} onChange={(e) => handleItemChange(index, "name", e.target.value)} />
                        </div>
                        <div className="w-28">
                          <Input type="number" placeholder="₱" value={item.amount || ""} onChange={(e) => handleItemChange(index, "amount", e.target.value ? parseFloat(e.target.value) : undefined)} />
                        </div>
                        <Button size="icon" variant="ghost" className="text-destructive shrink-0" onClick={() => handleRemoveItem(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Input placeholder="Notes (optional)" value={item.notes || ""} onChange={(e) => handleItemChange(index, "notes", e.target.value)} className="text-sm" />
                    </div>
                  </MobileCard>
                ))}
                <Button type="button" variant="outline" className="w-full bg-yellow-400 hover:bg-yellow-500 text-black border-yellow-500" onClick={handleAddItem}>
                  <Plus className="h-4 w-4 mr-2" /> Add Item
                </Button>
              </div>
              {calculateTotal(items) > 0 && (
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg border border-green-200">
                  <span className="font-semibold">Total:</span>
                  <span className="text-xl font-bold text-green-600">₱{calculateTotal(items).toFixed(2)}</span>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => { setIsCreateOpen(false); setEditingLista(null); resetForm() }} className="flex-1 h-12">
                  Cancel
                </Button>
                <Button onClick={editingLista ? handleUpdate : handleCreate} className="flex-1 h-12 bg-yellow-500 hover:bg-yellow-600">
                  <Save className="h-4 w-4 mr-2" /> {editingLista ? "Update" : "Create"}
                </Button>
              </div>
            </div>
          </BottomSheet>
        </div>
      </>

      {/* View Bottom Sheet (Mobile) / Dialog (Desktop) */}
      <BottomSheet
        open={!!viewingLista}
        onClose={() => setViewingLista(null)}
        title={viewingLista?.title || ""}
        description={viewingLista ? `${viewingLista.items.length} items` : ""}
      >
        <div className="pb-20">
          {viewingLista && (
            <div className="space-y-3">
              {viewingLista.items.map((item, index) => (
                <MobileCard key={index} className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium">{index + 1}. {item.name}</div>
                      {item.notes && <div className="text-sm text-muted-foreground mt-1">{item.notes}</div>}
                    </div>
                    {item.amount && (
                      <div className="font-bold text-green-600 ml-4">₱{item.amount.toFixed(2)}</div>
                    )}
                  </div>
                </MobileCard>
              ))}
              {calculateTotal(viewingLista.items) > 0 && (
                <MobileCard className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                  <div className="flex justify-between items-center font-bold text-lg">
                    <span>TOTAL:</span>
                    <span className="text-green-600">₱{calculateTotal(viewingLista.items).toFixed(2)}</span>
                  </div>
                </MobileCard>
              )}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setViewingLista(null)} className="flex-1 h-12">
                  Close
                </Button>
                <Button onClick={() => { if (viewingLista) { openEdit(viewingLista); setViewingLista(null) } }} className="flex-1 h-12 bg-yellow-500 hover:bg-yellow-600">
                  <Edit2 className="h-4 w-4 mr-2" /> Edit
                </Button>
              </div>
            </div>
          )}
        </div>
      </BottomSheet>
    </MobileAppShell>
  )
}
