import { NextRequest, NextResponse } from "next/server"
import { getFirebaseDb } from "@/lib/firebase/config"
import { collection, query, where, getDocs, updateDoc } from "firebase/firestore"

const WEBHOOK_TOKEN = process.env.XENDIT_WEBHOOK_TOKEN || ""

export async function POST(req: NextRequest) {
  try {
    // Verify webhook token
    const token = req.headers.get("x-callback-token")
    if (token !== WEBHOOK_TOKEN) {
      console.error("Xendit webhook: invalid token")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { reference_id, status, id, failure_code } = body

    console.log("Xendit webhook received:", { reference_id, status, id, failure_code })

    if (!reference_id || !status) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    }

    // Map Xendit status to internal status
    const upperStatus = status.toUpperCase()
    const normalizedStatus =
      ["COMPLETED", "SUCCEEDED", "SUCCESS", "SETTLED", "PAID"].includes(upperStatus) ? "COMPLETED" :
      ["FAILED", "CANCELLED", "VOIDED", "REJECTED", "EXPIRED"].includes(upperStatus) ? "FAILED" :
      "PENDING"

    // Update Firestore transaction
    const db = getFirebaseDb()
    if (db) {
      const snap = await getDocs(query(collection(db, "cashinTransactions"), where("txnId", "==", reference_id)))
      if (!snap.empty) {
        const updateData: Record<string, any> = {
          status: normalizedStatus,
          xenditRawStatus: upperStatus,
          webhookReceivedAt: new Date(),
        }
        if (failure_code) updateData.failureCode = failure_code
        await updateDoc(snap.docs[0].ref, updateData)
        console.log(`Xendit webhook: updated ${reference_id} -> ${normalizedStatus}`)
      } else {
        console.warn(`Xendit webhook: txn ${reference_id} not found in Firestore`)
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error("Xendit webhook error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
