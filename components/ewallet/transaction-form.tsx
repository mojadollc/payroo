"use client"

import type React from "react"
import { cn } from "@/lib/utils"

import { useState } from "react"
import { ArrowDownToLine, ArrowUpFromLine, Signal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { addEWalletTransaction } from "@/lib/firebase/services"
import type { CommissionSettings } from "@/lib/firebase/types"
import { useToast } from "@/hooks/use-toast"

interface TransactionFormProps {
  commissionSettings: CommissionSettings
  onSuccess: () => void
}

export function TransactionForm({ commissionSettings, onSuccess }: TransactionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [provider, setProvider] = useState<"gcash" | "maya">("gcash")
  const [activeTab, setActiveTab] = useState("cashin")
  const { toast } = useToast()

  const generateRef = () => "MJD_000" + Math.random().toString().slice(2, 9)

  const [cashinForm, setCashinForm] = useState({
    amount: "",
    charge: "",
    customerName: "",
    customerNumber: "",
    referenceNumber: generateRef(),
  })

  const [cashoutForm, setCashoutForm] = useState({
    amount: "",
    charge: "",
    customerName: "",
    customerNumber: "",
    referenceNumber: generateRef(),
  })

  const [loadForm, setLoadForm] = useState({
    amount: "",
    charge: "",
    customerName: "",
    customerNumber: "",
    referenceNumber: generateRef(),
  })

  const getCommissionRate = (type: "cashin" | "cashout", prov: "gcash" | "maya") => {
    if (type === "cashin") {
      return prov === "gcash" ? commissionSettings.gcashCashinRate : commissionSettings.mayaCashinRate
    }
    return prov === "gcash" ? commissionSettings.gcashCashoutRate : commissionSettings.mayaCashoutRate
  }

  const getCharge = (form: { amount: string; charge: string }, type: "cashin" | "cashout" | "load") => {
    const amt = parseFloat(form.amount) || 0
    const manualCharge = parseFloat(form.charge)
    if (!isNaN(manualCharge) && form.charge.trim() !== "") return manualCharge
    if (type === "load") return 0
    return amt * getCommissionRate(type, provider)
  }

  const handleCashinSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = parseFloat(cashinForm.amount)
    if (!cashinForm.amount || isNaN(amount) || amount <= 0) {
      toast({ title: "Validation Error", description: "Please enter a valid amount", variant: "destructive" })
      return
    }
    if (!cashinForm.referenceNumber.trim()) {
      toast({ title: "Validation Error", description: "Reference number is required", variant: "destructive" })
      return
    }

    setIsSubmitting(true)
    try {
      const charge = getCharge(cashinForm, "cashin")
      const rate = charge / amount
      await addEWalletTransaction({
        type: "cashin",
        provider,
        amount,
        commissionRate: rate,
        customerName: cashinForm.customerName.trim(),
        customerNumber: cashinForm.customerNumber.trim(),
        referenceNumber: cashinForm.referenceNumber.trim(),
        status: "completed",
      })
      toast({ title: "Success", description: `Cash-in completed. Commission: ₱${charge.toFixed(2)}` })
      setCashinForm({ amount: "", charge: "", customerName: "", customerNumber: "", referenceNumber: generateRef() })
      onSuccess()
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to process transaction"
      toast({ title: "Error", description: msg.includes("Firebase") ? "Firebase not configured." : msg, variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCashoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = parseFloat(cashoutForm.amount)
    if (!cashoutForm.amount || isNaN(amount) || amount <= 0) {
      toast({ title: "Validation Error", description: "Please enter a valid amount", variant: "destructive" })
      return
    }
    if (!cashoutForm.referenceNumber.trim()) {
      toast({ title: "Validation Error", description: "Reference number is required", variant: "destructive" })
      return
    }

    setIsSubmitting(true)
    try {
      const charge = getCharge(cashoutForm, "cashout")
      const rate = charge / amount
      await addEWalletTransaction({
        type: "cashout",
        provider,
        amount,
        commissionRate: rate,
        customerName: cashoutForm.customerName.trim(),
        customerNumber: cashoutForm.customerNumber.trim(),
        referenceNumber: cashoutForm.referenceNumber.trim(),
        status: "completed",
      })
      toast({ title: "Success", description: `Cash-out completed. Commission: ₱${charge.toFixed(2)}` })
      setCashoutForm({ amount: "", charge: "", customerName: "", customerNumber: "", referenceNumber: generateRef() })
      onSuccess()
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to process transaction"
      toast({ title: "Error", description: msg.includes("Firebase") ? "Firebase not configured." : msg, variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLoadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = parseFloat(loadForm.amount)
    if (!loadForm.amount || isNaN(amount) || amount <= 0) {
      toast({ title: "Validation Error", description: "Please enter a valid amount", variant: "destructive" })
      return
    }
    if (!loadForm.referenceNumber.trim()) {
      toast({ title: "Validation Error", description: "Reference number is required", variant: "destructive" })
      return
    }

    setIsSubmitting(true)
    try {
      const charge = getCharge(loadForm, "load")
      const rate = amount > 0 ? charge / amount : 0
      await addEWalletTransaction({
        type: "load",
        provider,
        amount,
        commissionRate: rate,
        customerName: loadForm.customerName.trim(),
        customerNumber: loadForm.customerNumber.trim(),
        referenceNumber: loadForm.referenceNumber.trim(),
        status: "completed",
      })
      toast({ title: "Success", description: `Load completed. Commission: ₱${charge.toFixed(2)}` })
      setLoadForm({ amount: "", charge: "", customerName: "", customerNumber: "", referenceNumber: generateRef() })
      onSuccess()
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to process transaction"
      toast({ title: "Error", description: msg.includes("Firebase") ? "Firebase not configured." : msg, variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderChargeField = (form: { amount: string; charge: string }, type: "cashin" | "cashout" | "load", setForm: (f: any) => void) => {
    const amt = parseFloat(form.amount) || 0
    const autoCharge = amt * getCommissionRate(type, provider)
    const manualCharge = parseFloat(form.charge)
    const finalCharge = (!isNaN(manualCharge) && form.charge.trim() !== "") ? manualCharge : autoCharge

    return (
      <div className="space-y-2">
        <Label>Charge / Fee (₱) *</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={form.charge}
          onChange={(e) => setForm({ ...form, charge: e.target.value })}
          required
        />
        {form.charge.trim() !== "" && (
          <p className="text-xs text-muted-foreground">
            Your commission: <span className="font-semibold text-secondary">₱{finalCharge.toFixed(2)}</span>
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => setProvider("gcash")}
          className={cn(
            "font-semibold",
            provider === "gcash"
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-white text-blue-600 border border-blue-600 hover:bg-blue-50"
          )}
        >
          GCash
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => setProvider("maya")}
          className={cn(
            "font-semibold",
            provider === "maya"
              ? "bg-emerald-500 text-white hover:bg-emerald-600"
              : "bg-white text-emerald-500 border border-emerald-500 hover:bg-emerald-50"
          )}
        >
          Maya
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1">
          <TabsTrigger
            value="cashin"
            className={cn(
              "gap-1.5 text-xs sm:text-sm font-semibold transition-all",
              activeTab === "cashin"
                ? "bg-green-500 text-white shadow-md data-[state=active]:bg-green-500 data-[state=active]:text-white"
                : "hover:bg-green-50 hover:text-green-600"
            )}
          >
            <ArrowDownToLine className="h-3.5 w-3.5" />
            Cash-In
          </TabsTrigger>
          <TabsTrigger
            value="cashout"
            className={cn(
              "gap-1.5 text-xs sm:text-sm font-semibold transition-all",
              activeTab === "cashout"
                ? "bg-orange-500 text-white shadow-md data-[state=active]:bg-orange-500 data-[state=active]:text-white"
                : "hover:bg-orange-50 hover:text-orange-600"
            )}
          >
            <ArrowUpFromLine className="h-3.5 w-3.5" />
            Cash-Out
          </TabsTrigger>
          <TabsTrigger
            value="load"
            className={cn(
              "gap-1.5 text-xs sm:text-sm font-semibold transition-all",
              activeTab === "load"
                ? "bg-purple-500 text-white shadow-md data-[state=active]:bg-purple-500 data-[state=active]:text-white"
                : "hover:bg-purple-50 hover:text-purple-600"
            )}
          >
            <Signal className="h-3.5 w-3.5" />
            Load
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cashin">
          <form onSubmit={handleCashinSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cashin-amount">Amount *</Label>
              <Input
                id="cashin-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={cashinForm.amount}
                onChange={(e) => setCashinForm({ ...cashinForm, amount: e.target.value })}
                required
              />
            </div>

            {renderChargeField(cashinForm, "cashin", setCashinForm)}

            <div className="space-y-2">
              <Label htmlFor="cashin-customer">Customer Name</Label>
              <Input
                id="cashin-customer"
                placeholder="Juan Dela Cruz"
                value={cashinForm.customerName}
                onChange={(e) => setCashinForm({ ...cashinForm, customerName: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cashin-number">Customer Number</Label>
              <Input
                id="cashin-number"
                placeholder="09XX XXX XXXX"
                value={cashinForm.customerNumber}
                onChange={(e) => setCashinForm({ ...cashinForm, customerNumber: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cashin-ref">Reference Number *</Label>
              <Input
                id="cashin-ref"
                placeholder="XXXXXXXXXX"
                value={cashinForm.referenceNumber}
                onChange={(e) => setCashinForm({ ...cashinForm, referenceNumber: e.target.value })}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Processing..." : "Complete Cash-In"}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="cashout">
          <form onSubmit={handleCashoutSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cashout-amount">Amount *</Label>
              <Input
                id="cashout-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={cashoutForm.amount}
                onChange={(e) => setCashoutForm({ ...cashoutForm, amount: e.target.value })}
                required
              />
            </div>

            {renderChargeField(cashoutForm, "cashout", setCashoutForm)}

            <div className="space-y-2">
              <Label htmlFor="cashout-customer">Customer Name</Label>
              <Input
                id="cashout-customer"
                placeholder="Juan Dela Cruz"
                value={cashoutForm.customerName}
                onChange={(e) => setCashoutForm({ ...cashoutForm, customerName: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cashout-number">Customer Number</Label>
              <Input
                id="cashout-number"
                placeholder="09XX XXX XXXX"
                value={cashoutForm.customerNumber}
                onChange={(e) => setCashoutForm({ ...cashoutForm, customerNumber: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cashout-ref">Reference Number *</Label>
              <Input
                id="cashout-ref"
                placeholder="XXXXXXXXXX"
                value={cashoutForm.referenceNumber}
                onChange={(e) => setCashoutForm({ ...cashoutForm, referenceNumber: e.target.value })}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Processing..." : "Complete Cash-Out"}
            </Button>
          </form>
        </TabsContent>
        <TabsContent value="load">
          <form onSubmit={handleLoadSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="load-amount">Amount *</Label>
              <Input
                id="load-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={loadForm.amount}
                onChange={(e) => setLoadForm({ ...loadForm, amount: e.target.value })}
                required
              />
            </div>

            {renderChargeField(loadForm, "load", setLoadForm)}

            <div className="space-y-2">
              <Label htmlFor="load-customer">Customer Name</Label>
              <Input
                id="load-customer"
                placeholder="Juan Dela Cruz"
                value={loadForm.customerName}
                onChange={(e) => setLoadForm({ ...loadForm, customerName: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="load-number">Customer Number</Label>
              <Input
                id="load-number"
                placeholder="09XX XXX XXXX"
                value={loadForm.customerNumber}
                onChange={(e) => setLoadForm({ ...loadForm, customerNumber: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="load-ref">Reference Number *</Label>
              <Input
                id="load-ref"
                placeholder="XXXXXXXXXX"
                value={loadForm.referenceNumber}
                onChange={(e) => setLoadForm({ ...loadForm, referenceNumber: e.target.value })}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Processing..." : "Complete Load"}
            </Button>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  )
}
