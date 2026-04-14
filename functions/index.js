const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const cors = require("cors");
const axios = require("axios");

admin.initializeApp();

// ── Config Helpers ────────────────────────────────────────────────────────
const getConfig = () => ({
  xenditSecretKey: process.env.XENDIT_SECRET_KEY,
  xenditWebhookToken: process.env.XENDIT_WEBHOOK_TOKEN,
  appUrl: process.env.NEXT_PUBLIC_APP_URL,
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
});

const getMailTransporter = () => {
  const { smtpUser, smtpPass } = getConfig();
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: smtpUser, pass: smtpPass },
  });
};

const getXenditHeaders = () => ({
  Authorization: `Basic ${Buffer.from(getConfig().xenditSecretKey + ":").toString("base64")}`,
  "Content-Type": "application/json",
});

const corsHandler = cors({ origin: true });
const fnOpts = { region: "us-central1", cors: true };

// ── 1. xenditCashin ──────────────────────────────────────────────────────
exports.xenditCashin = onRequest(fnOpts, (req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    try {
      const { amount, email, description } = req.body;
      if (!amount || !email) return res.status(400).json({ error: "Missing required fields" });
      const { appUrl } = getConfig();
      const response = await axios.post(
        "https://api.xendit.co/v2/invoices",
        {
          external_id: `cashin-${Date.now()}`,
          amount: parseInt(amount),
          payer_email: email,
          description: description || "Cash In",
          success_redirect_url: `${appUrl}/success`,
          failure_redirect_url: `${appUrl}/failed`,
        },
        { headers: getXenditHeaders() }
      );
      res.json({ invoiceUrl: response.data.invoice_url });
    } catch (error) {
      console.error("xenditCashin error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });
});

// ── 2. sendWelcome ───────────────────────────────────────────────────────
exports.sendWelcome = onRequest(fnOpts, (req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    try {
      const { email, name } = req.body;
      if (!email) return res.status(400).json({ error: "Email is required" });
      await getMailTransporter().sendMail({
        from: getConfig().smtpUser,
        to: email,
        subject: "Welcome to Sari POS",
        html: `<h1>Welcome ${name || "User"}!</h1><p>Thank you for joining Sari POS.</p>`,
      });
      res.json({ success: true, message: "Welcome email sent" });
    } catch (error) {
      console.error("sendWelcome error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });
});

// ── 3. sendExpiryNotice ──────────────────────────────────────────────────
exports.sendExpiryNotice = onRequest(fnOpts, (req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    try {
      const { email, expiryDate } = req.body;
      if (!email) return res.status(400).json({ error: "Email is required" });
      await getMailTransporter().sendMail({
        from: getConfig().smtpUser,
        to: email,
        subject: "Subscription Expiry Notice",
        html: `<h1>Subscription Expiry Notice</h1><p>Your subscription expires on ${expiryDate}.</p>`,
      });
      res.json({ success: true, message: "Expiry notice sent" });
    } catch (error) {
      console.error("sendExpiryNotice error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });
});

// ── 4. sendPaymentFollowup ───────────────────────────────────────────────
exports.sendPaymentFollowup = onRequest(fnOpts, (req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    try {
      const { email, invoiceId } = req.body;
      if (!email) return res.status(400).json({ error: "Email is required" });
      await getMailTransporter().sendMail({
        from: getConfig().smtpUser,
        to: email,
        subject: "Payment Followup",
        html: `<h1>Payment Followup</h1><p>Please complete your payment for invoice ${invoiceId}.</p>`,
      });
      res.json({ success: true, message: "Followup email sent" });
    } catch (error) {
      console.error("sendPaymentFollowup error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });
});

// ── 5. createInvoice ─────────────────────────────────────────────────────
exports.createInvoice = onRequest(fnOpts, (req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    try {
      const { amount, email, description, items } = req.body;
      if (!amount || !email) return res.status(400).json({ error: "Missing required fields" });
      const { appUrl } = getConfig();
      const response = await axios.post(
        "https://api.xendit.co/v2/invoices",
        {
          external_id: `inv-${Date.now()}`,
          amount: parseInt(amount),
          payer_email: email,
          description: description || "Invoice",
          items: items || [],
          success_redirect_url: `${appUrl}/success`,
          failure_redirect_url: `${appUrl}/failed`,
        },
        { headers: getXenditHeaders() }
      );
      res.json({ success: true, invoiceId: response.data.id, invoiceUrl: response.data.invoice_url });
    } catch (error) {
      console.error("createInvoice error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });
});

// ── 6. xenditWebhook ─────────────────────────────────────────────────────
exports.xenditWebhook = onRequest(fnOpts, (req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    try {
      const token = req.headers["x-callback-token"];
      if (token !== getConfig().xenditWebhookToken) return res.status(401).json({ error: "Unauthorized" });
      const { id, status, external_id } = req.body;
      await admin.firestore().collection("webhook_events").add({
        invoiceId: id,
        externalId: external_id,
        status,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        payload: req.body,
      });
      res.json({ success: true, message: "Webhook processed" });
    } catch (error) {
      console.error("xenditWebhook error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });
});
