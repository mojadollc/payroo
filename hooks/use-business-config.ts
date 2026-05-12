"use client"

import { useState, useEffect } from "react"
import { getBusinessConfig, type BusinessConfig, type BusinessType } from "@/lib/business-config"
import { getStoreSettings } from "@/lib/firebase/services"

export function useBusinessConfig(): BusinessConfig {
  const [config, setConfig] = useState<BusinessConfig>(() => getBusinessConfig("retail"))

  useEffect(() => {
    // Seed from cache immediately, then confirm from Firestore
    const cached = localStorage.getItem("businessType")
    if (cached) setConfig(getBusinessConfig(cached))

    const fetchConfig = async () => {
      try {
        const s = await getStoreSettings()
        if (s?.businessType) {
          setConfig(getBusinessConfig(s.businessType))
          localStorage.setItem("businessType", s.businessType)
        }
      } catch {}
    }
    fetchConfig()

    // Re-fetch from Firestore whenever business type changes
    const handler = () => fetchConfig()
    window.addEventListener("businesstype", handler)
    return () => window.removeEventListener("businesstype", handler)
  }, [])

  return config
}
