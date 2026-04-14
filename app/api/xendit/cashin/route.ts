import { NextRequest, NextResponse } from "next/server"
import { getFirebaseDb } from "@/lib/firebase/config"
import { collection, addDoc, serverTimestamp } from "firebase/firestore"

// Xendit Disbursements v2 channel codes
const CHANNEL_MAP: Record<string, { type: string; code: string }> = {
  GCASH:     { type: "EWALLET", code: "PH_GCASH" },
  MAYA:      { type: "EWALLET", code: "PH_PAYMAYA" },
  SHOPEEPAY: { type: "EWALLET", code: "PH_SHOPEE" },
  BPI:       { type: "BANK",    code: "PH_BPI" },
  UBP:       { type: "BANK",    code: "PH_UNIONBANK" },
  CHINABANK: { type: "BANK",    code: "PH_CHINABANK" },
  RCBC:      { type: "BANK",    code: "PH_RCBC" },
  CEBUANA:   { type: "OTC",     code: "PH_CEBUANA" },
  LBC:       { type: "OTC",     code: "PH_LBC" },
}

export async function POST(req: NextRequest) {
  try {
    const { amountInserted, fee, sendAmount, xenditCost, xenditVat, xenditTotal, adminFee, sellerEarning, channel, accountNumber, accountName, storeId, storeName } = await req.json()

    if (!amountInserted || !sendAmount || !channel || !accountNumber || !storeId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (amountInserted < 50 || amountInserted > 50000) {
      return NextResponse.json({ error: "Amount must be ₱50–₱50,000" }, { status: 400 })
    }

    const mapping = CHANNEL_MAP[channel]
    if (!mapping) {
      return NextResponse.json({ error: `Unsupported channel: ${channel}` }, { status: 400 })
    }

    const secretKey = process.env.XENDIT_SECRET_KEY
    if (!secretKey) {
      return NextResponse.json({ error: "Payment gateway not configured" }, { status: 500 })
    }

    const txnId = `ci_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const authHeader = `Basic ${Buffer.from(secretKey + ":").toString("base64")}`

    // ── Xendit Payouts v2 API ──
    const xenditRes = await fetch("https://api.xendit.co/v2/payouts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
        "Idempotency-key": txnId,
      },
      body: JSON.stringify({
        reference_id: txnId,
        channel_code: mapping.code,
        channel_properties: {
          account_number: accountNumber,
          account_holder_name: accountName || "Customer",
        },
        amount: sendAmount,
        currency: "PHP",
        description: `Cash-in via ${channel} - ${storeName || "Payroo POS"}`,
        receipt_notification: {
          email_to: [],
        },
      }),
    })

    const xenditText = await xenditRes.text()
    let xenditData: any
    try {
      xenditData = JSON.parse(xenditText)
    } catch {
      console.error("Xendit non-JSON response:", xenditText)
      return NextResponse.json({ error: "Payment gateway returned invalid response" }, { status: 502 })
    }

    if (!xenditRes.ok) {
      console.error("Xendit disbursement error:", JSON.stringify(xenditData, null, 2))
      return NextResponse.json({ error: xenditData.message || "Failed to send disbursement", details: xenditData.errors }, { status: 502 })
    }

    // Xendit returned 200 OK — disbursement accepted, treat as completed.
    const xenditStatus = (xenditData.status || "ACCEPTED").toUpperCase()
    console.log("Xendit raw response:", { status: xenditData.status, id: xenditData.id })

    // Save to Firestore as COMPLETED (webhook will update if it fails later)
    const db = getFirebaseDb()
    if (db) {
      await addDoc(collection(db, "cashinTransactions"), {
        txnId,
        xenditDisbursementId: xenditData.id,
        type: "disbursement",
        channel,
        channelCode: mapping.code,
        channelType: mapping.type,
        accountNumber,
        accountName: accountName || "",
        amountInserted,
        xenditCost: xenditCost ?? 0,
        xenditVat: xenditVat ?? 0,
        xenditTotal: xenditTotal ?? xenditCost ?? 0,
        adminFee: adminFee ?? 0,
        sellerEarning: sellerEarning ?? 0,
        fee,
        sendAmount,
        storeId,
        storeName: storeName || "",
        status: "COMPLETED",
        xenditRawStatus: xenditStatus,
        createdAt: serverTimestamp(),
      })
    }

    return NextResponse.json({
      txnId,
      disbursementId: xenditData.id,
      status: "COMPLETED",
    })
  } catch (err) {
    console.error("cashin disbursement error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
