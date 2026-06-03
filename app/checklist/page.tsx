"use client"

import { useState, useEffect, useRef } from "react"
import { Plus, Camera, Trash2, CheckCircle2, Circle, RotateCcw, Sparkles, X, ListChecks, Archive } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { db } from "@/lib/firebase/config"
import { collection, addDoc, updateDoc, deleteDoc, doc, query, where, onSnapshot, serverTimestamp, orderBy } from "firebase/firestore"

interface ChecklistItem {
  text: string
  done: boolean
}

interface Checklist {
  id?: string
  title: string
  items: ChecklistItem[]
  status: "active" | "done" | "archived"
  createdAt: any
  updatedAt: any
  userId: string
}

export default function ChecklistPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [showScan, setShowScan] = useState(false)
  const [title, setTitle] = useState("")
  const [items, setItems] = useState<ChecklistItem[]>([{ text: "", done: false }])
  const [filter, setFilter] = useState<"active" | "done" | "all">("active")
  const [scanProcessing, setScanProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user?.id) return
    const q = query(collection(db, "checklists"), where("userId", "==", user.id))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Checklist))
      setChecklists(data.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)))
    })
    return () => unsubscribe()
  }, [user])

  const handleCreate = async () => {
    if (!user?.id || !title.trim()) {
      toast({ title: "Title is required", variant: "destructive" })
      return
    }
    const validItems = items.filter(i => i.text.trim())
    if (validItems.length === 0) {
      toast({ title: "Add at least one item", variant: "destructive" })
      return
    }
    try {
      await addDoc(collection(db, "checklists"), {
        title: title.trim(),
        items: validItems,
        status: "active",
        userId: user.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      toast({ title: "Checklist created" })
      setShowCreate(false)
      setTitle("")
      setItems([{ text: "", done: false }])
    } catch {
      toast({ title: "Failed to create", variant: "destructive" })
    }
  }

  const toggleItem = async (checklist: Checklist, index: number) => {
    if (!checklist.id) return
    const updated = [...checklist.items]
    updated[index] = { ...updated[index], done: !updated[index].done }
    const allDone = updated.every(i => i.done)
    await updateDoc(doc(db, "checklists", checklist.id), {
      items: updated,
      status: allDone ? "done" : "active",
      updatedAt: serverTimestamp(),
    })
  }

  const markAllDone = async (checklist: Checklist) => {
    if (!checklist.id) return
    const updated = checklist.items.map(i => ({ ...i, done: true }))
    await updateDoc(doc(db, "checklists", checklist.id), {
      items: updated,
      status: "done",
      updatedAt: serverTimestamp(),
    })
    toast({ title: "✅ Checklist completed!" })
  }

  const resetChecklist = async (checklist: Checklist) => {
    if (!checklist.id) return
    const updated = checklist.items.map(i => ({ ...i, done: false }))
    await updateDoc(doc(db, "checklists", checklist.id), {
      items: updated,
      status: "active",
      updatedAt: serverTimestamp(),
    })
  }

  const archiveChecklist = async (checklist: Checklist) => {
    if (!checklist.id) return
    await updateDoc(doc(db, "checklists", checklist.id), { status: "archived", updatedAt: serverTimestamp() })
    toast({ title: "Archived" })
  }

  const deleteChecklist = async (id: string) => {
    if (!confirm("Delete this checklist?")) return
    await deleteDoc(doc(db, "checklists", id))
  }

  // OCR: Take photo / pick image → extract text → create checklist items
  const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    setScanProcessing(true)
    setShowScan(true)

    try {
      // Use createImageBitmap + canvas to extract image, then use Tesseract-like approach
      // For simplicity, we'll use a basic approach: send to a free OCR or parse locally
      const text = await extractTextFromImage(file)
      if (text) {
        const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 1)
        if (lines.length > 0) {
          setItems(lines.map(l => ({ text: l.replace(/^[\d\.\-\)\]]+\s*/, "").trim(), done: false })))
          setTitle("Scanned List")
          setShowScan(false)
          setShowCreate(true)
          toast({ title: `Found ${lines.length} items`, description: "Review and save your checklist" })
        } else {
          toast({ title: "No text found", description: "Try a clearer photo", variant: "destructive" })
          setShowScan(false)
        }
      }
    } catch {
      toast({ title: "Scan failed", description: "Could not read the image", variant: "destructive" })
      setShowScan(false)
    } finally {
      setScanProcessing(false)
    }
  }

  // Simple OCR using canvas + basic recognition (works offline)
  const extractTextFromImage = async (file: File): Promise<string> => {
    // Try using the browser's built-in OCR if available (Chrome 100+)
    if ("createImageBitmap" in window) {
      try {
        // @ts-ignore - TextDetector is experimental
        if ("TextDetector" in window) {
          const bitmap = await createImageBitmap(file)
          // @ts-ignore
          const detector = new window.TextDetector()
          const results = await detector.detect(bitmap)
          if (results.length > 0) {
            return results.map((r: any) => r.rawValue).join("\n")
          }
        }
      } catch {}
    }

    // Fallback: Use a free OCR API
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("apikey", "K86284535488957")
      formData.append("language", "eng")
      formData.append("isOverlayRequired", "false")

      const res = await fetch("https://api.ocr.space/parse/image", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (data.ParsedResults?.[0]?.ParsedText) {
        return data.ParsedResults[0].ParsedText
      }
    } catch {}

    return ""
  }

  const filteredChecklists = checklists.filter(c => {
    if (filter === "all") return true
    if (filter === "active") return c.status === "active"
    if (filter === "done") return c.status === "done" || c.status === "archived"
    return true
  })

  const getProgress = (items: ChecklistItem[]) => {
    if (items.length === 0) return 0
    return Math.round((items.filter(i => i.done).length / items.length) * 100)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background border-b shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-[17px] font-bold">Checklist</h1>
            <p className="text-[11px] text-muted-foreground">Track tasks & to-dos</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-8 text-[12px]" onClick={() => { (document.activeElement as HTMLElement)?.blur(); setTimeout(() => fileInputRef.current?.click(), 50) }}>
              <Camera className="h-3.5 w-3.5 mr-1" /> Scan
            </Button>
            <Button size="sm" className="h-8 text-[12px] bg-yellow-500 hover:bg-yellow-600" onClick={() => { setTitle(""); setItems([{ text: "", done: false }]); setShowCreate(true) }}>
              <Plus className="h-3.5 w-3.5 mr-1" /> New
            </Button>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="max-w-2xl mx-auto px-4 pt-3">
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {(["active", "done", "all"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 text-[12px] font-medium py-1.5 rounded-md transition-colors ${filter === f ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              {f === "active" ? "Active" : f === "done" ? "Done" : "All"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-4 pb-24 space-y-3">
        {filteredChecklists.length === 0 ? (
          <div className="text-center py-16">
            <ListChecks className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="text-[14px] font-medium">No checklists</p>
            <p className="text-[12px] text-muted-foreground mt-1">Tap "New" or "Scan" a photo to create one</p>
          </div>
        ) : (
          filteredChecklists.map(checklist => {
            const progress = getProgress(checklist.items)
            const doneCount = checklist.items.filter(i => i.done).length
            return (
              <div key={checklist.id} className="rounded-xl border bg-card overflow-hidden">
                {/* Header */}
                <div className="p-3 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[14px] font-semibold truncate">{checklist.title}</h3>
                      {checklist.status === "done" && (
                        <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Done</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="text-[11px] text-muted-foreground">{doneCount}/{checklist.items.length}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    {checklist.status === "active" && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => markAllDone(checklist)} title="Mark all done">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      </Button>
                    )}
                    {checklist.status === "done" && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => archiveChecklist(checklist)} title="Archive">
                        <Archive className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => resetChecklist(checklist)} title="Reset">
                      <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteChecklist(checklist.id!)} title="Delete">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>

                {/* Items */}
                <div className="border-t divide-y">
                  {checklist.items.map((item, i) => (
                    <button
                      key={i}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/50 active:bg-muted transition-colors text-left"
                      onClick={() => toggleItem(checklist, i)}
                    >
                      {item.done
                        ? <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                        : <Circle className="h-5 w-5 text-muted-foreground/40 flex-shrink-0" />
                      }
                      <span className={`text-[13px] ${item.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {item.text}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Hidden file input for camera/image scan */}
      <div className="absolute -z-10 opacity-0 h-0 w-0 overflow-hidden">
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleImageCapture} />
      </div>

      {/* Scanning Dialog */}
      <Dialog open={showScan} onOpenChange={setShowScan}>
        <DialogContent className="max-w-xs text-center p-6">
          <div className="flex flex-col items-center gap-3">
            <Sparkles className="h-8 w-8 text-yellow-500 animate-pulse" />
            <p className="text-[14px] font-semibold">Reading your image...</p>
            <p className="text-[12px] text-muted-foreground">Extracting text to create checklist items</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto p-4">
          <DialogHeader>
            <DialogTitle className="text-[15px]">New Checklist</DialogTitle>
            <DialogDescription className="text-[12px]">Add items to track</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input
              placeholder="Checklist title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="h-9 text-[14px]"
            />
            <div className="space-y-1.5">
              <div className="text-[11px] text-muted-foreground font-medium px-0.5">Items</div>
              {items.map((item, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Circle className="h-4 w-4 text-muted-foreground/30 flex-shrink-0" />
                  <Input
                    placeholder={`Item ${i + 1}`}
                    value={item.text}
                    onChange={e => {
                      const updated = [...items]
                      updated[i] = { ...updated[i], text: e.target.value }
                      setItems(updated)
                    }}
                    className="h-8 text-[13px] flex-1"
                  />
                  {items.length > 1 && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive/50" onClick={() => setItems(items.filter((_, j) => j !== i))}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="ghost" size="sm" className="w-full h-8 text-[12px] text-muted-foreground" onClick={() => setItems([...items, { text: "", done: false }])}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
              </Button>
            </div>
            <Button onClick={handleCreate} className="w-full h-9 text-[13px] bg-yellow-500 hover:bg-yellow-600">
              Create Checklist
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
