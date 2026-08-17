import { useState, useEffect } from "react"
import { getBusinessConfig, type BusinessConfig, type BusinessType } from "@/lib/business-config"
import { getStoreId } from "@/lib/store-id"

export function useBusinessConfig(): BusinessConfig {
  const [config, setConfig] = useState<BusinessConfig>(() => {
    if (typeof window === "undefined") return getBusinessConfig("retail")
    const cached = localStorage.getItem("businessType")
    return getBusinessConfig(cached ?? "retail")
  })

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const storeId = getStoreId()
        if (!storeId) return
        const res = await fetch(`/api/store-settings?storeId=${storeId}`)
        const { data } = await res.json()
        if (data?.businessType) {
          setConfig(getBusinessConfig(data.businessType))
          localStorage.setItem("businessType", data.businessType)
        }
      } catch {}
    }
    fetchConfig()

    const handler = () => fetchConfig()
    window.addEventListener("businesstype", handler)
    return () => window.removeEventListener("businesstype", handler)
  }, [])

  return config
}
