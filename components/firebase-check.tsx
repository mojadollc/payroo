"use client"

import type React from "react"
import { useRouter } from "next/navigation"
import { isFirebaseConfigured } from "@/lib/firebase/config"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"

export function FirebaseCheck({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  if (!isFirebaseConfigured) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-2xl mt-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Firebase Not Configured</AlertTitle>
          <AlertDescription className="mt-2">
            <p className="mb-4">
              Your Firebase environment variables are not set up. Please configure Firebase to use this application.
            </p>
            <Button onClick={() => router.push("/setup")}>Go to Setup Guide</Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return <>{children}</>
}
