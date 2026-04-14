import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { isFirebaseConfigured } from "@/lib/firebase/config"

export function useFirebaseCheck() {
  const router = useRouter()
  const [isConfigured, setIsConfigured] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!isFirebaseConfigured) {
      router.push("/setup")
      return
    }
    setIsConfigured(true)
    setIsLoading(false)
  }, [router])

  return { isConfigured, isLoading }
}
