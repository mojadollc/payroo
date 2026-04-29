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

// ── 5. createInvoice (subscription payment) ─────────────────────────────
exports.createInvoice = onRequest(fnOpts, (req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    try {
      const { planId, planName, planPrice, ownerName, ownerEmail, storeName, phone, businessType, referralCode } = req.body;

      if (!planId || !planName || planPrice === undefined || planPrice === null || !ownerName || !ownerEmail || !storeName) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const { xenditSecretKey, appUrl } = getConfig();
      if (!xenditSecretKey) return res.status(500).json({ error: "Payment gateway not configured" });

      const db = admin.firestore();

      // Deduplication
      const existingSnap = await db.collection("customerSubscriptions")
        .where("ownerEmail", "==", ownerEmail).get();

      for (const d of existingSnap.docs) {
        const data = d.data();
        if (data.status === "active") {
          const endDate = data.endDate?.toDate?.();
          if (endDate && endDate > new Date()) {
            return res.status(409).json({ error: "You already have an active subscription." });
          }
        }
        if (data.status === "pending" && data.planId === planId && data.xenditPaymentUrl) {
          return res.json({ invoiceUrl: data.xenditPaymentUrl, invoiceId: data.xenditInvoiceId, externalId: data.externalId });
        }
        if (data.status === "pending") {
          await d.ref.delete();
        }
      }

      const externalId = String(Math.floor(100000 + Math.random() * 900000));

      // Fetch plan tier + features
      let planTier = "basic";
      let planFeatures = {};
      const planSnap = await db.collection("subscriptionPlans").doc(planId).get();
      if (planSnap.exists) {
        planTier = planSnap.data().tier || "basic";
        planFeatures = planSnap.data().features || {};
      }

      // Create Xendit invoice
      const response = await axios.post(
        "https://api.xendit.co/v2/invoices",
        {
          external_id: externalId,
          amount: planPrice,
          description: `POS Subscription — ${planName} Plan (1 month)`,
          invoice_duration: 86400,
          customer: {
            given_names: ownerName,
            email: ownerEmail,
            mobile_number: phone || undefined,
          },
          customer_notification_preference: {
            invoice_created: ["email"],
            invoice_reminder: ["email"],
            invoice_paid: ["email"],
          },
          success_redirect_url: `${appUrl}/payment/success?ext=${externalId}`,
          failure_redirect_url: `${appUrl}/payment/failed?ext=${externalId}`,
          currency: "PHP",
          items: [{ name: `${planName} Plan — Monthly Subscription`, quantity: 1, price: planPrice, category: "Software Subscription" }],
        },
        { headers: getXenditHeaders() }
      );

      const invoice = response.data;

      // Save pending subscription
      await db.collection("customerSubscriptions").add({
        ownerName, ownerEmail, storeName,
        businessType: businessType || "retail",
        phone: phone || "",
        planId, tier: planTier, features: planFeatures,
        status: "pending",
        xenditInvoiceId: invoice.id,
        xenditPaymentStatus: "PENDING",
        xenditPaymentUrl: invoice.invoice_url,
        externalId,
        referralCode: referralCode || "",
        startDate: null, endDate: null,
        expiryReminderDate: null, expiryReminderSent: false,
        notes: `Awaiting payment. Invoice: ${invoice.id}`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.json({ invoiceUrl: invoice.invoice_url, invoiceId: invoice.id, externalId });
    } catch (error) {
      console.error("createInvoice error:", error.response?.data || error.message);
      res.status(500).json({ error: error.response?.data?.message || error.message });
    }
  });
});

// ── 6. createFreeSubscription ────────────────────────────────────────────
exports.createFreeSubscription = onRequest(fnOpts, (req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    try {
      const { planId, planName, ownerName, ownerEmail, storeName, phone, businessType, referralCode } = req.body;
      if (!planId || !planName || !ownerName || !ownerEmail || !storeName) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const db = admin.firestore();

      // Deduplication
      const existingSnap = await db.collection("customerSubscriptions")
        .where("ownerEmail", "==", ownerEmail).get();

      for (const d of existingSnap.docs) {
        const data = d.data();
        if (data.status === "active") {
          const endDate = data.endDate?.toDate?.();
          if (endDate && endDate > new Date()) {
            return res.status(409).json({ error: "You already have an active subscription." });
          }
        }
        if (data.status === "pending") await d.ref.delete();
      }

      const externalId = String(Math.floor(100000 + Math.random() * 900000));

      let planTier = "basic";
      let planFeatures = {};
      const planSnap = await db.collection("subscriptionPlans").doc(planId).get();
      if (planSnap.exists) {
        planTier = planSnap.data().tier || "basic";
        planFeatures = planSnap.data().features || {};
      }

      await db.collection("customerSubscriptions").add({
        ownerName, ownerEmail, storeName,
        businessType: businessType || "retail",
        phone: phone || "",
        planId, tier: planTier, features: planFeatures,
        status: "active",
        xenditInvoiceId: null,
        xenditPaymentStatus: "PAID",
        xenditPaymentUrl: null,
        externalId,
        referralCode: referralCode || "",
        startDate: admin.firestore.FieldValue.serverTimestamp(),
        endDate: admin.firestore.Timestamp.fromDate(
          new Date(Date.now() + 10 * 365.25 * 24 * 60 * 60 * 1000)
        ),
        expiryReminderDate: null,
        expiryReminderSent: false,
        notes: "FREE plan subscription - no payment required",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.json({ success: true, externalId, message: "FREE subscription created successfully" });
    } catch (error) {
      console.error("createFreeSubscription error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });
});

// ── 7. xenditWebhook ─────────────────────────────────────────────────────
exports.xenditWebhook = onRequest(fnOpts, (req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    try {
      const token = req.headers["x-callback-token"];
      if (token !== getConfig().xenditWebhookToken) return res.status(401).json({ error: "Unauthorized" });
      const { id, status, external_id } = req.body;
      const db = admin.firestore();

      // Log webhook event
      await db.collection("webhook_events").add({
        invoiceId: id,
        externalId: external_id,
        status,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        payload: req.body,
      });

      // Activate subscription on successful payment
      if (status === "PAID" || status === "SETTLED") {
        const subSnap = await db.collection("customerSubscriptions")
          .where("externalId", "==", external_id).limit(1).get();

        if (!subSnap.empty) {
          const subDoc = subSnap.docs[0];
          const now = new Date();
          const endDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
          await subDoc.ref.update({
            status: "active",
            xenditPaymentStatus: status,
            startDate: admin.firestore.FieldValue.serverTimestamp(),
            endDate: admin.firestore.Timestamp.fromDate(endDate),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            notes: `Payment confirmed. Invoice: ${id}`,
          });
        }
      }

      res.json({ success: true, message: "Webhook processed" });
    } catch (error) {
      console.error("xenditWebhook error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });
});
