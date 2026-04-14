import { useEffect, useRef, useCallback } from "react"

interface UseHardwareScannerOptions {
  onScan: (barcode: string) => void
  enabled?: boolean
  minLength?: number
}

/**
 * Detects USB barcode scanner input using multiple methods:
 * 1. Global keydown events (standard HID keyboard scanners)
 * 2. Input field value watching (scanners that inject text directly)
 * 3. Paste events (scanners that use clipboard)
 * 
 * Returns a ref callback to attach to the barcode input field.
 */
export function useHardwareScanner({
  onScan,
  enabled = true,
  minLength = 4,
}: UseHardwareScannerOptions) {
  const buffer = useRef("")
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onScanRef = useRef(onScan)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const lastValue = useRef("")
  const lastChangeTime = useRef(0)
  onScanRef.current = onScan

  // Attach to input element
  const setInputRef = useCallback((el: HTMLInputElement | null) => {
    inputRef.current = el
  }, [])

  useEffect(() => {
    if (!enabled) return

    // Method 1: Global keydown for standard keyboard-mode scanners
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        if (buffer.current.length >= minLength) {
          e.preventDefault()
          e.stopPropagation()
          onScanRef.current(buffer.current.trim())
          // Clear the input field too
          if (inputRef.current) {
            inputRef.current.value = ""
            inputRef.current.dispatchEvent(new Event("input", { bubbles: true }))
          }
        }
        buffer.current = ""
        if (timer.current) clearTimeout(timer.current)
        return
      }

      if (["Control", "Shift", "Alt", "Meta", "CapsLock", "Tab", "Escape",
           "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
           "Backspace", "Delete", "Home", "End", "PageUp", "PageDown",
           "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12"
          ].includes(e.key)) {
        return
      }

      if (e.key.length === 1) {
        buffer.current += e.key
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => { buffer.current = "" }, 500)
      }
    }

    // Method 2: Watch for rapid value changes on the input (covers IME, direct injection)
    const handleInputEvent = (e: Event) => {
      const input = e.target as HTMLInputElement
      if (!input || input.tagName !== "INPUT") return

      const now = Date.now()
      const val = input.value || ""
      const prev = lastValue.current
      lastValue.current = val

      // If value grew by many characters at once = scanner injection
      const added = val.length - prev.length
      if (added >= minLength) {
        const barcode = val.slice(-added).trim()
        if (barcode.length >= minLength) {
          // Small delay to let scanner finish (some add Enter after)
          setTimeout(() => {
            onScanRef.current(barcode)
          }, 50)
          return
        }
      }

      // Track rapid sequential single-char additions
      const gap = now - lastChangeTime.current
      lastChangeTime.current = now

      // If chars are coming in fast (< 80ms each) it's likely a scanner
      if (gap < 80 && val.length >= minLength) {
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => {
          // After 200ms of no more input, check if we have a barcode
          const currentVal = inputRef.current?.value || input.value || ""
          if (currentVal.length >= minLength) {
            onScanRef.current(currentVal.trim())
            // Clear input
            if (inputRef.current) {
              inputRef.current.value = ""
              inputRef.current.dispatchEvent(new Event("input", { bubbles: true }))
            }
          }
        }, 200)
      }
    }

    // Method 3: Paste events
    const handlePaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData("text")?.trim()
      if (text && text.length >= minLength && /^[a-zA-Z0-9\-_.]+$/.test(text)) {
        e.preventDefault()
        onScanRef.current(text)
      }
    }

    document.addEventListener("keydown", handleKeyDown, true)
    document.addEventListener("input", handleInputEvent, true)
    document.addEventListener("paste", handlePaste, true)

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true)
      document.removeEventListener("input", handleInputEvent, true)
      document.removeEventListener("paste", handlePaste, true)
      if (timer.current) clearTimeout(timer.current)
    }
  }, [enabled, minLength])

  return setInputRef
}
