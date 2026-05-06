"use client"

import { useRef, useState, useEffect } from "react"
import * as THREE from "three"

export function Hero3DScene() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted || !containerRef.current) return

    const container = containerRef.current
    const width = container.clientWidth || 500
    const height = container.clientHeight || 550

    // ─── Renderer ───
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    renderer.shadowMap.enabled = true
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.4
    container.appendChild(renderer.domElement)

    // ─── Scene & Camera ───
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100)
    camera.position.set(0, 0, 8)

    // ─── Lighting (dramatic) ───
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
    scene.add(ambientLight)

    const keyLight = new THREE.DirectionalLight(0xffffff, 2)
    keyLight.position.set(5, 8, 10)
    keyLight.castShadow = true
    scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight(0xefbf04, 0.6)
    fillLight.position.set(-4, 2, 4)
    scene.add(fillLight)

    const blueLight = new THREE.PointLight(0x3b82f6, 1, 10)
    blueLight.position.set(0, -3, 5)
    scene.add(blueLight)

    const redLight = new THREE.PointLight(0xef4444, 0.8, 8)
    redLight.position.set(3, 3, -2)
    scene.add(redLight)

    // ─── Phone Group ───
    const phoneGroup = new THREE.Group()
    scene.add(phoneGroup)

    // Phone body
    const phoneShape = new THREE.Shape()
    const pw = 1.1, ph = 2.2, pr = 0.15
    phoneShape.moveTo(-pw + pr, -ph)
    phoneShape.lineTo(pw - pr, -ph)
    phoneShape.quadraticCurveTo(pw, -ph, pw, -ph + pr)
    phoneShape.lineTo(pw, ph - pr)
    phoneShape.quadraticCurveTo(pw, ph, pw - pr, ph)
    phoneShape.lineTo(-pw + pr, ph)
    phoneShape.quadraticCurveTo(-pw, ph, -pw, ph - pr)
    phoneShape.lineTo(-pw, -ph + pr)
    phoneShape.quadraticCurveTo(-pw, -ph, -pw + pr, -ph)

    const phoneGeo = new THREE.ExtrudeGeometry(phoneShape, {
      depth: 0.15, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 8
    })
    phoneGeo.center()
    const phoneMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, metalness: 0.9, roughness: 0.1 })
    const phoneMesh = new THREE.Mesh(phoneGeo, phoneMat)
    phoneMesh.castShadow = true
    phoneGroup.add(phoneMesh)

    // Silver frame
    const frameGeo = new THREE.ExtrudeGeometry(phoneShape, {
      depth: 0.17, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 4
    })
    frameGeo.center()
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xaaaacc, metalness: 0.95, roughness: 0.1 })
    const frameMesh = new THREE.Mesh(frameGeo, frameMat)
    frameMesh.scale.set(1.02, 1.02, 0.9)
    phoneGroup.add(frameMesh)

    // ─── Screen UI Texture (POS Interface) ───
    const uiCanvas = document.createElement("canvas")
    uiCanvas.width = 512
    uiCanvas.height = 1024
    const ctx = uiCanvas.getContext("2d")!

    // Background
    ctx.fillStyle = "#f8fafc"
    ctx.fillRect(0, 0, 512, 1024)

    // Status bar
    ctx.fillStyle = "#1a1a2e"
    ctx.fillRect(0, 0, 512, 36)
    ctx.fillStyle = "#ffffff"
    ctx.font = "bold 12px Arial"
    ctx.textAlign = "left"
    ctx.fillText("9:41", 20, 24)
    ctx.textAlign = "right"
    ctx.fillText("100%", 480, 24)
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(420 + i * 7, 26 - (i + 1) * 4, 5, (i + 1) * 4)
    }

    // Header with Payroo branding
    const headerGrad = ctx.createLinearGradient(0, 36, 512, 116)
    headerGrad.addColorStop(0, "#EFBF04")
    headerGrad.addColorStop(1, "#F59E0B")
    ctx.fillStyle = headerGrad
    ctx.fillRect(0, 36, 512, 80)
    // Logo circle
    ctx.fillStyle = "#ffffff"
    ctx.beginPath(); ctx.arc(50, 76, 20, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = "#EFBF04"
    ctx.font = "bold 20px Arial"
    ctx.textAlign = "center"
    ctx.fillText("P", 50, 83)
    // Brand name
    ctx.fillStyle = "#1a1a1a"
    ctx.font = "bold 24px Arial"
    ctx.textAlign = "left"
    ctx.fillText("Payroo POS", 80, 82)
    // Scan button
    ctx.fillStyle = "rgba(0,0,0,0.15)"
    roundRect(ctx, 410, 58, 80, 36, 10); ctx.fill()
    ctx.fillStyle = "#1a1a1a"
    ctx.font = "bold 13px Arial"
    ctx.textAlign = "center"
    ctx.fillText("SCAN", 450, 80)

    // ─── Barcode Scanner Section ───
    ctx.fillStyle = "#ffffff"
    roundRect(ctx, 16, 126, 480, 95, 12); ctx.fill()
    ctx.strokeStyle = "#e2e8f0"
    ctx.lineWidth = 1
    roundRect(ctx, 16, 126, 480, 95, 12); ctx.stroke()
    // Scanner viewport (dark)
    ctx.fillStyle = "#0f172a"
    roundRect(ctx, 28, 136, 110, 72, 8); ctx.fill()
    // Crosshair
    ctx.strokeStyle = "#EFBF04"
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(55, 172); ctx.lineTo(110, 172); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(83, 148); ctx.lineTo(83, 196); ctx.stroke()
    // Green corner brackets
    ctx.strokeStyle = "#22c55e"
    ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(36, 148); ctx.lineTo(36, 140); ctx.lineTo(48, 140); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(120, 148); ctx.lineTo(130, 148); ctx.lineTo(130, 140); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(36, 196); ctx.lineTo(36, 204); ctx.lineTo(48, 204); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(120, 196); ctx.lineTo(130, 196); ctx.lineTo(130, 204); ctx.stroke()
    // Red scan line
    ctx.strokeStyle = "#ef4444"
    ctx.lineWidth = 2
    ctx.setLineDash([4, 3])
    ctx.beginPath(); ctx.moveTo(36, 172); ctx.lineTo(130, 172); ctx.stroke()
    ctx.setLineDash([])
    // Scanner text
    ctx.fillStyle = "#1e293b"
    ctx.font = "bold 14px Arial"
    ctx.textAlign = "left"
    ctx.fillText("Scan Barcode", 155, 158)
    ctx.fillStyle = "#64748b"
    ctx.font = "12px Arial"
    ctx.fillText("Point camera at barcode", 155, 178)
    ctx.fillText("or tap to enter manually", 155, 196)

    // ─── Cart Items ───
    ctx.fillStyle = "#1e293b"
    ctx.font = "bold 15px Arial"
    ctx.textAlign = "left"
    ctx.fillText("Cart (5 items)", 24, 245)
    ctx.fillStyle = "#ef4444"
    ctx.font = "12px Arial"
    ctx.textAlign = "right"
    ctx.fillText("Clear", 488, 245)

    const items = [
      { name: "Coca-Cola 1.5L", code: "4800100123456", qty: 2, price: 85, color: "#dc2626" },
      { name: "Lucky Me Pancit Canton", code: "4800024512345", qty: 3, price: 12, color: "#f59e0b" },
      { name: "Kopiko Brown 3in1", code: "4800361234567", qty: 5, price: 8, color: "#7c3aed" },
      { name: "Milo Active Go 22g", code: "4800361198765", qty: 2, price: 9, color: "#059669" },
      { name: "Argentina Corned Beef", code: "4800092112345", qty: 1, price: 52, color: "#1e40af" },
    ]

    items.forEach((item, i) => {
      const y = 258 + i * 72
      // Card bg
      ctx.fillStyle = "#ffffff"
      roundRect(ctx, 16, y, 480, 65, 8); ctx.fill()
      ctx.strokeStyle = "#f1f5f9"
      ctx.lineWidth = 1
      roundRect(ctx, 16, y, 480, 65, 8); ctx.stroke()
      // Color bar
      ctx.fillStyle = item.color
      ctx.fillRect(16, y, 4, 65)
      // Product circle
      ctx.fillStyle = item.color + "22"
      ctx.beginPath(); ctx.arc(48, y + 32, 18, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = item.color
      ctx.beginPath(); ctx.arc(48, y + 32, 12, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = "#ffffff"
      ctx.font = "bold 11px Arial"
      ctx.textAlign = "center"
      ctx.fillText(item.qty.toString(), 48, y + 36)
      // Name
      ctx.fillStyle = "#1e293b"
      ctx.font = "bold 12px Arial"
      ctx.textAlign = "left"
      ctx.fillText(item.name, 75, y + 24)
      // Barcode
      ctx.fillStyle = "#94a3b8"
      ctx.font = "9px monospace"
      ctx.fillText(item.code, 75, y + 40)
      // Qty buttons
      ctx.fillStyle = "#f1f5f9"
      roundRect(ctx, 75, y + 46, 18, 14, 3); ctx.fill()
      roundRect(ctx, 112, y + 46, 18, 14, 3); ctx.fill()
      ctx.fillStyle = "#475569"
      ctx.font = "bold 12px Arial"
      ctx.textAlign = "center"
      ctx.fillText("-", 84, y + 57)
      ctx.fillText("+", 121, y + 57)
      ctx.fillStyle = "#1e293b"
      ctx.font = "10px Arial"
      ctx.fillText("x" + item.qty, 100, y + 57)
      // Price
      ctx.fillStyle = "#1e293b"
      ctx.font = "bold 14px Arial"
      ctx.textAlign = "right"
      ctx.fillText("\u20B1" + (item.price * item.qty), 484, y + 28)
      ctx.fillStyle = "#94a3b8"
      ctx.font = "10px Arial"
      ctx.fillText("\u20B1" + item.price + " ea", 484, y + 44)
    })

    // ─── Order Summary ───
    const sy = 625
    ctx.fillStyle = "#ffffff"
    roundRect(ctx, 16, sy, 480, 80, 10); ctx.fill()
    ctx.strokeStyle = "#e2e8f0"
    ctx.lineWidth = 1
    roundRect(ctx, 16, sy, 480, 80, 10); ctx.stroke()
    ctx.fillStyle = "#64748b"
    ctx.font = "12px Arial"
    ctx.textAlign = "left"
    ctx.fillText("Subtotal (13 items)", 32, sy + 22)
    ctx.textAlign = "right"
    ctx.fillStyle = "#1e293b"
    ctx.fillText("\u20B1348.00", 480, sy + 22)
    ctx.textAlign = "left"
    ctx.fillStyle = "#64748b"
    ctx.fillText("Loyalty Discount", 32, sy + 42)
    ctx.textAlign = "right"
    ctx.fillStyle = "#059669"
    ctx.fillText("-\u20B110.00", 480, sy + 42)
    // Divider
    ctx.strokeStyle = "#e2e8f0"
    ctx.beginPath(); ctx.moveTo(32, sy + 52); ctx.lineTo(480, sy + 52); ctx.stroke()
    ctx.fillStyle = "#1e293b"
    ctx.font = "bold 16px Arial"
    ctx.textAlign = "left"
    ctx.fillText("TOTAL", 32, sy + 72)
    ctx.fillStyle = "#EFBF04"
    ctx.font = "bold 20px Arial"
    ctx.textAlign = "right"
    ctx.fillText("\u20B1338.00", 480, sy + 72)

    // ─── Checkout Button ───
    const btnGrad = ctx.createLinearGradient(16, 720, 496, 720)
    btnGrad.addColorStop(0, "#059669")
    btnGrad.addColorStop(1, "#10b981")
    ctx.fillStyle = btnGrad
    roundRect(ctx, 16, 718, 480, 55, 12); ctx.fill()
    ctx.fillStyle = "#ffffff"
    ctx.font = "bold 18px Arial"
    ctx.textAlign = "center"
    ctx.fillText("Charge \u20B1338.00", 256, 751)

    // ─── Payment Methods ───
    const methods = ["Cash", "GCash", "Maya", "Card"]
    const methodColors = ["#059669", "#007bff", "#7c3aed", "#1e293b"]
    methods.forEach((m, i) => {
      ctx.fillStyle = "#ffffff"
      roundRect(ctx, 16 + i * 122, 786, 114, 28, 6); ctx.fill()
      ctx.strokeStyle = methodColors[i]
      ctx.lineWidth = 1.5
      roundRect(ctx, 16 + i * 122, 786, 114, 28, 6); ctx.stroke()
      ctx.fillStyle = methodColors[i]
      ctx.font = "bold 11px Arial"
      ctx.textAlign = "center"
      ctx.fillText(m, 73 + i * 122, 804)
    })

    // ─── Bottom Nav ───
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 830, 512, 70)
    ctx.strokeStyle = "#e2e8f0"
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, 830); ctx.lineTo(512, 830); ctx.stroke()
    const navLabels = ["POS", "Stock", "Sales", "Wallet", "More"]
    const navActive = [true, false, false, false, false]
    navLabels.forEach((label, i) => {
      const nx = 51 + i * 102
      // Active indicator dot
      if (navActive[i]) {
        ctx.fillStyle = "#EFBF04"
        ctx.beginPath(); ctx.arc(nx, 845, 3, 0, Math.PI * 2); ctx.fill()
      }
      ctx.fillStyle = navActive[i] ? "#EFBF04" : "#94a3b8"
      ctx.font = navActive[i] ? "bold 12px Arial" : "12px Arial"
      ctx.textAlign = "center"
      ctx.fillText(label, nx, 870)
    })

    // Home indicator
    ctx.fillStyle = "#d1d5db"
    roundRect(ctx, 190, 890, 132, 4, 2); ctx.fill()

    const uiTexture = new THREE.CanvasTexture(uiCanvas)
    uiTexture.minFilter = THREE.LinearFilter
    uiTexture.magFilter = THREE.LinearFilter
    uiTexture.colorSpace = THREE.SRGBColorSpace

    // Screen mesh (in front of phone)
    const screenGeo = new THREE.PlaneGeometry(1.95, 3.9)
    const screenMat = new THREE.MeshBasicMaterial({ map: uiTexture })
    const screenMesh = new THREE.Mesh(screenGeo, screenMat)
    screenMesh.position.z = 0.11
    phoneGroup.add(screenMesh)

    // ─── Back of Phone: "PAYROO MOBILE" branding ───
    const backCanvas = document.createElement("canvas")
    backCanvas.width = 512
    backCanvas.height = 1024
    const bCtx = backCanvas.getContext("2d")!
    // Dark background matching phone body
    bCtx.fillStyle = "#1a1a2e"
    bCtx.fillRect(0, 0, 512, 1024)
    // Camera bump
    bCtx.fillStyle = "#111122"
    roundRect(bCtx, 30, 40, 120, 120, 20); bCtx.fill()
    bCtx.fillStyle = "#0a0a15"
    bCtx.beginPath(); bCtx.arc(70, 80, 22, 0, Math.PI * 2); bCtx.fill()
    bCtx.fillStyle = "#1e293b"
    bCtx.beginPath(); bCtx.arc(70, 80, 14, 0, Math.PI * 2); bCtx.fill()
    bCtx.fillStyle = "#3b82f6"
    bCtx.beginPath(); bCtx.arc(70, 80, 5, 0, Math.PI * 2); bCtx.fill()
    bCtx.fillStyle = "#0a0a15"
    bCtx.beginPath(); bCtx.arc(120, 80, 16, 0, Math.PI * 2); bCtx.fill()
    bCtx.fillStyle = "#1e293b"
    bCtx.beginPath(); bCtx.arc(120, 80, 10, 0, Math.PI * 2); bCtx.fill()
    // Flash
    bCtx.fillStyle = "#fbbf24"
    bCtx.beginPath(); bCtx.arc(70, 130, 6, 0, Math.PI * 2); bCtx.fill()
    // Logo circle (center)
    bCtx.fillStyle = "#EFBF04"
    bCtx.beginPath(); bCtx.arc(256, 420, 50, 0, Math.PI * 2); bCtx.fill()
    bCtx.fillStyle = "#1a1a2e"
    bCtx.font = "bold 50px Arial"
    bCtx.textAlign = "center"
    bCtx.textBaseline = "middle"
    bCtx.fillText("P", 256, 423)
    // Brand text
    bCtx.fillStyle = "#EFBF04"
    bCtx.font = "bold 48px Arial"
    bCtx.textBaseline = "alphabetic"
    bCtx.fillText("PAYROO", 256, 520)
    bCtx.font = "bold 32px Arial"
    bCtx.fillText("MOBILE", 256, 565)
    // Subtle tagline
    bCtx.fillStyle = "rgba(239, 191, 4, 0.5)"
    bCtx.font = "16px Arial"
    bCtx.fillText("Smart POS for Filipino Stores", 256, 610)
    // Bottom regulatory text
    bCtx.fillStyle = "rgba(255,255,255,0.2)"
    bCtx.font = "10px Arial"
    bCtx.fillText("Model: PR-2025 | IMEI: XXXXXXXXXXXXXXX", 256, 900)
    bCtx.fillText("Made by MOJADOO | payroo.xyz", 256, 920)

    const backTexture = new THREE.CanvasTexture(backCanvas)
    backTexture.minFilter = THREE.LinearFilter
    backTexture.magFilter = THREE.LinearFilter
    backTexture.colorSpace = THREE.SRGBColorSpace
    const backGeo = new THREE.PlaneGeometry(1.95, 3.9)
    const backMat = new THREE.MeshBasicMaterial({ map: backTexture })
    const backMesh = new THREE.Mesh(backGeo, backMat)
    backMesh.position.z = -0.11
    backMesh.rotation.y = Math.PI
    phoneGroup.add(backMesh)

    // ─── Orbiting POS-related Icons with Trails ───
    const orbitItems: { group: THREE.Group; trail: THREE.Mesh[]; radius: number; speed: number; yOffset: number; phase: number }[] = []

    function drawCartIcon(cx: CanvasRenderingContext2D) {
      cx.strokeStyle = "#16a34a"; cx.lineWidth = 6; cx.lineCap = "round"; cx.lineJoin = "round"
      cx.beginPath(); cx.moveTo(30, 35); cx.lineTo(40, 35); cx.lineTo(50, 80); cx.lineTo(95, 80); cx.lineTo(100, 45); cx.lineTo(48, 45); cx.stroke()
      cx.fillStyle = "#16a34a"
      cx.beginPath(); cx.arc(58, 95, 7, 0, Math.PI * 2); cx.fill()
      cx.beginPath(); cx.arc(88, 95, 7, 0, Math.PI * 2); cx.fill()
    }

    function drawMoneyIcon(cx: CanvasRenderingContext2D) {
      cx.fillStyle = "#16a34a"
      roundRect(cx, 25, 35, 78, 55, 8); cx.fill()
      cx.fillStyle = "#22c55e"
      roundRect(cx, 30, 40, 68, 45, 6); cx.fill()
      cx.fillStyle = "#ffffff"
      cx.font = "bold 32px Arial"; cx.textAlign = "center"; cx.textBaseline = "middle"
      cx.fillText("\u20B1", 64, 64)
    }

    function drawBarcodeIcon(cx: CanvasRenderingContext2D) {
      cx.fillStyle = "#1e293b"
      const bars = [28, 34, 42, 48, 52, 60, 66, 72, 78, 84, 90, 96]
      bars.forEach((x, i) => {
        const w = i % 3 === 0 ? 4 : 2
        cx.fillRect(x, 30, w, 55)
      })
      cx.fillStyle = "#64748b"
      cx.font = "10px monospace"; cx.textAlign = "center"; cx.textBaseline = "middle"
      cx.fillText("4800123456", 64, 96)
    }

    function drawBagIcon(cx: CanvasRenderingContext2D) {
      cx.fillStyle = "#ec4899"
      cx.beginPath(); cx.moveTo(35, 45); cx.lineTo(93, 45); cx.lineTo(88, 100); cx.lineTo(40, 100); cx.closePath(); cx.fill()
      cx.strokeStyle = "#be185d"; cx.lineWidth = 4; cx.lineCap = "round"
      cx.beginPath(); cx.arc(64, 45, 18, Math.PI, 0, false); cx.stroke()
      cx.fillStyle = "#ffffff"
      cx.beginPath(); cx.arc(64, 68, 8, 0, Math.PI * 2); cx.fill()
    }

    function drawReceiptIcon(cx: CanvasRenderingContext2D) {
      cx.fillStyle = "#ffffff"
      roundRect(cx, 35, 22, 58, 84, 4); cx.fill()
      cx.strokeStyle = "#94a3b8"; cx.lineWidth = 2
      roundRect(cx, 35, 22, 58, 84, 4); cx.stroke()
      cx.fillStyle = "#cbd5e1"
      cx.fillRect(44, 36, 40, 4)
      cx.fillRect(44, 48, 30, 4)
      cx.fillRect(44, 60, 35, 4)
      cx.fillRect(44, 72, 25, 4)
      cx.fillStyle = "#22c55e"
      cx.fillRect(44, 86, 40, 6)
    }

    function drawCoinIcon(cx: CanvasRenderingContext2D) {
      cx.fillStyle = "#eab308"
      cx.beginPath(); cx.arc(64, 64, 32, 0, Math.PI * 2); cx.fill()
      cx.fillStyle = "#ca8a04"
      cx.beginPath(); cx.arc(64, 64, 26, 0, Math.PI * 2); cx.fill()
      cx.fillStyle = "#fef08a"
      cx.font = "bold 28px Arial"; cx.textAlign = "center"; cx.textBaseline = "middle"
      cx.fillText("\u20B1", 64, 66)
    }

    function drawCardIcon(cx: CanvasRenderingContext2D) {
      cx.fillStyle = "#3b82f6"
      roundRect(cx, 24, 34, 80, 55, 8); cx.fill()
      cx.fillStyle = "#1d4ed8"
      cx.fillRect(24, 48, 80, 14)
      cx.fillStyle = "#fbbf24"
      roundRect(cx, 32, 70, 18, 12, 3); cx.fill()
      cx.fillStyle = "#93c5fd"
      cx.fillRect(56, 74, 40, 4)
      cx.fillRect(56, 82, 28, 3)
    }

    const iconDrawers = [drawCartIcon, drawMoneyIcon, drawBarcodeIcon, drawBagIcon, drawReceiptIcon, drawCoinIcon, drawCardIcon]
    const iconBgColors = ["#dcfce7", "#fef3c7", "#e0e7ff", "#fce7f3", "#f1f5f9", "#fef9c3", "#dbeafe"]
    const iconTrailColors = [0x22c55e, 0xf59e0b, 0x6366f1, 0xec4899, 0x64748b, 0xeab308, 0x3b82f6]
    const iconOrbitData = [
      { radius: 2.8, speed: 1.0, yOffset: 0.5, phase: 0, size: 0.25 },
      { radius: 3.2, speed: 0.8, yOffset: -0.4, phase: Math.PI * 0.5, size: 0.23 },
      { radius: 2.5, speed: 1.3, yOffset: 0.9, phase: Math.PI, size: 0.22 },
      { radius: 3.5, speed: 0.65, yOffset: -0.8, phase: Math.PI * 1.3, size: 0.24 },
      { radius: 2.2, speed: 1.5, yOffset: 1.0, phase: Math.PI * 1.7, size: 0.2 },
      { radius: 3.0, speed: 0.9, yOffset: 0.1, phase: Math.PI * 0.8, size: 0.22 },
      { radius: 2.6, speed: 1.1, yOffset: -1.0, phase: Math.PI * 1.5, size: 0.22 },
    ]

    iconDrawers.forEach((drawFn, i) => {
      const c = document.createElement("canvas")
      c.width = 128; c.height = 128
      const cx = c.getContext("2d")!
      // Solid background (no transparency)
      cx.fillStyle = iconBgColors[i]
      cx.fillRect(0, 0, 128, 128)
      // Colored circle fill
      cx.fillStyle = iconBgColors[i]
      cx.beginPath(); cx.arc(64, 64, 62, 0, Math.PI * 2); cx.fill()
      // Border
      cx.strokeStyle = `#${iconTrailColors[i].toString(16).padStart(6, "0")}`
      cx.lineWidth = 4
      cx.beginPath(); cx.arc(64, 64, 60, 0, Math.PI * 2); cx.stroke()
      // Draw icon
      drawFn(cx)

      const tex = new THREE.CanvasTexture(c)
      tex.minFilter = THREE.LinearFilter
      tex.magFilter = THREE.LinearFilter
      tex.colorSpace = THREE.SRGBColorSpace

      const data = iconOrbitData[i]
      const group = new THREE.Group()

      // 3D box shape so it's visible from all angles
      const boxGeo = new THREE.BoxGeometry(data.size * 2, data.size * 2, data.size * 0.3)
      const boxMats = [
        new THREE.MeshBasicMaterial({ color: iconTrailColors[i] }), // right
        new THREE.MeshBasicMaterial({ color: iconTrailColors[i] }), // left
        new THREE.MeshBasicMaterial({ color: iconTrailColors[i] }), // top
        new THREE.MeshBasicMaterial({ color: iconTrailColors[i] }), // bottom
        new THREE.MeshBasicMaterial({ map: tex }), // front
        new THREE.MeshBasicMaterial({ map: tex }), // back
      ]
      const boxMesh = new THREE.Mesh(boxGeo, boxMats)
      group.add(boxMesh)

      scene.add(group)

      // Trail spheres - solid colors, no transparency
      const trail: THREE.Mesh[] = []
      for (let j = 0; j < 6; j++) {
        const tGeo = new THREE.SphereGeometry(data.size * (1 - j * 0.12) * 0.4, 8, 8)
        const tMat = new THREE.MeshBasicMaterial({ color: iconTrailColors[i] })
        const tMesh = new THREE.Mesh(tGeo, tMat)
        tMesh.visible = false
        scene.add(tMesh)
        trail.push(tMesh)
      }

      orbitItems.push({ group, trail, radius: data.radius, speed: data.speed, yOffset: data.yOffset, phase: data.phase })
    })

    // ─── Particles ───
    const particleCount = 80
    const pPositions = new Float32Array(particleCount * 3)
    for (let i = 0; i < particleCount; i++) {
      pPositions[i * 3] = (Math.random() - 0.5) * 12
      pPositions[i * 3 + 1] = (Math.random() - 0.5) * 10
      pPositions[i * 3 + 2] = (Math.random() - 0.5) * 8 - 2
    }
    const pGeo = new THREE.BufferGeometry()
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPositions, 3))
    const pMat = new THREE.PointsMaterial({ color: 0xefbf04, size: 0.05, transparent: true, opacity: 0.5 })
    const points = new THREE.Points(pGeo, pMat)
    scene.add(points)

    // ─── Background glow sphere ───
    const glowGeo = new THREE.SphereGeometry(1.5, 32, 32)
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xefbf04, transparent: true, opacity: 0.08 })
    const glowMesh = new THREE.Mesh(glowGeo, glowMat)
    glowMesh.position.z = -3
    scene.add(glowMesh)

    // ─── Interaction State (drag to rotate, scroll to zoom) ───
    let isDragging = false
    let prevMouseX = 0, prevMouseY = 0
    let targetRotY = 0, targetRotX = 0
    let currentRotY = 0, currentRotX = 0
    let targetZoom = 8, currentZoom = 8
    let autoRotateSpeed = 0.3
    let velocityX = 0, velocityY = 0

    function onPointerDown(e: PointerEvent) {
      isDragging = true
      prevMouseX = e.clientX
      prevMouseY = e.clientY
      container.style.cursor = "grabbing"
    }

    function onPointerMove(e: PointerEvent) {
      if (!isDragging) return
      const dx = e.clientX - prevMouseX
      const dy = e.clientY - prevMouseY
      velocityX = dx * 0.008
      velocityY = dy * 0.005
      targetRotY += velocityX
      targetRotX += velocityY
      // Clamp vertical rotation
      targetRotX = Math.max(-0.8, Math.min(0.8, targetRotX))
      prevMouseX = e.clientX
      prevMouseY = e.clientY
    }

    function onPointerUp() {
      isDragging = false
      container.style.cursor = "grab"
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault()
      targetZoom += e.deltaY * 0.005
      targetZoom = Math.max(5, Math.min(12, targetZoom))
    }

    container.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", onPointerUp)
    container.addEventListener("wheel", onWheel, { passive: false })

    // ─── Animation ───
    let animId: number
    let time = 0
    let lastTime = performance.now()
    const trailHistory: THREE.Vector3[][] = orbitItems.map(() => [])

    function animate() {
      animId = requestAnimationFrame(animate)
      const now = performance.now()
      const delta = (now - lastTime) / 1000
      lastTime = now
      time += delta

      // Auto-rotate when not dragging
      if (!isDragging) {
        targetRotY += delta * autoRotateSpeed
        // Decay velocity for inertia
        velocityX *= 0.95
        velocityY *= 0.95
        targetRotY += velocityX
        targetRotX += velocityY
        targetRotX = Math.max(-0.8, Math.min(0.8, targetRotX))
      }

      // Smooth interpolation
      currentRotY += (targetRotY - currentRotY) * 0.05
      currentRotX += (targetRotX - currentRotX) * 0.05
      currentZoom += (targetZoom - currentZoom) * 0.05

      // Apply to camera (orbit around origin)
      camera.position.x = Math.sin(currentRotY) * currentZoom
      camera.position.z = Math.cos(currentRotY) * currentZoom
      camera.position.y = currentRotX * 3
      camera.lookAt(0, 0, 0)

      // Phone slow spin (shows front and back) + float
      phoneGroup.position.y = Math.sin(time * 0.8) * 0.08
      phoneGroup.rotation.y = time * 0.4
      phoneGroup.rotation.x = Math.cos(time * 0.2) * 0.03

      // Orbit objects - icons always face camera
      orbitItems.forEach((item, idx) => {
        const angle = time * item.speed + item.phase
        const x = Math.cos(angle) * item.radius
        const z = Math.sin(angle) * item.radius * 0.5
        const y = item.yOffset + Math.sin(time * 1.2 + item.phase) * 0.3
        item.group.position.set(x, y, z)
        // Billboard: always face camera
        item.group.lookAt(camera.position)

        // Update trail
        const history = trailHistory[idx]
        history.unshift(new THREE.Vector3(x, y, z))
        if (history.length > 8) history.pop()
        item.trail.forEach((tMesh, ti) => {
          if (history[ti + 1]) {
            tMesh.position.copy(history[ti + 1])
            tMesh.visible = true
          }
        })
      })

      // Particles drift
      points.rotation.y = time * 0.02

      // Glow pulse
      const s = 1 + Math.sin(time * 2) * 0.1
      glowMesh.scale.set(s, s, s)

      renderer.render(scene, camera)
    }
    animate()

    // ─── Resize ───
    function onResize() {
      const w = container.clientWidth
      const h = container.clientHeight
      if (w && h) {
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      }
    }
    window.addEventListener("resize", onResize)

    // ─── Cleanup ───
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener("resize", onResize)
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", onPointerUp)
      container.removeEventListener("pointerdown", onPointerDown)
      container.removeEventListener("wheel", onWheel)
      renderer.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [mounted])

  if (!mounted) return null

  return <div ref={containerRef} style={{ width: "100%", height: "100%", minHeight: "500px", cursor: "grab" }} />
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
