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
  minLength = 6,
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
    // Only fires when the user is NOT actively typing in the search input
    const handleKeyDown = (e: KeyboardEvent) => {
      // If the focused element is our search input, skip — user is typing manually
      if (document.activeElement === inputRef.current) {
        buffer.current = ""
        return
      }

      if (e.key === "Enter") {
        const code = buffer.current.trim()
        if (code.length >= minLength) {
          e.preventDefault()
          e.stopPropagation()
          onScanRef.current(code)
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
        // Hardware scanners finish in < 100ms; reset buffer after 300ms of silence
        timer.current = setTimeout(() => { buffer.current = "" }, 300)
      }
    }

    // Method 2: Watch for rapid value changes on the input (covers IME, direct injection)
    // Only triggers when the input receives a large chunk at once (true scanner injection),
    // NOT when the user is manually typing character by character.
    const handleInputEvent = (e: Event) => {
      const input = e.target as HTMLInputElement
      if (!input || input.tagName !== "INPUT") return

      const val = input.value || ""
      const prev = lastValue.current
      lastValue.current = val

      // Only treat as scanner if value grew by minLength+ chars in a single event
      // (true scanner injection). Ignore single-char additions from manual typing.
      const added = val.length - prev.length
      if (added >= minLength) {
        const barcode = val.slice(-added).trim()
        if (barcode.length >= minLength) {
          setTimeout(() => { onScanRef.current(barcode) }, 30)
        }
      }
      // Removed the rapid-keystroke detection entirely — it was falsely triggering
      // on fast manual typing and adding wrong products to the cart.
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
