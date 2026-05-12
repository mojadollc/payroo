import { NextRequest, NextResponse } from "next/server"
import nodemailer from "nodemailer"

export async function POST(req: NextRequest) {
  try {
    const { ownerName, ownerEmail, storeName, storeId, planName, planPrice, expiryDate, daysLeft, appUrl: reqAppUrl } = await req.json()

    if (!ownerEmail || !storeId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const siteUrl = reqAppUrl || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const isExpired = daysLeft <= 0

    const subject = isExpired
      ? `⚠️ Your Payroo POS subscription has expired — ${storeName}`
      : `⏰ Your Payroo POS subscription expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"} — Renew now`

    const headerBg = isExpired ? "#dc2626" : "#f59e0b"
    const headerEmoji = isExpired ? "🔴" : "⏰"
    const headerText = isExpired ? "Subscription Expired" : `Expiring in ${daysLeft} Day${daysLeft === 1 ? "" : "s"}`
    const bodyMessage = isExpired
      ? `Your Payroo POS subscription for <strong>${storeName}</strong> has expired. Your store features have been limited. Renew now to restore full access.`
      : `Your Payroo POS subscription for <strong>${storeName}</strong> will expire on <strong>${expiryDate}</strong>. Renew now to avoid any interruption to your store operations.`

    const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;background:#f4f4f5}
  .wrap{max-width:560px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
  .hero{background:${headerBg};color:#fff;padding:36px 30px;text-align:center}
  .hero h1{margin:0 0 6px;font-size:24px}
  .hero p{margin:0;opacity:.9;font-size:14px}
  .body{padding:30px}
  .alert-box{background:${isExpired ? "#fef2f2" : "#fffbeb"};border:2px solid ${isExpired ? "#fca5a5" : "#fcd34d"};border-radius:10px;padding:20px;margin:20px 0;text-align:center}
  .alert-days{font-size:48px;font-weight:900;color:${isExpired ? "#dc2626" : "#d97706"};line-height:1}
  .alert-label{font-size:13px;color:${isExpired ? "#991b1b" : "#92400e"};margin-top:4px}
  .info-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px}
  .info-row:last-child{border:none}
  .info-label{color:#64748b}
  .info-value{font-weight:600;color:#1e293b}
  .btn{display:inline-block;background:#EFBF04;color:#1e293b;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;margin:20px 0}
  .warn{background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:12px 16px;font-size:12px;color:#92400e;margin:16px 0}
  .footer{text-align:center;padding:20px 30px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8}
</style></head>
<body>
  <div class="wrap">
    <div class="hero">
      <h1>${headerEmoji} ${headerText}</h1>
      <p>Payroo POS Subscription Notice</p>
    </div>
    <div class="body">
      <p>Hi <strong>${ownerName}</strong>,</p>
      <p>${bodyMessage}</p>
      <div class="alert-box">
        <div class="alert-days">${isExpired ? "EXPIRED" : daysLeft}</div>
        <div class="alert-label">${isExpired ? "Your subscription has ended" : `day${daysLeft === 1 ? "" : "s"} remaining`}</div>
      </div>
      <div style="margin:20px 0">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:#1e293b">Subscription Details</div>
        <div class="info-row"><span class="info-label">Store Name</span><span class="info-value">${storeName}</span></div>
        <div class="info-row"><span class="info-label">Store ID</span><span class="info-value">${storeId}</span></div>
        <div class="info-row"><span class="info-label">Plan</span><span class="info-value">${planName} — ₱${planPrice}/month</span></div>
        <div class="info-row"><span class="info-label">Expiry Date</span><span class="info-value">${expiryDate}</span></div>
      </div>
      ${isExpired
        ? `<div class="warn">🔴 <strong>Your store features are now limited.</strong> POS still works but inventory, reports, and other features are restricted until you renew.</div>`
        : `<div class="warn">⚠️ <strong>Don't let your store go offline!</strong> Renew before ${expiryDate} to keep all features running without interruption.</div>`
      }
      <div style="text-align:center">
        <a href="${siteUrl}/subscription" class="btn">Renew Subscription →</a>
      </div>
      <p style="font-size:12px;color:#64748b;text-align:center;margin-top:8px">
        Or visit: <a href="${siteUrl}/subscription" style="color:#EFBF04">${siteUrl}/subscription</a>
      </p>
    </div>
    <div class="footer">
      <p>© 2024 Payroo POS · Built by MOJADOO</p>
      <p>Questions? Contact support@saripos.app</p>
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
      console.log(`✅ Expiry notice sent to ${ownerEmail} (${daysLeft} days left)`)
    } else {
      console.log("⚠️ SMTP not configured. Expiry notice skipped for:", ownerEmail)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("send-expiry-notice error:", error)
    return NextResponse.json({ error: error.message || "Failed to send email" }, { status: 500 })
  }
}
