"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { XCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

function FailedContent() {
  const params = useSearchParams()
  const ext = params.get("ext")

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <XCircle className="h-9 w-9 text-red-600" />
          </div>
          <CardTitle className="text-2xl text-red-700">Payment Failed</CardTitle>
          <CardDescription className="text-base mt-1">
            Something went wrong with your payment. Please try again.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {ext && (
            <p className="text-xs text-muted-foreground bg-muted rounded px-3 py-2 font-mono break-all">
              Reference: {ext}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Your subscription was not activated. No charges were made.
            If you believe this is an error, please contact support.
          </p>
          <div className="flex flex-col gap-2">
            <Link href="/subscription"><Button className="w-full">Try Again</Button></Link>
            <Link href="/"><Button variant="outline" className="w-full">Go to Dashboard</Button></Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function PaymentFailedPage() {
  return (
    <Suspense>
      <FailedContent />
    </Suspense>
  )
}
