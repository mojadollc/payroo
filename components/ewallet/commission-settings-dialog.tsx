"use client"

import type React from "react"
import { useState } from "react"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateCommissionSettings } from "@/lib/firebase/services"
import type { CommissionSettings } from "@/lib/firebase/types"
import { useToast } from "@/hooks/use-toast"

interface CommissionSettingsDialogProps {
  settings: CommissionSettings
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function CommissionSettingsDialog({ settings, open, onOpenChange, onSuccess }: CommissionSettingsDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    xenditFlatFee: String(settings.xenditFlatFee ?? 10),
    adminChargeRate: String((settings.adminChargeRate ?? 0.01) * 100),
    sellerCashinRate: String((settings.sellerCashinRate ?? 0.03) * 100),
    gcashCashinRate: String((settings.gcashCashinRate * 100)),
    gcashCashoutRate: String((settings.gcashCashoutRate * 100)),
    mayaCashinRate: String((settings.mayaCashinRate * 100)),
    mayaCashoutRate: String((settings.mayaCashoutRate * 100)),
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const xenditFlatFee = parseFloat(formData.xenditFlatFee)
    const adminChargeRate = parseFloat(formData.adminChargeRate)
    const sellerCashinRate = parseFloat(formData.sellerCashinRate)
    const gcashCashin = parseFloat(formData.gcashCashinRate)
    const gcashCashout = parseFloat(formData.gcashCashoutRate)
    const mayaCashin = parseFloat(formData.mayaCashinRate)
    const mayaCashout = parseFloat(formData.mayaCashoutRate)

    if (isNaN(sellerCashinRate) || sellerCashinRate < 0 || sellerCashinRate > 30) {
      toast({ title: "Seller commission must be 0\u201330%", variant: "destructive" }); return
    }
    if ([gcashCashin, gcashCashout, mayaCashin, mayaCashout].some(r => isNaN(r) || r < 0 || r > 100)) {
      toast({ title: "Manual e-wallet rates must be 0\u2013100%", variant: "destructive" }); return
    }

    setIsSubmitting(true)
    try {
      await updateCommissionSettings(settings.id!, {
        // Preserve xendit/admin values — only store owner's own rates are editable here
        xenditFlatFee: settings.xenditFlatFee ?? 10,
        adminChargeRate: settings.adminChargeRate ?? 0.01,
        sellerCashinRate: sellerCashinRate / 100,
        gcashCashinRate: gcashCashin / 100,
        gcashCashoutRate: gcashCashout / 100,
        mayaCashinRate: mayaCashin / 100,
        mayaCashoutRate: mayaCashout / 100,
      })
      toast({ title: "Commission settings saved" })
      onSuccess()
      onOpenChange(false)
    } catch (error) {
      toast({ title: "Failed to save settings", variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Live preview
  const previewAmount = 1000
  const xenditCost = parseFloat(formData.xenditFlatFee) || 0
  const xenditVat = Math.ceil(xenditCost * 0.12 * 100) / 100
  const xenditTotal = Math.ceil(xenditCost + xenditVat)
  const adminFee = previewAmount >= 100 ? Math.ceil(previewAmount * ((parseFloat(formData.adminChargeRate) || 0) / 100)) : 0
  const sellerEarning = Math.ceil(previewAmount * ((parseFloat(formData.sellerCashinRate) || 0) / 100))
  const totalFee = xenditTotal + adminFee + sellerEarning
  const customerReceives = previewAmount - totalFee

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Commission Settings</DialogTitle>
          <DialogDescription>Configure fees for the e-wallet kiosk and manual transactions</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── Kiosk Fee Breakdown ── */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Kiosk Cash-In — Your Commission</h3>
            <p className="text-xs text-muted-foreground">
              Set your commission rate for kiosk cash-in transactions. This is deducted from the customer's inserted cash as part of the service fee.
            </p>
            <div className="grid gap-4 md:grid-cols-1 max-w-xs">
              <div className="space-y-2">
                <Label htmlFor="seller-rate">Your Commission (%) <span className="text-muted-foreground font-normal">0% · max 30%</span></Label>
                <Input
                  id="seller-rate"
                  type="number"
                  step="0.1"
                  min="0"
                  max="30"
                  value={formData.sellerCashinRate}
                  onChange={e => setFormData({ ...formData, sellerCashinRate: e.target.value })}
                  required
                />
                <p className="text-xs text-muted-foreground">% of inserted amount you earn per kiosk transaction</p>
              </div>
            </div>

            {/* Live preview */}
            <div className="rounded-lg bg-muted p-4 text-sm space-y-1">
              <p className="font-semibold mb-2">Preview — Customer inserts ₱{previewAmount.toLocaleString()}</p>
              <div className="flex justify-between text-muted-foreground">
                <span>Xendit fee + VAT (12%)</span>
                <span>-₱{xenditTotal} <span className="text-[10px]">(₱{xenditCost} + ₱{xenditVat.toFixed(2)} VAT)</span></span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Admin charge ({formData.adminChargeRate}%)</span>
                <span>-₱{adminFee}</span>
              </div>
              <div className="flex justify-between text-green-700 font-medium">
                <span>Your commission ({formData.sellerCashinRate}%)</span>
                <span>+₱{sellerEarning}</span>
              </div>
              <div className="flex justify-between font-bold border-t pt-2 mt-1">
                <span>Total deducted ("Service Fee" on kiosk)</span>
                <span className="text-orange-600">₱{totalFee}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Customer receives</span>
                <span className="text-blue-600">₱{customerReceives.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* ── Manual E-Wallet Rates ── */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Manual E-Wallet Rates (GCash / Maya)</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="gcash-cashin">GCash Cash-In (%)</Label>
                <Input id="gcash-cashin" type="number" step="0.01" min="0" max="100"
                  value={formData.gcashCashinRate}
                  onChange={e => setFormData({ ...formData, gcashCashinRate: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gcash-cashout">GCash Cash-Out (%)</Label>
                <Input id="gcash-cashout" type="number" step="0.01" min="0" max="100"
                  value={formData.gcashCashoutRate}
                  onChange={e => setFormData({ ...formData, gcashCashoutRate: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maya-cashin">Maya Cash-In (%)</Label>
                <Input id="maya-cashin" type="number" step="0.01" min="0" max="100"
                  value={formData.mayaCashinRate}
                  onChange={e => setFormData({ ...formData, mayaCashinRate: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maya-cashout">Maya Cash-Out (%)</Label>
                <Input id="maya-cashout" type="number" step="0.01" min="0" max="100"
                  value={formData.mayaCashoutRate}
                  onChange={e => setFormData({ ...formData, mayaCashoutRate: e.target.value })} required />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save Settings"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
