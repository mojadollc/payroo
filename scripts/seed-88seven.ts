/**
 * Seed script: Add 88 Seven Store as a customer subscriber
 *
 * Run with: npx tsx scripts/seed-88seven.ts
 */

import { initializeApp } from "firebase/app"
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore"

const firebaseConfig = {
  apiKey: "AIzaSyCCkjIavh4Ip6Zud9z6ydmpSmfGQJ5BJRA",
  authDomain: "sari-pos-88979.firebaseapp.com",
  projectId: "sari-pos-88979",
  storageBucket: "sari-pos-88979.firebasestorage.app",
  messagingSenderId: "412821814538",
  appId: "1:412821814538:web:b4cb53f58d5d54c5ef8ef3",
}

const STORE_ID = "8807"
const OWNER_PIN = "880788"
const OWNER_USERNAME = "88seven"
const OWNER_NAME = "88 Seven Store"
const OWNER_EMAIL = "88sevenstore@email.com"
const STORE_NAME = "88 Seven Store"

async function seed() {
  console.log("🔧 Initializing Firebase...")
  const app = initializeApp(firebaseConfig)
  const db = getFirestore(app)

  // ── 1. Check if 88 Seven already exists ──────────────────────────────────
  const existingSub = await getDocs(
    query(collection(db, "customerSubscriptions"), where("externalId", "==", STORE_ID))
  )
  if (!existingSub.empty) {
    console.log("⚠️  88 Seven Store subscription already exists (externalId:", STORE_ID, "). Skipping subscription creation.")
  } else {
    // ── 2. Get the Gold plan (or first available plan) ─────────────────────
    const plansSnap = await getDocs(query(collection(db, "subscriptionPlans"), orderBy("price")))
    let goldPlan = plansSnap.docs.find(d => d.data().tier === "gold")
    if (!goldPlan) goldPlan = plansSnap.docs[plansSnap.docs.length - 1]

    if (!goldPlan) {
      console.error("❌ No subscription plans found. Please create plans first via /management.")
      process.exit(1)
    }

    const planData = goldPlan.data()
    console.log(`📋 Using plan: ${planData.name} (${planData.tier}) — ₱${planData.price}/mo`)

    // ── 3. Create customer subscription ────────────────────────────────────
    const now = new Date()
    const endDate = new Date()
    endDate.setFullYear(endDate.getFullYear() + 1)

    const subRef = await addDoc(collection(db, "customerSubscriptions"), {
      ownerName: OWNER_NAME,
      ownerEmail: OWNER_EMAIL,
      storeName: STORE_NAME,
      businessType: "retail",
      phone: "",
      planId: goldPlan.id,
      tier: planData.tier,
      status: "active",
      startDate: Timestamp.fromDate(now),
      endDate: Timestamp.fromDate(endDate),
      notes: "88 Seven Store — seeded subscriber",
      features: planData.features,
      externalId: STORE_ID,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    console.log(`✅ Customer subscription created (ID: ${subRef.id})`)
  }

  // ── 4. Check if owner user already exists ────────────────────────────────
  const existingUser = await getDocs(
    query(
      collection(db, "storeUsers"),
      where("externalId", "==", STORE_ID),
      where("username", "==", OWNER_USERNAME)
    )
  )
  if (!existingUser.empty) {
    console.log("⚠️  Owner user already exists. Skipping user creation.")
  } else {
    const userRef = await addDoc(collection(db, "storeUsers"), {
      name: OWNER_NAME,
      username: OWNER_USERNAME,
      pin: OWNER_PIN,
      role: "owner",
      externalId: STORE_ID,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    console.log(`✅ Owner user created (ID: ${userRef.id})`)
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log("")
  console.log("═══════════════════════════════════════════════")
  console.log("  88 Seven Store — Login Credentials")
  console.log("═══════════════════════════════════════════════")
  console.log(`  Store ID :  ${STORE_ID}`)
  console.log(`  Username :  ${OWNER_USERNAME}`)
  console.log(`  PIN      :  ${OWNER_PIN}`)
  console.log(`  Plan     :  Gold (all features)`)
  console.log(`  Login at :  http://localhost:3000/login`)
  console.log("═══════════════════════════════════════════════")
  console.log("")

  process.exit(0)
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err)
  process.exit(1)
})
