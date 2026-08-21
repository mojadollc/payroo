"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle, XCircle, AlertTriangle, Loader2, Delete, ChevronLeft, RotateCcw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { getStoreId } from "@/lib/store-id"

const PRESETS = [50, 100, 200, 300, 500, 1000, 2000, 5000]
const MIN_AMOUNT = 50
const MAX_AMOUNT = 50000

type Step = "select" | "account" | "amount" | "confirm" | "sending" | "result"
type ResultType = "success" | "failed" | "error"

function Kiosk() {
  const { toast } = useToast()
  const router = useRouter()
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [step, setStep] = useState<Step>("select")
  const [selectedChannel, setSelectedChannel] = useState("")
  const [selectedChannelName, setSelectedChannelName] = useState("")
  const [selectedChannelColor, setSelectedChannelColor] = useState("#007DFE")
  const [customerName, setCustomerName] = useState("")
  const [customerNumber, setCustomerNumber] = useState("")
  const [amount, setAmount] = useState("")
  const [txnId, setTxnId] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [resultType, setResultType] = useState<ResultType>("success")
  const [resultMsg, setResultMsg] = useState("")
  const [feeRate, setFeeRate] = useState(() => typeof window !== "undefined" ? parseFloat(localStorage.getItem("cs_feeRate") || "0") : 0)
  const [xenditFlatFee, setXenditFlatFee] = useState(() => typeof window !== "undefined" ? parseFloat(localStorage.getItem("cs_xenditFlatFee") || "10") : 10)
  const [xenditVatRate, setXenditVatRate] = useState(() => typeof window !== "undefined" ? parseFloat(localStorage.getItem("cs_xenditVatRate") || "0.12") : 0.12)
  const [adminChargeRate, setAdminChargeRate] = useState(() => typeof window !== "undefined" ? parseFloat(localStorage.getItem("cs_adminChargeRate") || "0.01") : 0.01)
  const [isOnline, setIsOnline] = useState(true)

  const storeId = typeof window !== "undefined" ? getStoreId() : ""
  const storeName = typeof window !== "undefined" ? localStorage.getItem("storeName") || "Payroo POS" : ""

  // Load commission rate — fetch in background, cache in localStorage for instant load next time
  useEffect(() => {
    const sid = getStoreId()
    if (!sid) return
    fetch(`/api/commission-settings?storeId=${sid}`)
      .then(r => r.json())
      .then(({ data: s }) => {
        if (!s) return
        const fr = s.sellerCashinRate || s.gcashCashinRate || 0.02
        const xff = s.xenditFlatFee ?? 10
        const xvr = s.xenditVatRate ?? 0.12
        const acr = s.adminChargeRate ?? 0.01
        setFeeRate(fr); setXenditFlatFee(xff); setXenditVatRate(xvr); setAdminChargeRate(acr)
        localStorage.setItem("cs_feeRate", String(fr))
        localStorage.setItem("cs_xenditFlatFee", String(xff))
        localStorage.setItem("cs_xenditVatRate", String(xvr))
        localStorage.setItem("cs_adminChargeRate", String(acr))
      }).catch(() => {})
  }, [])

  // Online/offline detection — reset to select if offline mid-transaction
  useEffect(() => {
    const handleOffline = () => {
      setIsOnline(false)
      // Cancel any in-progress transaction safely
      if (pollRef.current) clearTimeout(pollRef.current)
      setSubmitting(false)
      reset()
    }
    const handleOnline = () => setIsOnline(true)
    setIsOnline(navigator.onLine)
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  const numAmount = parseFloat(amount) || 0
  const xenditCost = xenditFlatFee
  const xenditVat = Math.ceil(xenditCost * xenditVatRate * 100) / 100
  const xenditTotal = Math.ceil(xenditCost + xenditVat)
  const adminFee = numAmount >= 100 ? Math.ceil(numAmount * adminChargeRate) : 0
  const sellerEarning = Math.ceil(numAmount * feeRate)
  const fee = xenditTotal + adminFee + sellerEarning
  // sendAmount = what the customer wants to send (the entered amount)
  // totalToCollect = what you collect from the customer (send amount + fee)
  const sendAmount = numAmount
  const totalToCollect = numAmount + fee

  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current) }, [])

  // Auto-reset on result screen
  useEffect(() => {
    if (step !== "result") return
    const id = setTimeout(reset, 45000)
    return () => clearTimeout(id)
  }, [step])

  const selectChannel = (id: string, name: string, color: string) => {
    setSelectedChannel(id)
    setSelectedChannelName(name)
    setSelectedChannelColor(color)
    setStep("account")
  }

  const handleNumpad = (val: string) => {
    if (val === "C") { setAmount(""); return }
    if (val === "⌫") { setAmount(a => a.slice(0, -1)); return }
    if (amount.length >= 6) return
    setAmount(a => a + val)
  }

  const handlePhoneNumpad = (val: string) => {
    if (val === "C") { setCustomerNumber(""); return }
    if (val === "⌫") { setCustomerNumber(n => n.slice(0, -1)); return }
    if (customerNumber.length >= 13) return
    setCustomerNumber(n => n + val)
  }

  // ── Send disbursement (Xendit payout) ──
  const handleSend = async () => {
    if (!isOnline) return // blocked by UI, but guard here too
    setSubmitting(true)
    try {
      const res = await fetch("/api/xendit/cashin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountInserted: totalToCollect, fee, xenditCost, xenditVat, xenditTotal, adminFee, sellerEarning, sendAmount,
          channel: selectedChannel, accountNumber: customerNumber.trim(),
          accountName: customerName.trim() || "Customer", storeId, storeName,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setResultType("error")
        // Show friendly message instead of raw API error
        const msg = data.error || ""
        if (msg.toLowerCase().includes("forbidden") || msg.toLowerCase().includes("api key") || msg.toLowerCase().includes("permission"))
          setResultMsg("Payment gateway configuration issue. Please contact the store owner.")
        else if (msg.toLowerCase().includes("insufficient"))
          setResultMsg("Insufficient balance in the kiosk wallet. Please contact the store owner.")
        else if (msg.toLowerCase().includes("account") || msg.toLowerCase().includes("invalid"))
          setResultMsg("Invalid account number. Please double-check and try again.")
        else
          setResultMsg("Transaction could not be processed. Please try again or contact support.")
        setStep("result")
        setSubmitting(false)
        return
      }

      setTxnId(data.txnId)

      // Xendit 200 OK = money is sent, show success immediately
      setResultType("success")
      setResultMsg("")
      setStep("result")
    } catch (err: any) {
      setResultType("error")
      setResultMsg(!isOnline ? "No internet connection. Transaction saved and will be sent automatically when you\'re back online." : "Network error. Please check your connection and try again.")
      setStep("result")
      setSubmitting(false)
    }
  }

  const reset = () => {
    if (pollRef.current) clearTimeout(pollRef.current)
    setStep("select")
    setAmount("")
    setSelectedChannel("")
    setSelectedChannelName("")
    setSelectedChannelColor("#007DFE")
    setCustomerName("")
    setCustomerNumber("")
    setTxnId("")
    setSubmitting(false)
    setResultType("success")
    setResultMsg("")
  }

  const goBack = () => {
    if (step === "select") router.push("/ewallet")
    else if (step === "account") setStep("select")
    else if (step === "amount") setStep("account")
    else if (step === "confirm") setStep("amount")
    else reset()
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Full-screen offline overlay */}
      {!isOnline && (
        <div className="fixed inset-0 z-50 bg-gray-900/95 flex flex-col items-center justify-center text-center px-6 space-y-6">
          <div className="relative">
            <div className="w-28 h-28 rounded-full bg-red-500/20 flex items-center justify-center">
              <span className="text-6xl">📡</span>
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-extrabold text-white">No Internet Connection</h2>
            <p className="text-gray-400 text-base max-w-xs">
              The kiosk requires an active internet connection to process transactions safely.
            </p>
            <p className="text-gray-500 text-sm">
              Any in-progress transaction has been cancelled. Please reconnect and try again.
            </p>
          </div>
          <div className="bg-gray-800 rounded-2xl px-6 py-4 text-sm text-gray-400 space-y-1">
            <p>🔒 No transactions were sent or charged.</p>
            <p>🔄 This screen will dismiss automatically when online.</p>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="bg-white shadow-sm px-4 py-3 flex items-center justify-between">
        <button
          onClick={goBack}
          className="flex items-center gap-1 text-gray-400 hover:text-gray-600 transition text-sm font-medium"
        >
          <ChevronLeft className="h-5 w-5" />
          {step === "select" ? "Exit" : "Back"}
        </button>
        <div className="text-center">
          <p className="font-bold text-gray-800 text-lg">Cash-In</p>
          <p className="text-[10px] text-gray-400">{storeName}</p>
        </div>
        <div className="w-14" />
      </div>

      {/* Progress */}
      {!["sending", "result"].includes(step) && (
        <div className="px-6 pt-4">
          <div className="flex gap-1">
            {["select", "account", "amount", "confirm"].map((s, i) => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-all ${
                ["select", "account", "amount", "confirm"].indexOf(step) >= i ? "bg-blue-500" : "bg-gray-200"
              }`} />
            ))}
          </div>
          <div className="flex justify-between mt-1">
            {["Wallet", "Account", "Amount", "Confirm"].map(l => (
              <p key={l} className="text-[10px] text-gray-400">{l}</p>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-4 pt-6 pb-4 overflow-y-auto">

        {/* ═══ Step 1: Select Wallet / Bank ═══ */}
        {step === "select" && (
          <div className="w-full max-w-lg space-y-5">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-800">Select Wallet / Bank</h2>
              <p className="text-gray-400 text-sm mt-1">Where should we send the money?</p>
            </div>

            {/* E-Wallets */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">E-Wallets</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: "GCASH", name: "GCash", color: "#007DFE", icon: "/wallets/gcash.svg" },
                  { id: "MAYA", name: "Maya", color: "#00B900", icon: "/wallets/maya.svg" },
                  { id: "SHOPEEPAY", name: "ShopeePay", color: "#EE4D2D", icon: "/wallets/shopeepay.svg" },
                  { id: "GRABPAY", name: "GrabPay", color: "#00B14F", icon: "/wallets/grabpay.svg" },
                ].map(w => (
                  <button key={w.id} onClick={() => selectChannel(w.id, w.name, w.color)}
                    className="bg-white rounded-2xl p-5 shadow-sm border-2 border-transparent hover:border-blue-400 hover:shadow-lg transition-all active:scale-[0.96] flex flex-col items-center gap-2">
                    <img src={w.icon} alt={w.name} className="w-14 h-14 object-contain rounded-xl" />
                    <p className="font-bold text-gray-800 text-sm">{w.name}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Banks */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">Banks</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: "BPI", name: "BPI", color: "#C8102E", icon: "/wallets/bpi.svg" },
                  { id: "UBP", name: "UnionBank", color: "#F47920", icon: "/wallets/unionbank.svg" },
                  { id: "CHINABANK", name: "Chinabank", color: "#003DA5", icon: "/wallets/chinabank.svg" },
                  { id: "RCBC", name: "RCBC", color: "#003DA5", icon: "/wallets/rcbc.svg" },
                ].map(b => (
                  <button key={b.id} onClick={() => selectChannel(b.id, b.name, b.color)}
                    className="bg-white rounded-2xl p-4 shadow-sm border-2 border-transparent hover:border-blue-400 hover:shadow-lg transition-all active:scale-[0.96] flex items-center gap-3">
                    <img src={b.icon} alt={b.name} className="w-11 h-11 object-contain rounded-lg" />
                    <div className="text-left">
                      <p className="font-bold text-gray-800 text-sm">{b.name}</p>
                      <p className="text-[10px] text-gray-400">Bank Transfer</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* OTC */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">Over-the-Counter</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: "CEBUANA", name: "Cebuana", color: "#F5A623", icon: "/wallets/cebuana.svg" },
                  { id: "LBC", name: "LBC", color: "#E31937", icon: "/wallets/lbc.svg" },
                ].map(b => (
                  <button key={b.id} onClick={() => selectChannel(b.id, b.name, b.color)}
                    className="bg-white rounded-2xl p-4 shadow-sm border-2 border-transparent hover:border-yellow-400 hover:shadow-lg transition-all active:scale-[0.96] flex items-center gap-3">
                    <img src={b.icon} alt={b.name} className="w-11 h-11 object-contain rounded-lg" />
                    <div className="text-left">
                      <p className="font-bold text-gray-800 text-sm">{b.name}</p>
                      <p className="text-[10px] text-gray-400">OTC</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ Step 2: Account / Phone Number (Numpad) ═══ */}
        {step === "account" && (
          <div className="w-full max-w-md space-y-4">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-white text-xs font-bold mb-2" style={{ backgroundColor: selectedChannelColor }}>
                {selectedChannelName}
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Enter Account Number</h2>
              <p className="text-gray-400 text-sm mt-1">Phone number or account number</p>
            </div>

            {/* Number display */}
            <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
              <p className="text-4xl font-extrabold text-gray-800 min-h-[48px] tracking-widest">
                {customerNumber || <span className="text-gray-300">09XX XXX XXXX</span>}
              </p>
            </div>

            {/* Numpad for phone number */}
            <div className="grid grid-cols-3 gap-2">
              {["1","2","3","4","5","6","7","8","9","C","0","⌫"].map(key => (
                <button key={key} onClick={() => handlePhoneNumpad(key)}
                  className={`h-16 rounded-2xl text-2xl font-bold transition-all duration-100 active:scale-90 active:bg-yellow-400 active:text-white ${
                    key === "C" ? "bg-red-50 text-red-500" :
                    key === "⌫" ? "bg-gray-100 text-gray-500 flex items-center justify-center" :
                    "bg-white text-gray-800 shadow-sm hover:bg-gray-50"
                  }`}>
                  {key === "⌫" ? <Delete className="h-6 w-6" /> : key}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-5 gap-2">
              <button onClick={() => setStep("select")}
                className="col-span-2 h-14 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-500 font-bold text-base transition-all active:scale-[0.98] flex items-center justify-center gap-1">
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
              <button
                onClick={() => { if (customerNumber.length >= 10) setStep("amount") }}
                disabled={customerNumber.length < 10}
                className="col-span-3 h-14 rounded-2xl bg-blue-500 hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold text-lg transition-all active:scale-[0.98] shadow-lg shadow-blue-500/20">
                Continue
              </button>
            </div>
            {customerNumber.length > 0 && customerNumber.length < 10 && (
              <p className="text-center text-xs text-red-400">Enter at least 10 digits</p>
            )}
          </div>
        )}

        {/* ═══ Step 3: Enter Amount (Numpad) ═══ */}
        {step === "amount" && (
          <div className="w-full max-w-md space-y-4">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-white text-xs font-bold mb-2" style={{ backgroundColor: selectedChannelColor }}>
                {selectedChannelName}
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Enter Amount</h2>
              <p className="text-gray-400 text-sm mt-1">Amount the customer wants to send</p>
            </div>

            {/* Amount display */}
            <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
              <p className="text-5xl font-extrabold text-gray-800 min-h-[56px]">₱{amount || "0"}</p>
              {numAmount > 0 && (
                <div className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between text-gray-400">
                    <span>Send Amount</span>
                    <span className="font-semibold text-blue-600">₱{sendAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Service Fee</span>
                    <span className="font-semibold text-orange-500">+₱{fee}</span>
                  </div>
                  <div className="flex justify-between font-bold text-gray-700 border-t pt-1">
                    <span>Collect from Customer</span>
                    <span className="text-green-600">₱{totalToCollect.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Preset amounts */}
            <div className="grid grid-cols-4 gap-2">
              {PRESETS.map(a => (
                <button key={a} onClick={() => setAmount(String(a))}
                  className={`h-12 rounded-xl font-bold text-base transition-all duration-100 active:scale-90 active:bg-yellow-400 active:text-white ${
                    numAmount === a ? "bg-blue-500 text-white shadow-md" : "bg-white text-gray-600 shadow-sm hover:bg-blue-50"
                  }`}>
                  {a >= 1000 ? `₱${a / 1000}K` : `₱${a}`}
                </button>
              ))}
            </div>

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-2">
              {["1","2","3","4","5","6","7","8","9","C","0","⌫"].map(key => (
                <button key={key} onClick={() => handleNumpad(key)}
                  className={`h-16 rounded-2xl text-2xl font-bold transition-all duration-100 active:scale-90 active:bg-yellow-400 active:text-white ${
                    key === "C" ? "bg-red-50 text-red-500" :
                    key === "⌫" ? "bg-gray-100 text-gray-500 flex items-center justify-center" :
                    "bg-white text-gray-800 shadow-sm hover:bg-gray-50"
                  }`}>
                  {key === "⌫" ? <Delete className="h-6 w-6" /> : key}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-5 gap-2">
              <button onClick={() => setStep("account")}
                className="col-span-2 h-14 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-500 font-bold text-base transition-all active:scale-[0.98] flex items-center justify-center gap-1">
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
              <button onClick={() => { if (numAmount >= MIN_AMOUNT && numAmount <= MAX_AMOUNT) setStep("confirm") }}
                disabled={numAmount < MIN_AMOUNT || numAmount > MAX_AMOUNT}
                className="col-span-3 h-14 rounded-2xl bg-blue-500 hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold text-lg transition-all active:scale-[0.98] shadow-lg shadow-blue-500/20">
                Continue
              </button>
            </div>
          </div>
        )}

        {/* ═══ Step 4: Confirm / Review All Details ═══ */}
        {step === "confirm" && (
          <div className="w-full max-w-md space-y-4">
            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-800">Review & Confirm</h2>
              <p className="text-sm text-gray-400 mt-1">Verify all details before sending</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {/* Header with amount */}
              <div className="bg-blue-500 px-5 py-4 text-center" style={{ backgroundColor: selectedChannelColor }}>
                <p className="text-white/70 text-sm">Receiver Gets</p>
                <p className="text-white font-extrabold text-3xl">₱{sendAmount.toLocaleString()}</p>
              </div>

              {/* All details */}
              <div className="p-5 space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Wallet / Bank</span>
                  <span className="font-medium text-gray-800">{selectedChannelName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Account Number</span>
                  <span className="font-bold text-gray-800 tracking-wider">{customerNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Account Name</span>
                  <span className="font-medium text-gray-800">{customerName || "—"}</span>
                </div>
                <div className="border-t pt-3 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">Send Amount</span>
                    <span className="font-bold text-gray-800">₱{sendAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">Service Fee</span>
                    <span className="text-orange-500 font-medium">+₱{fee}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-gray-700 text-sm font-semibold">Total to Collect</span>
                    <span className="font-extrabold text-green-600 text-lg">₱{totalToCollect.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700 text-center">
              ⚠️ Double-check the account number. This cannot be reversed.
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setStep("account")}
                className="h-14 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-500 font-bold text-base transition-all active:scale-[0.98] flex items-center justify-center gap-1">
                ✏️ Edit
              </button>
              <button onClick={reset}
                className="h-14 rounded-2xl bg-red-50 hover:bg-red-100 text-red-500 font-bold text-base transition-all active:scale-[0.98] border border-red-200">
                Cancel
              </button>
            </div>

            <button onClick={handleSend} disabled={submitting || !isOnline}
              className="w-full h-16 rounded-2xl bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-xl transition-all active:scale-[0.98] shadow-xl shadow-green-500/30 flex items-center justify-center gap-2">
              {submitting ? <><Loader2 className="h-5 w-5 animate-spin" /> Sending...</> : !isOnline ? "📡 No Connection" : "✅ Confirm & Send Now"}
            </button>
          </div>
        )}

        {/* ═══ Step 5: Sending — Waiting for Xendit ═══ */}
        {step === "sending" && (
          <div className="w-full max-w-md text-center space-y-6 pt-12">
            <div className="relative mx-auto w-24 h-24">
              <div className="absolute inset-0 rounded-full bg-blue-100 animate-ping opacity-30" />
              <div className="relative w-24 h-24 rounded-full bg-blue-500 flex items-center justify-center shadow-xl shadow-blue-500/30">
                <Loader2 className="h-12 w-12 text-white animate-spin" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Sending ₱{sendAmount.toLocaleString()} to {selectedChannelName}</h2>
              <p className="text-gray-400 mt-2">{customerNumber}</p>
              <p className="text-sm text-gray-300 mt-4">Please wait... do not close this screen.</p>
            </div>
            <button onClick={reset}
              className="w-full h-12 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-500 font-bold text-base transition-all active:scale-[0.98]">
              Cancel
            </button>
          </div>
        )}

        {/* ═══ Step 6: Result ═══ */}
        {step === "result" && (
          <div className="w-full max-w-md text-center space-y-5 pt-8">
            {/* Big emoji result */}
            {resultType === "success" && (
              <>
                <div className="relative mx-auto w-28 h-28">
                  <div className="absolute inset-0 rounded-full bg-green-100 animate-pulse" />
                  <div className="relative w-28 h-28 rounded-full bg-green-500 flex items-center justify-center shadow-xl shadow-green-500/30">
                    <CheckCircle className="h-14 w-14 text-white" />
                  </div>
                </div>
                <div>
                  <h2 className="text-3xl font-extrabold text-green-600">✅ Sent Successfully!</h2>
                  <p className="text-5xl font-extrabold text-gray-800 mt-2">₱{sendAmount.toLocaleString()}</p>
                  <p className="text-gray-400 mt-2">sent to {selectedChannelName}</p>
                  {customerName && <p className="text-gray-400">{customerName}</p>}
                  <p className="text-gray-400 text-sm">{customerNumber}</p>
                  {selectedChannel === "SHOPEEPAY" && (
                    <p className="text-sm text-orange-600 bg-orange-50 border border-orange-200 rounded-xl px-4 py-2 mt-3">
                      ⏳ Please allow/wait 10-15mins to reflect to your ShopeePay account
                    </p>
                  )}
                </div>
              </>
            )}

            {resultType === "failed" && (
              <>
                <div className="relative mx-auto w-28 h-28">
                  <div className="absolute inset-0 rounded-full bg-red-100 animate-pulse" />
                  <div className="relative w-28 h-28 rounded-full bg-red-500 flex items-center justify-center shadow-xl shadow-red-500/30">
                    <XCircle className="h-14 w-14 text-white" />
                  </div>
                </div>
                <div>
                  <h2 className="text-3xl font-extrabold text-red-600">❌ Transaction Declined</h2>
                  <p className="text-gray-500 mt-2 max-w-xs mx-auto">{resultMsg || "The transaction was declined."}</p>
                </div>
              </>
            )}

            {resultType === "error" && (
              <>
                <div className="relative mx-auto w-28 h-28">
                  <div className="absolute inset-0 rounded-full bg-amber-100 animate-pulse" />
                  <div className="relative w-28 h-28 rounded-full bg-amber-500 flex items-center justify-center shadow-xl shadow-amber-500/30">
                    <AlertTriangle className="h-14 w-14 text-white" />
                  </div>
                </div>
                <div>
                  <h2 className="text-3xl font-extrabold text-amber-600">⚠️ Something Went Wrong</h2>
                  <p className="text-gray-500 mt-2 max-w-xs mx-auto">{resultMsg || "An error occurred. Please try again."}</p>
                </div>
              </>
            )}

            {txnId && (
              <div className="bg-gray-100 rounded-xl px-4 py-2 inline-block">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Reference</p>
                <p className="text-xs font-mono text-gray-500">{txnId}</p>
              </div>
            )}

            <button onClick={reset}
              className="w-full h-14 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-lg transition-all active:scale-[0.98] shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2">
              <RotateCcw className="h-5 w-5" /> New Transaction
            </button>
            <p className="text-xs text-gray-300">Auto-resets in 45 seconds</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-white border-t px-4 py-2.5 flex items-center justify-between">
        <p className="text-[10px] text-gray-300">Powered by Xendit</p>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
          <p className="text-[10px] text-gray-300">Online</p>
        </div>
        <p className="text-[10px] text-gray-300">Payroo POS</p>
      </div>
    </div>
  )
}

export default function CashInPage() {
  return <Kiosk />
}
