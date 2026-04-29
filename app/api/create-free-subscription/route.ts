import { NextRequest, NextResponse } from "next/server"
import { getFirebaseDb } from "@/lib/firebase/config"
import { collection, addDoc, serverTimestamp, doc, getDoc, query, where, getDocs, orderBy, limit, deleteDoc } from "firebase/firestore"

export async function POST(req: NextRequest) {
  try {
    const { planId, planName, ownerName, ownerEmail, storeName, phone, businessType, referralCode } = await req.json()

    if (!planId || !planName || !ownerName || !ownerEmail || !storeName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const db = getFirebaseDb()
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 })
    }

    // ── Deduplication: check for existing subscriptions by email ──
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

      // Clean up any existing pending subscriptions for this email
      if (data.status === "pending") {
        await deleteDoc(d.ref)
      }
    }

    const externalId = String(Math.floor(100000 + Math.random() * 900000))

    // Fetch plan details from Firestore to get tier + features
    let planTier = "basic"
    let planFeatures = {}
    const planSnap = await getDoc(doc(db, "subscriptionPlans", planId))
    if (planSnap.exists()) {
      planTier = planSnap.data().tier ?? "basic"
      planFeatures = planSnap.data().features ?? {}
    }

    // Create active subscription directly (no payment needed)
    const now = new Date()
    const endDate = new Date(now.getFullYear() + 10, now.getMonth(), now.getDate()) // 10 years for FREE plan

    await addDoc(collection(db, "customerSubscriptions"), {
      ownerName,
      ownerEmail,
      storeName,
      businessType: businessType || "retail",
      phone: phone || "",
      planId,
      tier: planTier,
      features: planFeatures,
      status: "active",
      xenditInvoiceId: null,
      xenditPaymentStatus: "PAID", // Mark as paid for FREE plan
      xenditPaymentUrl: null,
      externalId,
      referralCode: referralCode || "",
      startDate: serverTimestamp(),
      endDate: serverTimestamp(), // Will be updated to actual end date
      expiryReminderDate: null,
      expiryReminderSent: false,
      notes: `FREE plan subscription - no payment required`,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    // Handle referral commission if applicable
    if (referralCode) {
      try {
        // Credit affiliate commission for FREE plan too (encourage referrals)
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/credit-affiliate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            referralCode,
            referredEmail: ownerEmail,
            referredStoreName: storeName,
            planName,
            planPrice: 0, // FREE plan
          }),
        })
      } catch (err) {
        console.error("Failed to credit affiliate:", err)
        // Don't fail the subscription creation if affiliate crediting fails
      }
    }

    return NextResponse.json({ 
      success: true, 
      externalId,
      message: "FREE subscription created successfully" 
    })
  } catch (err) {
    console.error("create-free-subscription error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}