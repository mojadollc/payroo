"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

export function FirebaseCheck({ children }: { children: React.ReactNode }) {
  const [healthy, setHealthy] = useState(true)

  useEffect(() => {
    fetch("/api/subscription?externalId=healthcheck")
      .then(r => setHealthy(r.status !== 500))
      .catch(() => setHealthy(false))
  }, [])

  if (!healthy) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-2xl mt-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Database Unavailable</AlertTitle>
          <AlertDescription className="mt-2">
            <p>Unable to connect to the database. Please try again in a moment or contact support.</p>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return <>{children}</>
}
