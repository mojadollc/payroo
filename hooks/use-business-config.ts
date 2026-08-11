import { useState, useEffect } from "react"
import { getBusinessConfig, type BusinessConfig, type BusinessType } from "@/lib/business-config"
import { getStoreId } from "@/lib/store-id"

export function useBusinessConfig(): BusinessConfig {
  const [config, setConfig] = useState<BusinessConfig>(() => getBusinessConfig("retail"))

  useEffect(() => {
    const cached = localStorage.getItem("businessType")
    if (cached) setConfig(getBusinessConfig(cached))

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
