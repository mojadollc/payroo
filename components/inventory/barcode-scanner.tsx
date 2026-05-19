import { useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useHardwareScanner } from "@/hooks/use-hardware-scanner"

interface BarcodeScannerProps {
  onScan: (barcode: string) => void
  onClose: () => void
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const [manualBarcode, setManualBarcode] = useState("")
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hasCamera, setHasCamera] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSupported, setIsSupported] = useState(true)
  const streamRef = useRef<MediaStream | null>(null)

  // Hardware barcode scanner support (USB OTG)
  useHardwareScanner({
    onScan: (barcode) => {
      onScan(barcode)
    },
  })

  useEffect(() => {
    let mounted = true

    const startCamera = async () => {
      try {
        setIsLoading(true)
        setError(null)

        if (typeof window !== "undefined" && !("BarcodeDetector" in window)) {
          setIsSupported(false)
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Camera API is not supported in this browser")
        }

        // Try multiple camera configurations
        const constraints = [
          { video: { facingMode: "environment" } },
          { video: { facingMode: "user" } },
          { video: true },
        ]

        let stream: MediaStream | null = null
        let lastError: Error | null = null

        for (const constraint of constraints) {
          try {
            stream = await navigator.mediaDevices.getUserMedia(constraint)
            if (stream) break
          } catch (e) {
            lastError = e as Error
            continue
          }
        }

        if (!mounted) {
          if (stream) stream.getTracks().forEach((t) => t.stop())
          return
        }

        if (!stream) {
          throw lastError || new Error("Could not access camera")
        }

        streamRef.current = stream
        setHasCamera(true)
      } catch (err) {
        console.error("[v0] Camera access error:", err)
        if (mounted) {
          setHasCamera(false)
          setError(err instanceof Error ? err.message : "Camera access failed")
        }
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    startCamera()

    return () => {
      mounted = false
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  // Attach stream to video element when it becomes available
  useEffect(() => {
    if (hasCamera && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch((e) => console.error("Video play error:", e))
    }
  }, [hasCamera])

  // Scanning logic
  useEffect(() => {
    if (!hasCamera || !videoRef.current || !isSupported) return

    const video = videoRef.current
    let intervalId: NodeJS.Timeout
    let lastScanned = ""
    let lastScanTime = 0

    // @ts-ignore - BarcodeDetector is not yet in standard TS lib
    const barcodeDetector = new window.BarcodeDetector({
      formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "code_93", "codabar", "itf", "qr_code"],
    })

    const beep = () => {
      try {
        const ctx = new AudioContext()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = 1800
        gain.gain.setValueAtTime(0.3, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.15)
      } catch {}
    }

    const scan = async () => {
      if (video.readyState !== video.HAVE_ENOUGH_DATA) return
      try {
        const barcodes = await barcodeDetector.detect(video)
        if (barcodes.length > 0) {
          const code = barcodes[0].rawValue
          const now = Date.now()
          // Debounce: ignore same barcode within 2 seconds
          if (code && (code !== lastScanned || now - lastScanTime > 2000)) {
            lastScanned = code
            lastScanTime = now
            beep()
            onScan(code)
          }
        }
      } catch (e) {
        console.error("Barcode detection error:", e)
      }
    }

    // Scan every 200ms for faster detection
    intervalId = setInterval(scan, 200)

    return () => clearInterval(intervalId)
  }, [hasCamera, isSupported, onScan])

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (manualBarcode.trim()) {
      onScan(manualBarcode.trim())
      setManualBarcode("")
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-[95vw]">
        <DialogHeader>
          <DialogTitle>Scan or Enter Barcode</DialogTitle>
          <DialogDescription>Use camera, USB barcode scanner, or type manually</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
              <p className="text-sm text-muted-foreground">Initializing camera...</p>
            </div>
          ) : hasCamera ? (
            <div className="relative bg-black rounded-lg overflow-hidden border-2 border-primary">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-auto"
              />
              <div className="absolute bottom-2 left-0 right-0 text-center pointer-events-none">
                <p className="text-xs text-primary bg-black/50 px-3 py-1 rounded inline-block">
                  {isSupported ? "Point camera at barcode" : "Camera active (Scanning not supported in this browser)"}
                </p>
              </div>
            </div>
          ) : (
            <Alert variant="destructive" className="aspect-video flex items-center justify-center">
              <div className="text-center">
                <AlertDescription className="text-sm">
                  {error || "Camera not available. Please enter the barcode manually below."}
                </AlertDescription>
              </div>
            </Alert>
          )}

          <form onSubmit={handleManualSubmit} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="manual-barcode">Enter barcode number or scan with USB scanner</Label>
              <Input
                id="manual-barcode"
                placeholder="Scan or type barcode..."
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={!manualBarcode.trim()}>
                Confirm Barcode
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
