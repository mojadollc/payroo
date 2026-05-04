"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, GripVertical, ImageIcon } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { getAllDeliveryBanners, addDeliveryBanner, updateDeliveryBanner, deleteDeliveryBanner, uploadDeliveryImage } from "@/lib/firebase/services"
import type { DeliveryBanner } from "@/lib/firebase/types"

export function DeliveryBannerManager() {
  const { toast } = useToast()
  const [banners, setBanners] = useState<DeliveryBanner[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  const load = () => {
    getAllDeliveryBanners().then(b => { setBanners(b); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  const handleAdd = async (file: File) => {
    setUploading(true)
    try {
      const url = await uploadDeliveryImage(file, "banners")
      await addDeliveryBanner({ imageUrl: url, title: "", link: "", order: banners.length, active: true })
      toast({ title: "Banner added" })
      load()
    } catch { toast({ title: "Failed to add banner", variant: "destructive" }) }
    finally { setUploading(false) }
  }

  const handleDelete = async (id: string) => {
    await deleteDeliveryBanner(id)
    toast({ title: "Banner removed" })
    load()
  }

  const handleToggle = async (id: string, active: boolean) => {
    await updateDeliveryBanner(id, { active })
    load()
  }

  const handleUpdate = async (id: string, field: "title" | "link", value: string) => {
    await updateDeliveryBanner(id, { [field]: value })
  }

  if (loading) return <div className="text-center py-8 text-muted-foreground">Loading banners...</div>

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ImageIcon className="h-4 w-4 text-primary" /> Homepage Banners
        </CardTitle>
        <CardDescription>Manage slide banners shown on the delivery homepage.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          {banners.map(b => (
            <div key={b.id} className="flex items-center gap-2 border rounded-lg p-2">
              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
              <img src={b.imageUrl} alt="" className="h-12 w-20 rounded object-cover shrink-0" />
              <div className="flex-1 min-w-0 space-y-1">
                <Input placeholder="Title (optional)" defaultValue={b.title ?? ""} onBlur={e => handleUpdate(b.id!, "title", e.target.value)} className="h-7 text-xs" />
                <Input placeholder="Link (optional, e.g. ?store=xxx)" defaultValue={b.link ?? ""} onBlur={e => handleUpdate(b.id!, "link", e.target.value)} className="h-7 text-xs" />
              </div>
              <Switch checked={b.active} onCheckedChange={v => handleToggle(b.id!, v)} />
              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDelete(b.id!)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
        <label className="cursor-pointer">
          <Button variant="outline" className="w-full gap-2" disabled={uploading} asChild>
            <span><Plus className="h-4 w-4" /> {uploading ? "Uploading..." : "Add Banner"}</span>
          </Button>
          <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleAdd(e.target.files[0]) }} />
        </label>
      </CardContent>
    </Card>
  )
}
