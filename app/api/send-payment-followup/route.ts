import { NextRequest, NextResponse } from "next/server"
import nodemailer from "nodemailer"

export async function POST(req: NextRequest) {
  try {
    const { ownerName, ownerEmail, storeName, planName, planPrice, paymentUrl, appUrl: reqAppUrl } = await req.json()

    if (!ownerEmail || !ownerName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const siteUrl = reqAppUrl || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

    const subject = `💳 Complete your Payroo POS payment — ${storeName}`

    const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;background:#f4f4f5}
  .wrap{max-width:560px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
  .hero{background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);color:#fff;padding:36px 30px;text-align:center}
  .hero h1{margin:0 0 6px;font-size:24px}.hero p{margin:0;opacity:.9;font-size:14px}
  .body{padding:30px}
  .highlight-box{background:#eff6ff;border:2px solid #93c5fd;border-radius:10px;padding:20px;margin:20px 0;text-align:center}
  .highlight-text{font-size:18px;font-weight:700;color:#1d4ed8}
  .highlight-sub{font-size:13px;color:#1e40af;margin-top:4px}
  .info-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px}
  .info-row:last-child{border:none}
  .info-label{color:#64748b}.info-value{font-weight:600;color:#1e293b}
  .btn{display:inline-block;background:#EFBF04;color:#1e293b;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;margin:20px 0}
  .note{background:#fefce8;border:1px solid #fde047;border-radius:8px;padding:12px 16px;font-size:12px;color:#854d0e;margin:16px 0}
  .footer{text-align:center;padding:20px 30px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8}
</style></head>
<body>
  <div class="wrap">
    <div class="hero">
      <h1>💳 Payment Reminder</h1>
      <p>Your Payroo POS subscription is waiting for payment</p>
    </div>
    <div class="body">
      <p>Hi <strong>${ownerName}</strong>,</p>
      <p>We noticed you started subscribing to Payroo POS for <strong>${storeName}</strong> but haven't completed the payment yet. Your store is ready to go — just one step left!</p>
      <div class="highlight-box">
        <div class="highlight-text">₱${planPrice}/month</div>
        <div class="highlight-sub">${planName} Plan — Pending Payment</div>
      </div>
      <div style="margin:20px 0">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:#1e293b">Subscription Details</div>
        <div class="info-row"><span class="info-label">Store Name</span><span class="info-value">${storeName}</span></div>
        <div class="info-row"><span class="info-label">Plan</span><span class="info-value">${planName} — ₱${planPrice}/month</span></div>
        <div class="info-row"><span class="info-label">Status</span><span class="info-value" style="color:#d97706">⏳ Awaiting Payment</span></div>
      </div>
      <div class="note">⏰ <strong>Don't miss out!</strong> Complete your payment now to activate your store and start managing your business with Payroo POS.</div>
      <div style="text-align:center">
        <a href="${paymentUrl || siteUrl + "/subscription"}" class="btn">Complete Payment →</a>
      </div>
      <p style="font-size:12px;color:#64748b;text-align:center;margin-top:8px">
        Or subscribe again: <a href="${siteUrl}/subscription" style="color:#EFBF04">${siteUrl}/subscription</a>
      </p>
    </div>
    <div class="footer">
      <p>© 2024 Payroo POS · Built by MOJADOO</p>
      <p>Questions? Contact support@payroo.xyz</p>
    </div>
  </div>
</body>
</html>`

    const smtpUser = process.env.SMTP_USER
    const smtpPass = process.env.SMTP_PASS?.replace(/\s+/g, "") // strip spaces from App Password

    if (smtpUser && smtpPass) {
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: smtpUser, pass: smtpPass },
        tls: { rejectUnauthorized: false },
      })
      await transporter.sendMail({
        from: `"Payroo POS" <${smtpUser}>`,
        to: ownerEmail,
        subject,
        html: emailHtml,
      })
      console.log(`✅ Payment follow-up sent to ${ownerEmail}`)
    } else {
      console.log("⚠️ SMTP not configured. Follow-up skipped for:", ownerEmail)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("send-payment-followup error:", error)
    return NextResponse.json({ error: error.message || "Failed to send email" }, { status: 500 })
  }
}
