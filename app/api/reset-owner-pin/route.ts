import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"

export async function POST(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  try {
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    // Generate temporary 6-digit PIN
    const tempPin = String(Math.floor(100000 + Math.random() * 900000))

    // TODO: Store tempPin in database with expiry (e.g. 1 hour)
    // For now, we'll just send it via email
    // In production, you should:
    // 1. Store tempPin + expiry in Firestore under a "pinResets" collection
    // 2. When owner logs in with tempPin, verify it's not expired
    // 3. Force them to set a new permanent PIN
    // 4. Delete the temp PIN record

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #EFBF04 0%, #F4D03F 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
            .pin-box { background: #f9fafb; border: 2px dashed #EFBF04; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
            .pin { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #EFBF04; font-family: monospace; }
            .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; border-radius: 4px; }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
            .button { display: inline-block; background: #EFBF04; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">🔐 PIN Reset Request</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Payroo POS</p>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>You requested to reset your owner PIN. Here is your <strong>temporary PIN</strong>:</p>
              
              <div class="pin-box">
                <div class="pin">${tempPin}</div>
                <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 14px;">Valid for 1 hour</p>
              </div>

              <div class="warning">
                <strong>⚠️ Important:</strong> This is a temporary PIN. After logging in, please go to <strong>User Management</strong> to set a new permanent PIN.
              </div>

              <p><strong>How to use:</strong></p>
              <ol>
                <li>Go to <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://payroo.xyz"}/dashboard">Owner Login</a></li>
                <li>Enter your email: <strong>${email}</strong></li>
                <li>Enter the temporary PIN above</li>
                <li>Once logged in, go to <strong>User Management</strong> → Edit your account → Set a new PIN</li>
              </ol>

              <p style="margin-top: 30px;">If you didn't request this, please ignore this email or contact support.</p>

              <div style="text-align: center; margin-top: 30px;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://payroo.xyz"}/dashboard" class="button">Login Now</a>
              </div>
            </div>
            <div class="footer">
              <p>Payroo POS — Point of Sale System for Filipino Stores</p>
              <p>Need help? <a href="mailto:support@payroo.xyz" style="color: #EFBF04;">support@payroo.xyz</a></p>
            </div>
          </div>
        </body>
      </html>
    `

    await resend.emails.send({
      from: "Payroo POS <noreply@payroo.xyz>",
      to: email,
      subject: "🔐 Your Temporary PIN - Payroo POS",
      html: emailHtml,
    })

    return NextResponse.json({ 
      success: true, 
      message: "Temporary PIN sent to your email",
      // In development, return the PIN for testing
      ...(process.env.NODE_ENV === "development" && { tempPin })
    })
  } catch (error: any) {
    console.error("Reset PIN error:", error)
    return NextResponse.json({ error: error.message || "Failed to send reset email" }, { status: 500 })
  }
}
