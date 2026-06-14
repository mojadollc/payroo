import { NextRequest, NextResponse } from "next/server"
import { getFirebaseDb } from "@/lib/firebase/config"
import { collection, query, where, getDocs, writeBatch, doc } from "firebase/firestore"

export async function POST(req: NextRequest) {
  try {
    const { oldExternalId, ownerEmail } = await req.json()

    if (!oldExternalId && !ownerEmail) {
      return NextResponse.json({ error: "Provide oldExternalId or ownerEmail" }, { status: 400 })
    }

    const db = getFirebaseDb()
    if (!db) return NextResponse.json({ error: "DB not configured" }, { status: 500 })

    // Find subscription
    const field = ownerEmail ? "ownerEmail" : "externalId"
    const value = ownerEmail || oldExternalId
    const subSnap = await getDocs(query(collection(db, "customerSubscriptions"), where(field, "==", value)))

    if (subSnap.empty) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 })
    }

    const subDoc = subSnap.docs[0]
    const currentId = subDoc.data().externalId

    // If already a 6-digit numeric, no migration needed
    if (/^\d{6}$/.test(currentId)) {
      return NextResponse.json({ externalId: currentId, message: "Already has a friendly ID" })
    }

    // Generate new 6-digit ID
    const newId = String(Math.floor(100000 + Math.random() * 900000))

    // Update subscription + all storeUsers with old ID
    const batch = writeBatch(db)
    batch.update(doc(db, "customerSubscriptions", subDoc.id), { externalId: newId, oldExternalId: currentId })

    const usersSnap = await getDocs(query(collection(db, "storeUsers"), where("externalId", "==", currentId)))
    usersSnap.docs.forEach(u => batch.update(doc(db, "storeUsers", u.id), { externalId: newId }))

    await batch.commit()

    return NextResponse.json({ externalId: newId, oldExternalId: currentId, message: "Store ID migrated successfully" })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
