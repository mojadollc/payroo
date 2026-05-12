import { NextRequest, NextResponse } from "next/server"
import nodemailer from "nodemailer"

export async function POST(req: NextRequest) {
  try {
    const { ownerName, ownerEmail, storeName, storeId, ownerPin, planName, planPrice, appUrl } = await req.json()

    if (!ownerEmail || !storeId || !ownerPin) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const siteUrl = appUrl || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;background:#f4f4f5}
    .wrap{max-width:560px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
    .hero{background:linear-gradient(135deg,#EFBF04 0%,#D4A904 100%);color:#fff;padding:40px 30px;text-align:center}
    .hero h1{margin:0 0 8px;font-size:26px}
    .hero p{margin:0;opacity:.9;font-size:14px}
    .body{padding:30px}
    .cred-box{background:#f8fafc;border:2px dashed #EFBF04;border-radius:10px;padding:20px;margin:20px 0;text-align:center}
    .cred-box .label{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:4px}
    .cred-box .value{font-size:28px;font-weight:800;font-family:'Courier New',monospace;color:#1e293b;letter-spacing:4px}
    .cred-row{display:flex;gap:12px;margin:16px 0}
    .cred-item{flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;text-align:center}
    .cred-item .label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:4px}
    .cred-item .value{font-size:22px;font-weight:800;font-family:'Courier New',monospace;color:#1e293b;letter-spacing:3px}
    .warn{background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:12px 16px;font-size:12px;color:#92400e;margin:16px 0}
    .steps{margin:20px 0}
    .step{display:flex;gap:12px;margin-bottom:14px}
    .step-num{width:28px;height:28px;background:#EFBF04;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0}
    .step-text h3{margin:0;font-size:14px;color:#1e293b}
    .step-text p{margin:2px 0 0;font-size:12px;color:#64748b}
    .btn{display:inline-block;background:#EFBF04;color:#1e293b;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin:16px 0}
    .footer{text-align:center;padding:20px 30px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8}
    .info-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px}
    .info-row:last-child{border:none}
    .info-label{color:#64748b}
    .info-value{font-weight:600;color:#1e293b}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hero">
      <h1>Welcome to Payroo POS! 🎉</h1>
      <p>Your store is ready — here are your login credentials</p>
    </div>
    <div class="body">
      <p>Hi <strong>${ownerName}</strong>,</p>
      <p>Your Payroo POS subscription is now active! Below are your credentials to get started.</p>

      <div class="cred-box">
        <div class="label">Your Store ID</div>
        <div class="value">${storeId}</div>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0">
        <tr>
          <td width="48%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;text-align:center">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:4px">Username</div>
            <div style="font-size:18px;font-weight:800;font-family:'Courier New',monospace;color:#1e293b">${ownerName.split(" ")[0].toLowerCase()}</div>
          </td>
          <td width="4%"></td>
          <td width="48%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;text-align:center">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:4px">PIN Code</div>
            <div style="font-size:22px;font-weight:800;font-family:'Courier New',monospace;color:#1e293b;letter-spacing:3px">${ownerPin}</div>
          </td>
        </tr>
      </table>

      <div class="warn">
        ⚠️ <strong>Keep these credentials safe!</strong> You'll need your Store ID, username, and PIN to log in. Change your PIN after first login.
      </div>

      <div style="margin:20px 0">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:#1e293b">Store Details</div>
        <div class="info-row"><span class="info-label">Store Name</span><span class="info-value">${storeName}</span></div>
        <div class="info-row"><span class="info-label">Plan</span><span class="info-value">${planName} (₱${planPrice}/mo)</span></div>
        <div class="info-row"><span class="info-label">Email</span><span class="info-value">${ownerEmail}</span></div>
      </div>

      <div class="steps">
        <div style="font-size:13px;font-weight:600;margin-bottom:12px;color:#1e293b">Getting Started</div>
        <div class="step">
          <div class="step-num">1</div>
          <div class="step-text"><h3>Log in to your store dashboard</h3><p>Go to ${siteUrl}/dashboard and enter your email and PIN</p></div>
        </div>
        <div class="step">
          <div class="step-num">2</div>
          <div class="step-text"><h3>Add your products</h3><p>Go to Inventory and start adding items with prices and stock</p></div>
        </div>
        <div class="step">
          <div class="step-num">3</div>
          <div class="step-text"><h3>Add staff members</h3><p>Create cashier accounts in User Management</p></div>
        </div>
        <div class="step">
          <div class="step-num">4</div>
          <div class="step-text"><h3>Start selling!</h3><p>Use the POS to process your first sale</p></div>
        </div>
      </div>

      <div style="text-align:center">
        <a href="${siteUrl}/dashboard" class="btn">Log In Now →</a>
      </div>
    </div>
    <div class="footer">
      <p>© 2024 Payroo POS · Built by MOJADOO</p>
      <p>Questions? Reply to this email or contact support@saripos.app</p>
    </div>
  </div>
</body>
</html>`

    // Send email via Nodemailer (Gmail SMTP)
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
        subject: `Welcome to Payroo POS! Your Store ID: ${storeId} | PIN: ${ownerPin}`,
        html: emailHtml,
      })

      console.log("✅ Welcome email sent to:", ownerEmail)
    } else {
      console.log("⚠️ SMTP not configured. Email content logged below:")
      console.log("To:", ownerEmail)
      console.log("Store ID:", storeId)
      console.log("PIN:", ownerPin)
      console.log("Username:", ownerName.split(" ")[0].toLowerCase())
    }

    return NextResponse.json({ success: true, storeId, ownerPin })
  } catch (error: any) {
    console.error("Send welcome email error:", error)
    return NextResponse.json({ error: error.message || "Failed to send email" }, { status: 500 })
  }
}
