"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  ChevronLeft, ChevronRight, CheckCircle, XCircle, AlertTriangle,
  Loader2, Delete, RotateCcw,
} from "lucide-react"
import type { CommissionSettings } from "@/lib/types"
import { getStoreId } from "@/lib/store-id"

type Step = "browse" | "phone" | "confirm" | "processing" | "success" | "failed"

interface Product {
  promoId: number
  name: string
  network: string
  service: string
  category: string
  amount: number
  description: string
  validity: string
  addressType: string
  addressMin: number
  addressMax: number
}

const NETWORK_COLORS: Record<string, string> = {
  SMART: "#00B900", GLOBE: "#007DFE", TNT: "#F59E0B", DITO: "#06B6D4",
  TM: "#6366F1", GOMO: "#14B8A6", SUN: "#F97316",
  "GAME CLUB": "#8B5CF6", "RAZER GOLD": "#84CC16", CIGNAL: "#0EA5E9",
}


export default function ELoadPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("browse")
  const [products, setProducts] = useState<Product[]>([])
  const [networks, setNetworks] = useState<string[]>([])
  const [selectedNetwork, setSelectedNetwork] = useState<string>("")
  const [filter, setFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [phone, setPhone] = useState("")
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [txnId, setTxnId] = useState("")
  const [error, setError] = useState("")
  const [commSettings, setCommSettings] = useState<CommissionSettings | null>(null)
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const storeName = typeof window !== "undefined" ? localStorage.getItem("storeName") || "Payroo POS" : ""

  useEffect(() => {
    const storeId = getStoreId()

    fetch(`/api/eload?storeId=${storeId}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const ct = r.headers.get("content-type") || ""
        if (!ct.includes("application/json")) throw new Error("API not deployed yet")
        return r.json()
      })
      .then(data => {
        const prods: Product[] = data.products || []
        setProducts(prods)
        const nets = [...new Set(prods.map(p => p.network))]
        setNetworks(nets)
        if (nets.length > 0) setSelectedNetwork(nets[0])
        if (data.balance != null) setWalletBalance(data.balance)
      })
      .catch((err) => { setError(err.message || "Failed to load products") })
      .finally(() => setLoading(false))

    fetch(`/api/commission-settings?storeId=${storeId}`)
      .then(r => r.json())
      .then(({ data }) => { if (data) setCommSettings(data) })
      .catch(() => {})
  }, [])

  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current) }, [])

  const filtered = products
    .filter(p => p.network === selectedNetwork)
    .filter(p => filter === "all" || p.category === filter)
    .filter(p => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q) || String(p.amount).includes(q)
    })
  const categories = [...new Set(products.filter(p => p.network === selectedNetwork).map(p => p.category).filter(Boolean))]

  const handleBuy = (p: Product) => {
    setSelectedProduct(p)
    setPhone("")
    setSearch("")
    setStep("phone")
  }

  const handlePhoneInput = (val: string) => {
    if (val === "C") { setPhone(""); return }
    if (val === "⌫") { setPhone(n => n.slice(0, -1)); return }
    if (phone.length >= (selectedProduct?.addressMax || 11)) return
    setPhone(n => n + val)
  }

  const handleConfirm = async () => {
    if (!selectedProduct) return
    setStep("processing")
    setProcessing(true)
    try {
      const res = await fetch("/api/eload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promoId: selectedProduct.promoId, address: phone, amount: selectedProduct.amount, storeId: getStoreId() }),
      })
      const data = await res.json()

      if (data.status === "completed") {
        setTxnId(data.txnId || "")
        if (data.balance != null) setWalletBalance(data.balance)
        await recordEloadTransaction(data.txnId || "")
        setStep("success")
      } else if (data.status === "pending") {
        // Poll for status
        await pollStatus(data.txnId)
      } else {
        setError(data.error || "Transaction failed.")
        setStep("failed")
      }
    } catch {
      setError("Network error. Please try again.")
      setStep("failed")
    } finally {
      setProcessing(false)
    }
  }

  const recordEloadTransaction = async (refId: string) => {
    if (!selectedProduct) return
    try {
      const storeId = getStoreId()
      const feeType = commSettings?.eloadFeeType || "flat"
      const feeValue = commSettings?.eloadFeeValue ?? 5
      const fee = feeType === "flat" ? feeValue : selectedProduct.amount * feeValue
      const rate = feeType === "percentage" ? feeValue : (selectedProduct.amount > 0 ? feeValue / selectedProduct.amount : 0)
      await fetch("/api/ewallet-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId, type: "load", provider: "gcash",
          amount: selectedProduct.amount,
          commission: fee, commissionRate: rate, profit: fee,
          customerName: `${selectedProduct.network} · ${selectedProduct.name}`,
          customerNumber: phone, referenceNumber: refId, status: "completed",
        }),
      })
    } catch (e) {
      console.error("Failed to record e-load transaction:", e)
    }
  }

  const pollStatus = async (id: string) => {
    const start = Date.now()
    while (Date.now() - start < 60000) {
      await new Promise(r => setTimeout(r, 3000))
      try {
        const res = await fetch(`/api/eload?action=status&txnId=${id}`)
        const data = await res.json()
        if (data.status === "completed") { setTxnId(data.txnId || id); await recordEloadTransaction(data.txnId || id); setStep("success"); return }
        if (data.status === "failed") { setError(data.error || "Failed"); setStep("failed"); return }
      } catch {}
    }
    setError("Still processing. Please check back shortly.")
    setStep("failed")
  }

  const reset = () => {
    setStep("browse")
    setSelectedProduct(null)
    setPhone("")
    setTxnId("")
    setError("")
    setFilter("all")
    setSearch("")
  }

  const networkColor = selectedProduct ? (NETWORK_COLORS[selectedProduct.network] || "#6366F1") : "#6366F1"

  // ── BROWSE ──────────────────────────────────────────────────────────────────
  if (step === "browse") {
    const netColor = NETWORK_COLORS[selectedNetwork] || "#6366F1"
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="bg-white shadow-sm px-4 py-3 flex items-center justify-between sticky top-0 z-20">
          <button onClick={() => router.push("/ewallet")} className="flex items-center gap-1 text-gray-400 hover:text-gray-600 text-sm font-medium">
            <ChevronLeft className="h-5 w-5" /> Back
          </button>
          <div className="text-center">
            <p className="font-bold text-gray-800 text-lg">E-Load</p>
            <p className="text-[10px] text-gray-400">{storeName}</p>
          </div>
          <div className="text-right">
            {walletBalance != null ? (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-2.5 py-1">
                <p className="text-[9px] text-indigo-400 font-semibold uppercase tracking-wide">GBits Wallet</p>
                <p className="text-sm font-black text-indigo-700">₱{walletBalance.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            ) : <div className="w-14" />}
          </div>
        </div>

        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Network selector — horizontal scrollable chips */}
          <div className="bg-white border-b border-gray-100 px-3 py-3">
            {loading ? (
              <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                {[1,2,3,4].map(i => <div key={i} className="h-14 w-20 rounded-2xl bg-gray-100 animate-pulse shrink-0" />)}
              </div>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
                {networks.map(net => {
                  const color = NETWORK_COLORS[net] || "#6366F1"
                  const active = selectedNetwork === net
                  return (
                    <button
                      key={net}
                      onClick={() => { setSelectedNetwork(net); setFilter("all") }}
                      className={`shrink-0 flex flex-col items-center justify-center gap-1 px-4 py-2.5 rounded-2xl transition-all border-2 min-w-[72px] ${
                        active ? "border-transparent shadow-md" : "border-gray-100 bg-white"
                      }`}
                      style={active ? { backgroundColor: color } : {}}
                    >
                      <span className={`text-sm font-black tracking-tight ${active ? "text-white" : "text-gray-700"}`}>
                        {net}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Products */}
          <main className="flex-1 flex flex-col overflow-hidden">
            {/* Search bar */}
            <div className="bg-white px-3 pt-2.5 pb-1.5">
              <input
                type="text"
                placeholder={`Search ${selectedNetwork} promos...`}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full h-10 px-4 rounded-2xl bg-gray-100 text-[13px] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>

            {/* Category tabs */}
            {categories.length > 0 && (
              <div className="bg-white border-b border-gray-100 px-3 py-2 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                {["all", ...categories].map(c => (
                  <button
                    key={c}
                    onClick={() => setFilter(c)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all ${
                      filter === c ? "text-white shadow-sm" : "bg-gray-100 text-gray-500"
                    }`}
                    style={filter === c ? { backgroundColor: netColor } : {}}
                  >
                    {c === "all" ? "All" : c}
                  </button>
                ))}
              </div>
            )}

            {/* Product grid */}
            <div className="flex-1 overflow-y-auto p-3">
              {loading ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
                </div>
              ) : error && filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center px-4">
                  <AlertTriangle className="h-8 w-8 text-amber-500 mb-2" />
                  <p className="text-sm font-medium text-gray-600">E-Load not available</p>
                  <p className="text-xs text-gray-400 mt-1">{error}</p>
                  <p className="text-xs text-gray-400 mt-2">Check your GBits API credentials in environment settings.</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <p className="text-gray-400 text-sm">No products available</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {filtered.map(p => (
                    <button
                      key={p.promoId}
                      onClick={() => handleBuy(p)}
                      className="bg-white rounded-2xl px-4 py-3.5 border border-gray-100 shadow-sm active:scale-[0.98] transition-all text-left flex items-center gap-3"
                    >
                      {/* Amount badge */}
                      <div className="shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: netColor + "18" }}>
                        <span className="text-base font-black leading-none text-center" style={{ color: netColor }}>₱{p.amount}</span>
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-extrabold text-gray-900 leading-snug">{p.name}</p>
                        {p.description && (
                          <p className="text-xs text-gray-500 mt-0.5 leading-snug">{p.description}</p>
                        )}
                        {p.validity && (
                          <span className="inline-block mt-1.5 text-[11px] font-semibold text-white px-2 py-0.5 rounded-full" style={{ backgroundColor: netColor }}>
                            {p.validity.replace("Valid for ", "")}
                          </span>
                        )}
                      </div>
                      <ChevronRight className="shrink-0 h-5 w-5 text-gray-300" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    )
  }

  // ── PHONE INPUT ──────────────────────────────────────────────────────────────
  if (step === "phone") {
    const minLen = selectedProduct?.addressMin || 10
    const maxLen = selectedProduct?.addressMax || 11
    const isAN = selectedProduct?.addressType === "AN"
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-white shadow-sm px-4 py-3 flex items-center justify-between">
          <button onClick={() => setStep("browse")} className="flex items-center gap-1 text-gray-400 text-sm font-medium">
            <ChevronLeft className="h-5 w-5" /> Back
          </button>
          <p className="font-bold text-gray-800">Enter {isAN ? "Account No." : "Mobile No."}</p>
          <div className="w-14" />
        </div>

        {/* Progress */}
        <div className="px-5 pt-4 pb-2">
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-1 flex-1 rounded-full" style={{ backgroundColor: i <= 0 ? networkColor : "#E5E7EB" }} />
            ))}
          </div>
          <div className="flex justify-between mt-1">
            {["Number", "Review", "Done"].map(l => <p key={l} className="text-[10px] text-gray-400">{l}</p>)}
          </div>
        </div>

        <div className="flex-1 px-4 pb-6 space-y-4">
          {/* Product summary */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">{selectedProduct?.network}</p>
              <p className="font-bold text-gray-800 text-sm">{selectedProduct?.name}</p>
              {selectedProduct?.validity && <p className="text-[10px] text-gray-400">{selectedProduct.validity}</p>}
            </div>
            <p className="text-xl font-black" style={{ color: networkColor }}>₱{selectedProduct?.amount}</p>
          </div>

          {/* Number display — tappable input supports paste & type */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <input
              type="tel"
              inputMode="numeric"
              maxLength={maxLen}
              value={phone}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, "").slice(0, maxLen)
                setPhone(val)
              }}
              placeholder={isAN ? "Account #" : "09XX XXX XXXX"}
              className="w-full text-3xl font-extrabold text-gray-800 tracking-widest text-center px-4 py-5 bg-transparent focus:outline-none placeholder:text-gray-300"
            />
            {phone.length > 0 && (
              <p className="text-xs text-gray-400 text-center pb-3">{phone.length} / {maxLen} digits</p>
            )}
          </div>

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-2">
            {["1","2","3","4","5","6","7","8","9","C","0","⌫"].map(key => (
              <button
                key={key}
                onClick={() => handlePhoneInput(key)}
                className={`h-14 rounded-2xl text-xl font-bold transition-all active:scale-90 active:opacity-70 ${
                  key === "C" ? "bg-red-50 text-red-500 border border-red-100" :
                  key === "⌫" ? "bg-gray-100 text-gray-500 flex items-center justify-center" :
                  "bg-white text-gray-800 shadow-sm border border-gray-100 hover:bg-gray-50"
                }`}
              >
                {key === "⌫" ? <Delete className="h-5 w-5" /> : key}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-5 gap-2">
            <button onClick={() => setStep("browse")}
              className="col-span-2 h-13 py-3.5 rounded-2xl bg-gray-100 text-gray-500 font-bold text-sm flex items-center justify-center gap-1">
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            <button
              onClick={() => setStep("confirm")}
              disabled={phone.length < minLen}
              className="col-span-3 h-13 py-3.5 rounded-2xl text-white font-bold text-base disabled:opacity-40 disabled:cursor-not-allowed shadow-lg transition-all active:scale-[0.98]"
              style={{ backgroundColor: phone.length >= minLen ? networkColor : undefined }}
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── CONFIRM ──────────────────────────────────────────────────────────────────
  if (step === "confirm") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-white shadow-sm px-4 py-3 flex items-center justify-between">
          <button onClick={() => setStep("phone")} className="flex items-center gap-1 text-gray-400 text-sm font-medium">
            <ChevronLeft className="h-5 w-5" /> Back
          </button>
          <p className="font-bold text-gray-800">Review & Confirm</p>
          <div className="w-14" />
        </div>

        <div className="px-5 pt-4 pb-2">
          <div className="flex gap-1">
            {[0,1,2].map(i => (
              <div key={i} className="h-1 flex-1 rounded-full" style={{ backgroundColor: i <= 1 ? networkColor : "#E5E7EB" }} />
            ))}
          </div>
        </div>

        <div className="flex-1 px-4 pb-6 space-y-4 pt-2">
          {/* Amount hero */}
          <div className="rounded-2xl overflow-hidden shadow-sm">
            <div className="py-6 text-center text-white" style={{ backgroundColor: networkColor }}>
              <p className="text-sm opacity-80 mb-1">{selectedProduct?.network} · {selectedProduct?.name}</p>
              <p className="text-5xl font-black">₱{selectedProduct?.amount}</p>
              {selectedProduct?.validity && <p className="text-xs opacity-70 mt-1">{selectedProduct.validity}</p>}
            </div>
            <div className="bg-white p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Mobile Number</span>
                <span className="font-black text-gray-800 tracking-widest text-base">{phone}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Network</span>
                <span className="font-bold text-gray-800">{selectedProduct?.network}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Product</span>
                <span className="font-bold text-gray-800 text-right max-w-[60%] text-sm">{selectedProduct?.name}</span>
              </div>
              {commSettings && selectedProduct && (() => {
                const feeType = commSettings.eloadFeeType || "flat"
                const feeValue = commSettings.eloadFeeValue ?? 5
                const fee = feeType === "flat" ? feeValue : selectedProduct.amount * feeValue
                return (
                  <>
                    <div className="border-t border-gray-100 pt-2 flex justify-between items-center">
                      <span className="text-sm text-gray-400">Load Amount</span>
                      <span className="font-bold text-gray-800">₱{selectedProduct.amount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">Service Fee</span>
                      <span className="font-bold text-green-600">+₱{fee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-gray-100 pt-2">
                      <span className="text-sm font-semibold text-gray-700">Total to Collect</span>
                      <span className="font-black text-gray-900 text-base">₱{(selectedProduct.amount + fee).toFixed(2)}</span>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700 text-center">
            ⚠️ Double-check the mobile number. Load cannot be reversed.
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setStep("phone")}
              className="h-13 py-3.5 rounded-2xl bg-gray-100 text-gray-500 font-bold text-sm flex items-center justify-center gap-1">
              ✏️ Edit
            </button>
            <button onClick={reset}
              className="h-13 py-3.5 rounded-2xl bg-red-50 text-red-500 font-bold text-sm border border-red-100">
              Cancel
            </button>
          </div>

          <button
            onClick={handleConfirm}
            className="w-full py-4 rounded-2xl text-white font-extrabold text-lg shadow-xl transition-all active:scale-[0.98]"
            style={{ backgroundColor: networkColor }}
          >
            ✅ Send Load Now
          </button>
        </div>
      </div>
    )
  }

  // ── PROCESSING ───────────────────────────────────────────────────────────────
  if (step === "processing") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-center space-y-5 px-6">
        <div className="relative">
          <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ backgroundColor: networkColor }} />
          <div className="relative w-24 h-24 rounded-full flex items-center justify-center" style={{ backgroundColor: networkColor }}>
            <Loader2 className="h-12 w-12 text-white animate-spin" />
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Processing Load</h2>
          <p className="text-gray-400 mt-1">{selectedProduct?.network} · ₱{selectedProduct?.amount}</p>
          <p className="text-gray-400 text-sm">{phone}</p>
          <p className="text-xs text-gray-300 mt-4">Please wait... do not close this screen</p>
        </div>
      </div>
    )
  }

  // ── SUCCESS ──────────────────────────────────────────────────────────────────
  if (step === "success") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-center space-y-5 px-6">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-green-100 animate-pulse" />
          <div className="relative w-28 h-28 rounded-full bg-green-500 flex items-center justify-center shadow-xl shadow-green-500/30">
            <CheckCircle className="h-14 w-14 text-white" />
          </div>
        </div>
        <div>
          <h2 className="text-3xl font-extrabold text-green-600">Load Sent!</h2>
          <p className="text-5xl font-extrabold text-gray-800 mt-2">₱{selectedProduct?.amount}</p>
          <p className="text-gray-400 mt-1">{selectedProduct?.network} · {selectedProduct?.name}</p>
          <p className="text-gray-500 font-bold tracking-widest mt-1">{phone}</p>
        </div>
        {txnId && (
          <div className="bg-white rounded-2xl px-5 py-3 shadow-sm border border-gray-100 w-full max-w-xs">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Gbits Reference No.</p>
            <p className="text-sm font-black text-gray-800 font-mono tracking-wider break-all">{txnId}</p>
          </div>
        )}
        <button
          onClick={reset}
          className="w-full max-w-xs py-4 rounded-2xl text-white font-bold text-lg shadow-lg flex items-center justify-center gap-2"
          style={{ backgroundColor: networkColor }}
        >
          <RotateCcw className="h-5 w-5" /> New Transaction
        </button>
      </div>
    )
  }

  // ── FAILED ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-center space-y-5 px-6">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-red-100 animate-pulse" />
        <div className="relative w-28 h-28 rounded-full bg-red-500 flex items-center justify-center shadow-xl shadow-red-500/30">
          <XCircle className="h-14 w-14 text-white" />
        </div>
      </div>
      <div>
        <h2 className="text-3xl font-extrabold text-red-600">Failed</h2>
        <p className="text-gray-500 mt-2 max-w-xs">{error || "Transaction failed. Please try again."}</p>
      </div>
      <div className="flex gap-3 w-full max-w-xs">
        <button onClick={reset} className="flex-1 py-3.5 rounded-2xl bg-gray-100 text-gray-500 font-bold">Cancel</button>
        <button
          onClick={() => { setError(""); setStep("confirm") }}
          className="flex-1 py-3.5 rounded-2xl text-white font-bold flex items-center justify-center gap-2"
          style={{ backgroundColor: networkColor }}
        >
          <RotateCcw className="h-4 w-4" /> Retry
        </button>
      </div>
    </div>
  )
}
