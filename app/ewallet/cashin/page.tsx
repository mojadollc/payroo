"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// Kiosk is disabled — redirect to e-wallet
export default function KioskPage() {
  const router = useRouter()
  useEffect(() => { router.replace("/ewallet") }, [router])
  return null
}
