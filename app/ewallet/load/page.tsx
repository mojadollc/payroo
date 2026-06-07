"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  ChevronLeft, CheckCircle, XCircle, AlertTriangle,
  Loader2, Delete, RotateCcw, Search, X, Signal,
} from "lucide-react"

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
  const [selectedNetwork, setSelectedNetwork] = useState<string>("ALL")
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [phone, setPhone] = useState("")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [txnId, setTxnId] = useState("")
  const [error, setError] = useState("")
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch("/api/eload")
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
      })
      .catch((err) => { setError(err.message || "Failed to load products") })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current) }, [])

  // Filter products
  const displayProducts = (() => {
    let list = products
    if (selectedNetwork !== "ALL") list = list.filter(p => p.network === selectedNetwork)
    if (search.trim().length >= 2) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.network.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        String(p.amount).includes(q)
      )
    }
    return list
  })()

  const handleBuy = (p: Product) => { setSelectedProduct(p); setPhone(""); setStep("phone") }

  const handlePhoneInput = (val: string) => {
    if (val === "C") { setPhone(""); return }
    if (val === "⌫") { setPhone(n => n.slice(0, -1)); return }
    if (phone.length >= (selectedProduct?.addressMax || 11)) return
    setPhone(n => n + val)
  }

  const handleConfirm = async () => {
    if (!selectedProduct) return
    setStep("processing")
    try {
      const res = await fetch("/api/eload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promoId: selectedProduct.promoId, address: phone, amount: selectedProduct.amount }),
      })
      const data = await res.json()
      if (data.status === "completed") { setTxnId(data.txnId || ""); setStep("success") }
      else if (data.status === "pending") { await pollStatus(data.txnId) }
      else { setError(data.error || "Transaction failed."); setStep("failed") }
    } catch {
      setError("Network error. Please try again.")
      setStep("failed")
    }
  }

  const pollStatus = async (id: string) => {
    const start = Date.now()
    while (Date.now() - start < 60000) {
      await new Promise(r => setTimeout(r, 3000))
      try {
        const res = await fetch(`/api/eload?action=status&txnId=${id}`)
        const data = await res.json()
        if (data.status === "completed") { setTxnId(data.txnId || id); setStep("success"); return }
        if (data.status === "failed") { setError(data.error || "Failed"); setStep("failed"); return }
      } catch {}
    }
    setError("Still processing. Check back shortly.")
    setStep("failed")
  }

  const reset = () => { setStep("browse"); setSelectedProduct(null); setPhone(""); setTxnId(""); setError("") }

  const networkColor = selectedProduct ? (NETWORK_COLORS[selectedProduct.network] || "#6366F1") : "#6366F1"

  // ════════════════════════════════════════════════════════════════════════════
  // BROWSE — GCash-style layout
  // ════════════════════════════════════════════════════════════════════════════
  if (step === "browse") {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        {/* Blue header like GCash */}
        <div className="bg-gradient-to-b from-indigo-600 to-indigo-500 text-white px-4 pb-5 pt-4 rounded-b-3xl shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => router.push("/ewallet")} className="flex items-center gap-1 text-white/80 text-sm">
              <ChevronLeft className="h-5 w-5" /> Back
            </button>
            <h1 className="font-bold text-lg">Buy Load</h1>
            <div className="w-14" />
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-300 pointer-events-none" />
            <input
              type="text"
              placeholder="Search promos, networks, amounts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-11 pl-10 pr-10 rounded-xl bg-white/15 border border-white/20 text-white placeholder:text-white/50 text-sm focus:outline-none focus:bg-white/25 focus:border-white/40 backdrop-blur-sm"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2">
                <X className="h-4 w-4 text-white/60" />
              </button>
            )}
          </div>
        </div>

        {/* Network pills — horizontal scroll like GCash */}
        <div className="px-4 py-3 -mt-3">
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-3">
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              <button
                onClick={() => setSelectedNetwork("ALL")}
                className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl shrink-0 transition-all min-w-[60px] ${
                  selectedNetwork === "ALL" ? "bg-indigo-50 ring-2 ring-indigo-400" : "hover:bg-gray-50"
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                  <Signal className="h-5 w-5 text-white" />
                </div>
                <span className={`text-[10px] font-bold ${selectedNetwork === "ALL" ? "text-indigo-600" : "text-gray-500"}`}>All</span>
              </button>
              {networks.map(net => {
                const color = NETWORK_COLORS[net] || "#6366F1"
                const active = selectedNetwork === net
                return (
                  <button
                    key={net}
                    onClick={() => setSelectedNetwork(net)}
                    className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl shrink-0 transition-all min-w-[60px] ${
                      active ? "bg-indigo-50 ring-2 ring-indigo-400" : "hover:bg-gray-50"
                    }`}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[9px] font-black"
                      style={{ backgroundColor: color }}
                    >
                      {net.length > 4 ? net.slice(0, 3) : net}
                    </div>
                    <span className={`text-[10px] font-bold ${active ? "text-indigo-600" : "text-gray-500"}`}>
                      {net.length > 6 ? net.slice(0, 6) : net}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Product List */}
        <div className="flex-1 px-4 pb-6 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
              <p className="text-sm text-gray-400">Loading promos...</p>
            </div>
          ) : error && displayProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center px-4">
              <AlertTriangle className="h-8 w-8 text-amber-500 mb-2" />
              <p className="text-sm font-medium text-gray-600">E-Load not available</p>
              <p className="text-xs text-gray-400 mt-1">{error}</p>
            </div>
          ) : displayProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <Search className="h-8 w-8 text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">
                {search ? `No results for "${search}"` : "No promos available"}
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-400 mb-3 font-medium">
                {search ? `${displayProducts.length} result${displayProducts.length !== 1 ? "s" : ""}` : `${displayProducts.length} promos available`}
              </p>
              <div className="space-y-2.5">
                {displayProducts.map(p => (
                  <button
                    key={`${p.promoId}-${p.network}`}
                    onClick={() => handleBuy(p)}
                    className="w-full bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md active:scale-[0.98] transition-all text-left flex items-center gap-3"
                  >
                    {/* Network badge */}
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center text-white text-[9px] font-black shrink-0 shadow-sm"
                      style={{ backgroundColor: NETWORK_COLORS[p.network] || "#6366F1" }}
                    >
                      {p.network.length > 4 ? p.network.slice(0, 3) : p.network}
                    </div>

                    {/* Product info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{p.name}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                        {p.description || p.category || p.network}
                      </p>
                      {p.validity && (
                        <span className="inline-block mt-1 text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-medium">
                          {p.validity.replace("Valid for ", "")}
                        </span>
                      )}
                    </div>

                    {/* Price */}
                    <div className="text-right shrink-0">
                      <p className="text-lg font-black text-gray-800">₱{p.amount}</p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHONE INPUT
  // ════════════════════════════════════════════════════════════════════════════
  if (step === "phone") {
    const minLen = selectedProduct?.addressMin || 10
    const maxLen = selectedProduct?.addressMax || 11
    const isAN = selectedProduct?.addressType === "AN"
    return (
      <div className="min-h-screen bg-white flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 flex items-center gap-3 border-b border-gray-100">
          <button onClick={() => setStep("browse")} className="text-gray-400"><ChevronLeft className="h-6 w-6" /></button>
          <div className="flex-1">
            <p className="font-bold text-gray-800 text-base">Enter {isAN ? "Account" : "Number"}</p>
            <p className="text-[11px] text-gray-400">{selectedProduct?.network} · {selectedProduct?.name}</p>
          </div>
          <p className="text-lg font-black" style={{ color: networkColor }}>₱{selectedProduct?.amount}</p>
        </div>

        <div className="flex-1 px-5 pt-6 pb-4 flex flex-col">
          {/* Number display */}
          <div className="text-center mb-6">
            <p className="text-4xl font-black text-gray-800 tracking-wider min-h-[48px]">
              {phone || <span className="text-gray-300">{isAN ? "Account #" : "09XXXXXXXXX"}</span>}
            </p>
            <p className="text-xs text-gray-400 mt-2">{phone.length} / {maxLen} digits</p>
          </div>

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-3 flex-1 max-h-[360px]">
            {["1","2","3","4","5","6","7","8","9","C","0","⌫"].map(key => (
              <button
                key={key}
                onClick={() => handlePhoneInput(key)}
                className={`rounded-2xl text-2xl font-bold transition-all active:scale-90 ${
                  key === "C" ? "bg-red-50 text-red-500" :
                  key === "⌫" ? "bg-gray-100 text-gray-500 flex items-center justify-center" :
                  "bg-gray-50 text-gray-800 hover:bg-gray-100 active:bg-indigo-100"
                }`}
              >
                {key === "⌫" ? <Delete className="h-6 w-6" /> : key}
              </button>
            ))}
          </div>

          {/* Action */}
          <button
            onClick={() => setStep("confirm")}
            disabled={phone.length < minLen}
            className="mt-4 w-full py-4 rounded-2xl text-white font-bold text-lg disabled:opacity-40 disabled:bg-gray-300 shadow-lg active:scale-[0.98] transition-all"
            style={{ backgroundColor: phone.length >= minLen ? networkColor : undefined }}
          >
            Continue
          </button>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CONFIRM
  // ════════════════════════════════════════════════════════════════════════════
  if (step === "confirm") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="px-4 py-3 flex items-center gap-3 bg-white border-b border-gray-100">
          <button onClick={() => setStep("phone")} className="text-gray-400"><ChevronLeft className="h-6 w-6" /></button>
          <p className="font-bold text-gray-800 text-base flex-1">Confirm Load</p>
        </div>

        <div className="flex-1 px-4 py-5 space-y-4">
          {/* Hero card */}
          <div className="rounded-3xl overflow-hidden shadow-md">
            <div className="py-8 text-center text-white" style={{ backgroundColor: networkColor }}>
              <p className="text-sm opacity-80">{selectedProduct?.network}</p>
              <p className="text-5xl font-black mt-1">₱{selectedProduct?.amount}</p>
              <p className="text-xs opacity-70 mt-2">{selectedProduct?.name}</p>
              {selectedProduct?.validity && (
                <p className="text-xs opacity-60 mt-1">{selectedProduct.validity}</p>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex justify-between">
              <span className="text-sm text-gray-400">Send to</span>
              <span className="font-black text-gray-800 tracking-widest">{phone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-400">Network</span>
              <span className="font-bold text-gray-800">{selectedProduct?.network}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-400">Product</span>
              <span className="font-medium text-gray-800 text-right max-w-[55%] text-sm">{selectedProduct?.name}</span>
            </div>
            <div className="border-t pt-3 flex justify-between">
              <span className="text-sm font-bold text-gray-800">Total</span>
              <span className="text-xl font-black" style={{ color: networkColor }}>₱{selectedProduct?.amount}</span>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-sm text-amber-700 text-center">
            ⚠️ Double-check the number. Load cannot be reversed.
          </div>
        </div>

        {/* Bottom buttons */}
        <div className="px-4 pb-6 space-y-3">
          <button
            onClick={handleConfirm}
            className="w-full py-4 rounded-2xl text-white font-bold text-lg shadow-xl active:scale-[0.98] transition-all"
            style={{ backgroundColor: networkColor }}
          >
            Send Load
          </button>
          <button onClick={reset} className="w-full py-3 rounded-2xl bg-gray-100 text-gray-500 font-bold text-sm">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PROCESSING
  // ════════════════════════════════════════════════════════════════════════════
  if (step === "processing") {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center text-center px-6 space-y-6">
        <div className="relative">
          <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ backgroundColor: networkColor }} />
          <div className="relative w-24 h-24 rounded-full flex items-center justify-center shadow-xl" style={{ backgroundColor: networkColor }}>
            <Loader2 className="h-12 w-12 text-white animate-spin" />
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Sending Load</h2>
          <p className="text-gray-400 mt-2">{selectedProduct?.network} · ₱{selectedProduct?.amount}</p>
          <p className="text-gray-500 font-bold tracking-widest">{phone}</p>
          <p className="text-xs text-gray-300 mt-6">Please wait...</p>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SUCCESS
  // ════════════════════════════════════════════════════════════════════════════
  if (step === "success") {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center text-center px-6 space-y-5">
        <div className="w-24 h-24 rounded-full bg-green-500 flex items-center justify-center shadow-xl shadow-green-500/30">
          <CheckCircle className="h-12 w-12 text-white" />
        </div>
        <div>
          <h2 className="text-3xl font-black text-green-600">Load Sent!</h2>
          <p className="text-4xl font-black text-gray-800 mt-2">₱{selectedProduct?.amount}</p>
          <p className="text-gray-400 mt-1">{selectedProduct?.network} · {selectedProduct?.name}</p>
          <p className="text-gray-600 font-bold tracking-widest mt-1">{phone}</p>
        </div>
        {txnId && (
          <div className="bg-gray-50 rounded-2xl px-5 py-3 w-full max-w-xs">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Reference No.</p>
            <p className="text-sm font-black text-gray-800 font-mono break-all">{txnId}</p>
          </div>
        )}
        <button
          onClick={reset}
          className="w-full max-w-xs py-4 rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 text-white active:scale-[0.98]"
          style={{ backgroundColor: networkColor }}
        >
          <RotateCcw className="h-5 w-5" /> New Load
        </button>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // FAILED
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center text-center px-6 space-y-5">
      <div className="w-24 h-24 rounded-full bg-red-500 flex items-center justify-center shadow-xl shadow-red-500/30">
        <XCircle className="h-12 w-12 text-white" />
      </div>
      <div>
        <h2 className="text-2xl font-black text-red-600">Failed</h2>
        <p className="text-gray-500 mt-2 max-w-xs">{error || "Transaction failed."}</p>
      </div>
      <div className="flex gap-3 w-full max-w-xs">
        <button onClick={reset} className="flex-1 py-3.5 rounded-2xl bg-gray-100 text-gray-500 font-bold">Cancel</button>
        <button
          onClick={() => { setError(""); setStep("confirm") }}
          className="flex-1 py-3.5 rounded-2xl text-white font-bold flex items-center justify-center gap-2 active:scale-[0.98]"
          style={{ backgroundColor: networkColor }}
        >
          <RotateCcw className="h-4 w-4" /> Retry
        </button>
      </div>
    </div>
  )
}
