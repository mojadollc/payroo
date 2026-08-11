"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useHardwareScanner } from "@/hooks/use-hardware-scanner"

interface BarcodeScannerProps {
  onScan: (barcode: string) => void
  onClose: () => void
}

function beep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 1800
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.12)
  } catch {}
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const [manualBarcode, setManualBarcode] = useState("")
  const [status, setStatus] = useState<"loading" | "active" | "error">("loading")
  const [errorMsg, setErrorMsg] = useState("")
  const [lastScanned, setLastScanned] = useState("")
  const [scanFlash, setScanFlash] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [hasTorch, setHasTorch] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>(0)
  const lastCodeRef = useRef("")
  const lastTimeRef = useRef(0)
  const mountedRef = useRef(true)

  useHardwareScanner({ onScan })

  const handleDetected = useCallback((code: string) => {
    const now = Date.now()
    if (!code || (code === lastCodeRef.current && now - lastTimeRef.current < 1500)) return
    lastCodeRef.current = code
    lastTimeRef.current = now
    beep()
    setLastScanned(code)
    setScanFlash(true)
    setTimeout(() => setScanFlash(false), 300)
    onScan(code)
  }, [onScan])

  // Toggle torch/flashlight
  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as any] })
      setTorchOn(t => !t)
    } catch {}
  }

  useEffect(() => {
    mountedRef.current = true
    // Lock body scroll while scanner is open
    document.body.style.overflow = "hidden"
    let zxingReader: any = null

    const start = async () => {
      try {
        let stream: MediaStream | null = null
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              // @ts-ignore
              advanced: [{ focusMode: "continuous" }],
            },
          })
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
          })
        }

        if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream

        // Check torch support
        const track = stream.getVideoTracks()[0]
        const caps = track.getCapabilities() as any
        if (caps?.torch) setHasTorch(true)

        const video = videoRef.current!
        video.srcObject = stream
        video.setAttribute("playsinline", "true")
        await video.play()
        if (!mountedRef.current) return
        setStatus("active")

        // Strategy 1: Native BarcodeDetector
        if ("BarcodeDetector" in window) {
          // @ts-ignore
          const detector = new window.BarcodeDetector({
            formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39",
              "code_93", "codabar", "itf", "qr_code", "data_matrix", "pdf417", "aztec"],
          })
          const scanNative = async () => {
            if (!mountedRef.current) return
            if (video.readyState === video.HAVE_ENOUGH_DATA) {
              try {
                const results = await detector.detect(video)
                if (results.length > 0) handleDetected(results[0].rawValue)
              } catch {}
            }
            rafRef.current = requestAnimationFrame(scanNative)
          }
          rafRef.current = requestAnimationFrame(scanNative)
          return
        }

        // Strategy 2: ZXing fallback
        const { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } = await import("@zxing/library")
        const hints = new Map()
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.QR_CODE,
          BarcodeFormat.DATA_MATRIX, BarcodeFormat.PDF_417, BarcodeFormat.AZTEC,
          BarcodeFormat.ITF, BarcodeFormat.CODABAR,
        ])
        hints.set(DecodeHintType.TRY_HARDER, true)
        zxingReader = new BrowserMultiFormatReader(hints)

        const canvas = canvasRef.current!
        const ctx2d = canvas.getContext("2d", { willReadFrequently: true })!
        const scanZxing = () => {
          if (!mountedRef.current) return
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            ctx2d.drawImage(video, 0, 0)
            try {
              const result = zxingReader.decodeFromCanvas(canvas)
              if (result) handleDetected(result.getText())
            } catch {}
          }
          rafRef.current = requestAnimationFrame(scanZxing)
        }
        rafRef.current = requestAnimationFrame(scanZxing)

      } catch (err: any) {
        if (mountedRef.current) {
          setStatus("error")
          setErrorMsg(
            err?.message?.includes("Permission") || err?.name === "NotAllowedError"
              ? "Camera permission denied. Please allow camera access in your browser settings."
              : "Could not start camera. Use manual entry below."
          )
        }
      }
    }

    start()

    return () => {
      mountedRef.current = false
      document.body.style.overflow = ""
      cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
      zxingReader?.reset?.()
    }
  }, [handleDetected])

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const val = manualBarcode.trim()
    if (val) { onScan(val); setManualBarcode("") }
  }

  return (
    // True fullscreen overlay — covers everything including nav bars
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col">

      {/* ── Full-screen camera feed ── */}
      <div className="relative flex-1 overflow-hidden">
        {/* Loading spinner */}
        {status === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black">
            <div className="h-10 w-10 rounded-full border-4 border-green-400 border-t-transparent animate-spin" />
            <p className="text-white/70 text-sm">Starting camera…</p>
          </div>
        )}

        {/* Video — fills entire area */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: status === "active" ? 1 : 0 }}
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Green flash on scan */}
        {scanFlash && (
          <div className="absolute inset-0 bg-green-400/25 pointer-events-none z-10" />
        )}

        {/* Error state */}
        {status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/90 p-6 z-10">
            <p className="text-white text-center text-sm leading-relaxed">{errorMsg}</p>
          </div>
        )}

        {/* ── Viewfinder overlay ── */}
        {status === "active" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            {/* Dark mask with transparent cutout */}
            <div className="absolute inset-0 bg-black/45" />
            {/* Cutout box */}
            <div
              className="relative z-10 bg-transparent"
              style={{ width: "min(80vw, 340px)", height: "min(40vw, 180px)" }}
            >
              {/* Corner brackets */}
              {[
                "top-0 left-0 border-t-[3px] border-l-[3px] rounded-tl-lg",
                "top-0 right-0 border-t-[3px] border-r-[3px] rounded-tr-lg",
                "bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-lg",
                "bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-lg",
              ].map((cls, i) => (
                <div key={i} className={`absolute w-8 h-8 border-green-400 ${cls}`} />
              ))}
              {/* Animated scan line */}
              <div
                className="absolute left-1 right-1 h-[2px] bg-green-400 shadow-[0_0_6px_2px_rgba(74,222,128,0.7)]"
                style={{ animation: "scanline 2s ease-in-out infinite" }}
              />
            </div>
            {/* Hint text below viewfinder */}
            <p className="absolute text-white/80 text-xs font-medium tracking-wide"
              style={{ top: "calc(50% + min(20vw, 100px) + 14px)" }}>
              {lastScanned ? `✓ ${lastScanned}` : "Align barcode or QR code inside the frame"}
            </p>
          </div>
        )}

        {/* ── Top bar: title + close + torch ── */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 pt-safe"
          style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 12px)" }}>
          <div>
            <p className="text-white font-semibold text-base leading-tight drop-shadow">Scan Barcode / QR</p>
            <p className="text-white/60 text-xs">Camera • USB scanner • Manual</p>
          </div>
          <div className="flex items-center gap-2">
            {hasTorch && (
              <button
                onClick={toggleTorch}
                className={`h-10 w-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                  torchOn ? "bg-yellow-400 border-yellow-300 text-black" : "bg-black/50 border-white/30 text-white"
                }`}
              >
                {/* Flashlight icon inline */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6c0-2.2-1.8-4-4-4H6L4 10h4l-2 12 12-8h-4l4-8z"/>
                </svg>
              </button>
            )}
            <button
              onClick={onClose}
              className="h-10 w-10 rounded-full bg-black/50 border-2 border-white/30 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Bottom panel: manual entry ── */}
      <div className="bg-black/90 border-t border-white/10 px-4 py-3 pb-safe"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 12px)" }}>
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <Input
            placeholder="Type barcode / product code…"
            value={manualBarcode}
            onChange={e => setManualBarcode(e.target.value)}
            autoComplete="off"
            className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-green-400 h-11"
          />
          <Button
            type="submit"
            disabled={!manualBarcode.trim()}
            className="h-11 px-5 bg-green-500 hover:bg-green-600 text-white font-semibold border-0"
          >
            Add
          </Button>
        </form>
      </div>
    </div>
  )
}
