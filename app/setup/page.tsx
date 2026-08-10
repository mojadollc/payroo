"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function SetupPage() {
  return (
    <div className="container mx-auto p-4 md:p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">System Status</h1>
        <p className="text-muted-foreground">Payroo POS is running on PostgreSQL</p>
      </div>

      <Alert className="bg-green-50 border-green-200 mb-6">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          System is fully configured and running on PostgreSQL. No additional setup required.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Database</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between p-2 rounded border">
            <span>Database</span>
            <span className="text-green-600 font-medium flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> PostgreSQL</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded border">
            <span>Auth</span>
            <span className="text-green-600 font-medium flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> Prisma</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded border">
            <span>Storage</span>
            <span className="text-green-600 font-medium flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> Local (base64)</span>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 text-center">
        <Button size="lg" asChild>
          <a href="/pos">Go to POS System</a>
        </Button>
      </div>
    </div>
  )
}
