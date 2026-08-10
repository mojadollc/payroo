import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { prisma } from "@/lib/db/client"

export async function POST(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 })

    const tempPin = String(Math.floor(100000 + Math.random() * 900000))
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    // Invalidate old unused resets for this email
    await prisma.pinReset.updateMany({ where: { email, used: false }, data: { used: true } })

    // Store new reset record
    await prisma.pinReset.create({ data: { email, tempPin, expiresAt } })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://payroo.xyz"

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
            .button { display: inline-block; background: #EFBF04; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header"><h1 style="margin:0">🔐 PIN Reset Request</h1><p style="margin:10px 0 0;opacity:.9">Payroo POS</p></div>
            <div class="content">
              <p>You requested to reset your owner PIN. Here is your <strong>temporary PIN</strong>:</p>
              <div class="pin-box">
                <div class="pin">${tempPin}</div>
                <p style="margin:10px 0 0;color:#6b7280;font-size:14px">Valid for 1 hour</p>
              </div>
              <div class="warning"><strong>⚠️ Important:</strong> After logging in, go to <strong>User Management</strong> to set a new permanent PIN.</div>
              <ol>
                <li>Go to <a href="${appUrl}/dashboard">Owner Login</a></li>
                <li>Enter your email: <strong>${email}</strong></li>
                <li>Enter the temporary PIN above</li>
                <li>Set a new PIN in User Management</li>
              </ol>
              <div style="text-align:center;margin-top:30px"><a href="${appUrl}/dashboard" class="button">Login Now</a></div>
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
      ...(process.env.NODE_ENV === "development" && { tempPin }),
    })
  } catch (error: any) {
    console.error("Reset PIN error:", error)
    return NextResponse.json({ error: error.message || "Failed to send reset email" }, { status: 500 })
  }
}
