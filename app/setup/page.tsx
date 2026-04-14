"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2, XCircle, Copy, ExternalLink } from "lucide-react"
import { useState } from "react"
import { isFirebaseConfigured } from "@/lib/firebase/config"

export default function SetupPage() {
  const [copied, setCopied] = useState(false)

  const envVars = [
    { key: "NEXT_PUBLIC_FIREBASE_API_KEY", value: process.env.NEXT_PUBLIC_FIREBASE_API_KEY },
    { key: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", value: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN },
    { key: "NEXT_PUBLIC_FIREBASE_PROJECT_ID", value: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID },
    { key: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", value: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET },
    { key: "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", value: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID },
    { key: "NEXT_PUBLIC_FIREBASE_APP_ID", value: process.env.NEXT_PUBLIC_FIREBASE_APP_ID },
  ]

  const copyTemplate = () => {
    const template = envVars.map((v) => `${v.key}=your_value_here`).join("\n")
    navigator.clipboard.writeText(template)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Firebase Setup</h1>
        <p className="text-muted-foreground">Configure your Firebase project to start using the POS system</p>
      </div>

      {isFirebaseConfigured ? (
        <Alert className="bg-green-50 border-green-200 mb-6">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Firebase is properly configured and ready to use!
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="bg-orange-50 border-orange-200 mb-6">
          <XCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            Firebase is not configured. Please add your environment variables to continue.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Create a Firebase Project</CardTitle>
            <CardDescription>If you don't have a Firebase project yet, create one</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Go to the Firebase Console</li>
              <li>Click "Add Project" and follow the setup wizard</li>
              <li>Enable Firestore Database in production mode</li>
              <li>Enable Storage for image uploads</li>
              <li>Enable Authentication (Email/Password method)</li>
            </ol>
            <Button variant="outline" className="w-full bg-transparent" asChild>
              <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Firebase Console
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Step 2: Get Your Firebase Configuration</CardTitle>
            <CardDescription>Find your project credentials in the Firebase Console</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>In Firebase Console, go to Project Settings (gear icon)</li>
              <li>Scroll down to "Your apps" section</li>
              <li>Click the web icon (&lt;/&gt;) to create a web app</li>
              <li>Copy the configuration values</li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Step 3: Add Environment Variables</CardTitle>
            <CardDescription>Add these variables to your project</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg font-mono text-xs space-y-1 relative">
              <Button size="sm" variant="ghost" className="absolute top-2 right-2" onClick={copyTemplate}>
                {copied ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </>
                )}
              </Button>
              {envVars.map((v) => (
                <div key={v.key}>{v.key}=your_value_here</div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              In v0, click the "Vars" button in the left sidebar to add these environment variables.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Step 4: Configure Firestore Security Rules</CardTitle>
            <CardDescription>Set up basic security rules for your database</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">In Firebase Console, go to Firestore Database → Rules and add these rules:</p>
            <div className="bg-muted p-4 rounded-lg font-mono text-xs overflow-x-auto">
              <pre>{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write for now (configure auth later)
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`}</pre>
            </div>
            <Alert>
              <AlertDescription className="text-sm">
                Note: These rules allow public access. Once you add authentication, update these rules to secure your
                data.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Step 5: Configure Storage Rules</CardTitle>
            <CardDescription>Set up basic security rules for file storage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">In Firebase Console, go to Storage → Rules and add these rules:</p>
            <div className="bg-muted p-4 rounded-lg font-mono text-xs overflow-x-auto">
              <pre>{`rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}`}</pre>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Environment Variable Status</CardTitle>
            <CardDescription>Check which variables are configured</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {envVars.map((v) => (
                <div key={v.key} className="flex items-center justify-between p-2 rounded border">
                  <span className="font-mono text-xs">{v.key}</span>
                  {v.value ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {isFirebaseConfigured && (
        <div className="mt-6 text-center">
          <Button size="lg" asChild>
            <a href="/pos">Go to POS System</a>
          </Button>
        </div>
      )}
    </div>
  )
}
