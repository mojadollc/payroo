import { NextRequest, NextResponse } from "next/server"
import { getFirebaseDb } from "@/lib/firebase/config"
import { collection, addDoc, serverTimestamp, doc, getDoc, query, where, getDocs, orderBy, limit, deleteDoc } from "firebase/firestore"

export async function POST(req: NextRequest) {
  try {
    console.log("[create-invoice] Starting request processing")
    const body = await req.json()
    console.log("[create-invoice] Request body:", JSON.stringify(body, null, 2))
    
    const { planId, planName, planPrice, ownerName, ownerEmail, storeName, phone, businessType, referralCode } = body

    if (!planId || !planName || planPrice === undefined || planPrice === null || !ownerName || !ownerEmail || !storeName) {
      console.log("[create-invoice] Missing required fields validation failed")
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const secretKey = process.env.XENDIT_SECRET_KEY
    if (!secretKey) {
      console.log("[create-invoice] XENDIT_SECRET_KEY not found")
      return NextResponse.json({ error: "Payment gateway not configured" }, { status: 500 })
    }
    
    console.log("[create-invoice] Environment check passed, proceeding with Xendit API call")

    const db = getFirebaseDb()

    // ── Deduplication: check for existing subscriptions by email ──
    if (db) {
      const existingSnap = await getDocs(query(
        collection(db, "customerSubscriptions"),
        where("ownerEmail", "==", ownerEmail),
        orderBy("createdAt", "desc"),
        limit(5)
      ))

      for (const d of existingSnap.docs) {
        const data = d.data()

        // Block if there's already an active, non-expired subscription
        if (data.status === "active") {
          const endDate = data.endDate?.toDate?.()
          if (endDate && endDate > new Date()) {
            return NextResponse.json(
              { error: "You already have an active subscription. Please wait until it expires or contact support." },
              { status: 409 }
            )
          }
        }

        // Reuse existing pending invoice if it's for the same plan and still has a payment URL
        if (data.status === "pending" && data.planId === planId && data.xenditPaymentUrl) {
          return NextResponse.json({
            invoiceUrl: data.xenditPaymentUrl,
            invoiceId: data.xenditInvoiceId,
            externalId: data.externalId,
          })
        }

        // Clean up stale pending subscriptions for this email (different plan or no URL)
        if (data.status === "pending") {
          await deleteDoc(d.ref)
        }
      }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const externalId = String(Math.floor(100000 + Math.random() * 900000))

    // Fetch plan details from Firestore to get tier + features
    let planTier = "basic"
    let planFeatures = {}
    if (db) {
      const planSnap = await getDoc(doc(db, "subscriptionPlans", planId))
      if (planSnap.exists()) {
        planTier = planSnap.data().tier ?? "basic"
        planFeatures = planSnap.data().features ?? {}
      }
    }

    // Create Xendit invoice
    console.log("[create-invoice] Creating Xendit invoice with amount:", planPrice)
    const xenditRes = await fetch("https://api.xendit.co/v2/invoices", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(secretKey + ":").toString("base64")}`,
      },
      body: JSON.stringify({
        external_id: externalId,
        amount: planPrice,
        description: `POS Subscription — ${planName} Plan (1 month)`,
        invoice_duration: 86400,
        customer: {
          given_names: ownerName,
          email: ownerEmail,
          mobile_number: phone || undefined,
        },
        customer_notification_preference: {
          invoice_created: ["email"],
          invoice_reminder: ["email"],
          invoice_paid: ["email"],
        },
        success_redirect_url: `${appUrl}/payment/success?ext=${externalId}`,
        failure_redirect_url: `${appUrl}/payment/failed?ext=${externalId}`,
        currency: "PHP",
        items: [
          {
            name: `${planName} Plan — Monthly Subscription`,
            quantity: 1,
            price: planPrice,
            category: "Software Subscription",
          },
        ],
      }),
    })

    console.log("[create-invoice] Xendit response status:", xenditRes.status)
    if (!xenditRes.ok) {
      const err = await xenditRes.json()
      console.error("[create-invoice] Xendit error:", err)
      return NextResponse.json({ error: err.message || "Failed to create invoice" }, { status: 502 })
    }

    const invoice = await xenditRes.json()
    console.log("[create-invoice] Xendit invoice created successfully:", invoice.id)

    // Save pending subscription to Firestore
    if (db) {
      console.log("[create-invoice] Saving subscription to Firestore")
      await addDoc(collection(db, "customerSubscriptions"), {
        ownerName,
        ownerEmail,
        storeName,
        businessType: businessType || "retail",
        phone: phone || "",
        planId,
        tier: planTier,
        features: planFeatures,
        status: "pending",
        xenditInvoiceId: invoice.id,
        xenditPaymentStatus: "PENDING",
        xenditPaymentUrl: invoice.invoice_url,
        externalId,
        referralCode: referralCode || "",
        startDate: null,
        endDate: null,
        expiryReminderDate: null,
        expiryReminderSent: false,
        notes: `Awaiting payment. Invoice: ${invoice.id}`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      console.log("[create-invoice] Subscription saved to Firestore")
    }

    console.log("[create-invoice] Returning success response")
    return NextResponse.json({ invoiceUrl: invoice.invoice_url, invoiceId: invoice.id, externalId })
  } catch (err) {
    console.error("[create-invoice] Unexpected error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
