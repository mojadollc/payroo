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

// ── 0. eloadApi ─────────────────────────────────────────────────────────
exports.eloadApi = onRequest(fnOpts, (req, res) => {
  corsHandler(req, res, async () => {
    const GBITS_API_URL = process.env.GBITS_API_URL || 'https://api.gbits.ph';
    const GBITS_BUSINESS_ID = process.env.GBITS_BUSINESS_ID;
    const GBITS_BUSINESS_CODE = process.env.GBITS_BUSINESS_CODE;
    const GBITS_USERNAME = process.env.GBITS_USERNAME;
    const GBITS_PASSWORD = process.env.GBITS_PASSWORD;
    const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

    let token = null;
    const authenticate = async () => {
      const r = await axios.post(`${GBITS_API_URL}/auth`,
        { username: GBITS_USERNAME, password: GBITS_PASSWORD },
        { headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': UA } }
      );
      if (r.data.errorCode !== 0) throw new Error(r.data.message || 'Gbits auth failed');
      return r.data.content.accessToken;
    };

    const gbitsGet = async (path) => {
      if (!token) token = await authenticate();
      const r = await axios.get(`${GBITS_API_URL}${path}`, {
        headers: { Authorization: token, Accept: 'application/json', 'User-Agent': UA }
      });
      return r.data;
    };

    const generateTxnId = () => {
      const date = new Date().toISOString().slice(0,10).replace(/-/g,'');
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let rand = '';
      for (let i = 0; i < 6; i++) rand += chars[Math.floor(Math.random() * chars.length)];
      return `${GBITS_BUSINESS_CODE}${date}${rand}`;
    };

    const mapSkus = (skus) => skus
      .filter(s => s.skuStatus === true)
      .map(s => ({
        promoId: s.promoId, name: s.skuName, network: s.serviceGroup,
        service: s.service, category: s.category, amount: s.amount,
        description: s.description, validity: s.validity,
        addressType: s.addressType, addressMin: s.addressMin, addressMax: s.addressMax,
      }))
      .sort((a, b) => a.amount - b.amount);

    try {
      if (req.method === 'GET') {
        const { action, txnId } = req.query;
        if (action === 'status' && txnId) {
          const data = await gbitsGet(`/eload/status/${txnId}`);
          const status = data.content?.status;
          if (status === 'success') return res.json({ status: 'completed', txnId });
          if (status === 'failed') return res.json({ status: 'failed', error: data.content?.description || 'Failed' });
          return res.json({ status: 'pending', txnId });
        }
        const data = await gbitsGet(`/eload/sku/${GBITS_BUSINESS_ID}`);
        const products = mapSkus(data.content || []);
        return res.json({ products });
      }

      if (req.method === 'POST') {
        const { promoId, address, amount } = req.body;
        if (!promoId || !address) return res.status(400).json({ error: 'promoId and address are required' });
        if (!token) token = await authenticate();
        const txnId = generateTxnId();
        const params = new URLSearchParams({ promoId: String(promoId), address, transactionId: txnId });
        if (amount) params.append('amount', String(amount));
        const r = await axios.post(`${GBITS_API_URL}/eload/buy?${params.toString()}`, {}, {
          headers: { Authorization: token, Accept: 'application/json', 'User-Agent': UA }
        });
        const result = r.data;
        if (result.errorCode === 0) {
          const gbitsRef = result.content?.referenceId || result.content?.transactionId || txnId;
          return res.json({ status: 'completed', txnId: gbitsRef, localTxnId: txnId });
        }
        if (result.errorCode === 105) return res.json({ status: 'pending', txnId });
        return res.status(422).json({ status: 'failed', txnId, error: result.content?.description || result.message || 'Failed' });
      }

      res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
      console.error('eloadApi error:', error.message);
      res.status(500).json({ error: (error.response && error.response.data && error.response.data.message) || error.message });
    }
  });
});

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
      res.status(500).json({ error: (error.response && error.response.data && error.response.data.message) || error.message });
    }
  });
});

// ── 2. sendWelcome ───────────────────────────────────────────────────────
exports.sendWelcome = onRequest(fnOpts, (req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    try {
      const { ownerName, ownerEmail, storeName, storeId, ownerPin, planName, planPrice, appUrl } = req.body;
      if (!ownerEmail || !storeId || !ownerPin) return res.status(400).json({ error: "Missing required fields" });

      const { smtpUser, smtpPass } = getConfig();
      if (!smtpUser || !smtpPass) return res.status(500).json({ error: "SMTP not configured" });

      const siteUrl = appUrl || process.env.NEXT_PUBLIC_APP_URL || "https://pos.payroo.xyz";
      const username = (ownerName || "").split(" ")[0].toLowerCase();

      const emailHtml = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;background:#f4f4f5}
.wrap{max-width:560px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
.hero{background:linear-gradient(135deg,#EFBF04 0%,#D4A904 100%);color:#fff;padding:40px 30px;text-align:center}
.hero h1{margin:0 0 8px;font-size:26px}.hero p{margin:0;opacity:.9;font-size:14px}
.body{padding:30px}
.cred-box{background:#f8fafc;border:2px dashed #EFBF04;border-radius:10px;padding:20px;margin:20px 0;text-align:center}
.warn{background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:12px 16px;font-size:12px;color:#92400e;margin:16px 0}
.info-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px}
.info-row:last-child{border:none}.info-label{color:#64748b}.info-value{font-weight:600;color:#1e293b}
.btn{display:inline-block;background:#EFBF04;color:#1e293b;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin:16px 0}
.footer{text-align:center;padding:20px 30px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8}
</style></head>
<body><div class="wrap">
<div class="hero"><h1>Welcome to Payroo POS! &#127881;</h1><p>Your store is ready &mdash; here are your login credentials</p></div>
<div class="body">
<p>Hi <strong>${ownerName}</strong>,</p>
<p>Your Payroo POS subscription is now active! Below are your credentials to get started.</p>
<div class="cred-box">
  <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:4px">Your Store ID</div>
  <div style="font-size:28px;font-weight:800;font-family:'Courier New',monospace;color:#1e293b;letter-spacing:4px">${storeId}</div>
</div>
<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0">
<tr>
<td width="48%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;text-align:center">
  <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:4px">Username</div>
  <div style="font-size:18px;font-weight:800;font-family:'Courier New',monospace;color:#1e293b">${username}</div>
</td>
<td width="4%"></td>
<td width="48%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;text-align:center">
  <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:4px">PIN Code</div>
  <div style="font-size:22px;font-weight:800;font-family:'Courier New',monospace;color:#1e293b;letter-spacing:3px">${ownerPin}</div>
</td>
</tr>
</table>
<div class="warn">&#9888;&#65039; <strong>Keep these credentials safe!</strong> You'll need your Store ID, username, and PIN to log in.</div>
<div style="margin:20px 0">
  <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:#1e293b">Store Details</div>
  <div class="info-row"><span class="info-label">Store Name</span><span class="info-value">${storeName}</span></div>
  <div class="info-row"><span class="info-label">Plan</span><span class="info-value">${planName} (&#8369;${planPrice}/mo)</span></div>
  <div class="info-row"><span class="info-label">Email</span><span class="info-value">${ownerEmail}</span></div>
</div>
<div style="text-align:center"><a href="${siteUrl}/dashboard" class="btn">Log In Now &rarr;</a></div>
</div>
<div class="footer"><p>&copy; 2024 Payroo POS &middot; Built by MOJADOO</p><p>Questions? Contact support@payroo.xyz</p></div>
</div></body></html>`;

      await getMailTransporter().sendMail({
        from: `"Payroo POS" <${smtpUser}>`,
        to: ownerEmail,
        subject: `Welcome to Payroo POS! Your Store ID: ${storeId} | PIN: ${ownerPin}`,
        html: emailHtml,
      });

      console.log("Welcome email sent to:", ownerEmail);
      res.json({ success: true, storeId, ownerPin });
    } catch (error) {
      console.error("sendWelcome error:", error.message);
      res.status(500).json({ error: (error.response && error.response.data && error.response.data.message) || error.message });
    }
  });
});

// ── 3. sendExpiryNotice ──────────────────────────────────────────────────
exports.sendExpiryNotice = onRequest(fnOpts, (req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    try {
      const { ownerName, ownerEmail, storeName, storeId, planName, planPrice, expiryDate, daysLeft, appUrl: reqAppUrl } = req.body;
      if (!ownerEmail || !storeId) return res.status(400).json({ error: "Missing required fields" });

      const { smtpUser, smtpPass } = getConfig();
      if (!smtpUser || !smtpPass) return res.status(500).json({ error: "SMTP not configured" });

      const siteUrl = reqAppUrl || process.env.NEXT_PUBLIC_APP_URL || "https://pos.payroo.xyz";
      const isExpired = daysLeft <= 0;
      const subject = isExpired
        ? `Your Payroo POS subscription has expired - ${storeName}`
        : `Your Payroo POS subscription expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"} - Renew now`;

      const headerBg = isExpired ? "#dc2626" : "#f59e0b";
      const alertColor = isExpired ? "#dc2626" : "#d97706";

      const emailHtml = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;background:#f4f4f5}
.wrap{max-width:560px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
.hero{background:${headerBg};color:#fff;padding:36px 30px;text-align:center}
.hero h1{margin:0 0 6px;font-size:24px}.hero p{margin:0;opacity:.9;font-size:14px}
.body{padding:30px}
.alert-box{background:${isExpired ? "#fef2f2" : "#fffbeb"};border:2px solid ${isExpired ? "#fca5a5" : "#fcd34d"};border-radius:10px;padding:20px;margin:20px 0;text-align:center}
.info-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px}
.info-row:last-child{border:none}.info-label{color:#64748b}.info-value{font-weight:600;color:#1e293b}
.btn{display:inline-block;background:#EFBF04;color:#1e293b;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;margin:20px 0}
.footer{text-align:center;padding:20px 30px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8}
</style></head>
<body><div class="wrap">
<div class="hero"><h1>${isExpired ? "Subscription Expired" : `Expiring in ${daysLeft} Day${daysLeft === 1 ? "" : "s"}`}</h1><p>Payroo POS Subscription Notice</p></div>
<div class="body">
<p>Hi <strong>${ownerName}</strong>,</p>
<p>${isExpired ? `Your subscription for <strong>${storeName}</strong> has expired. Renew now to restore full access.` : `Your subscription for <strong>${storeName}</strong> will expire on <strong>${expiryDate}</strong>.`}</p>
<div class="alert-box">
  <div style="font-size:48px;font-weight:900;color:${alertColor};line-height:1">${isExpired ? "EXPIRED" : daysLeft}</div>
  <div style="font-size:13px;color:${isExpired ? "#991b1b" : "#92400e"};margin-top:4px">${isExpired ? "Your subscription has ended" : `day${daysLeft === 1 ? "" : "s"} remaining`}</div>
</div>
<div style="margin:20px 0">
  <div class="info-row"><span class="info-label">Store Name</span><span class="info-value">${storeName}</span></div>
  <div class="info-row"><span class="info-label">Store ID</span><span class="info-value">${storeId}</span></div>
  <div class="info-row"><span class="info-label">Plan</span><span class="info-value">${planName} &mdash; &#8369;${planPrice}/month</span></div>
  <div class="info-row"><span class="info-label">Expiry Date</span><span class="info-value">${expiryDate}</span></div>
</div>
<div style="text-align:center"><a href="${siteUrl}/subscription" class="btn">Renew Subscription &rarr;</a></div>
</div>
<div class="footer"><p>&copy; 2024 Payroo POS &middot; Built by MOJADOO</p></div>
</div></body></html>`;

      await getMailTransporter().sendMail({
        from: `"Payroo POS" <${smtpUser}>`,
        to: ownerEmail,
        subject,
        html: emailHtml,
      });
      console.log(`Expiry notice sent to ${ownerEmail} (${daysLeft} days left)`);
      res.json({ success: true });
    } catch (error) {
      console.error("sendExpiryNotice error:", error.message);
      res.status(500).json({ error: (error.response && error.response.data && error.response.data.message) || error.message });
    }
  });
});

// ── 4. sendPaymentFollowup ───────────────────────────────────────────────
exports.sendPaymentFollowup = onRequest(fnOpts, (req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    try {
      const { ownerName, ownerEmail, storeName, planName, planPrice, paymentUrl, appUrl: reqAppUrl } = req.body;
      if (!ownerEmail || !ownerName) return res.status(400).json({ error: "Missing required fields" });

      const { smtpUser, smtpPass } = getConfig();
      if (!smtpUser || !smtpPass) return res.status(500).json({ error: "SMTP not configured" });

      const siteUrl = reqAppUrl || process.env.NEXT_PUBLIC_APP_URL || "https://pos.payroo.xyz";

      const emailHtml = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;background:#f4f4f5}
.wrap{max-width:560px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
.hero{background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);color:#fff;padding:36px 30px;text-align:center}
.hero h1{margin:0 0 6px;font-size:24px}.hero p{margin:0;opacity:.9;font-size:14px}
.body{padding:30px}
.info-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px}
.info-row:last-child{border:none}.info-label{color:#64748b}.info-value{font-weight:600;color:#1e293b}
.btn{display:inline-block;background:#EFBF04;color:#1e293b;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;margin:20px 0}
.footer{text-align:center;padding:20px 30px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8}
</style></head>
<body><div class="wrap">
<div class="hero"><h1>Payment Reminder</h1><p>Your Payroo POS subscription is waiting for payment</p></div>
<div class="body">
<p>Hi <strong>${ownerName}</strong>,</p>
<p>You started subscribing to Payroo POS for <strong>${storeName}</strong> but haven't completed payment yet.</p>
<div style="margin:20px 0">
  <div class="info-row"><span class="info-label">Store Name</span><span class="info-value">${storeName}</span></div>
  <div class="info-row"><span class="info-label">Plan</span><span class="info-value">${planName} &mdash; &#8369;${planPrice}/month</span></div>
  <div class="info-row"><span class="info-label">Status</span><span class="info-value" style="color:#d97706">Awaiting Payment</span></div>
</div>
<div style="text-align:center"><a href="${paymentUrl || siteUrl + "/subscription"}" class="btn">Complete Payment &rarr;</a></div>
</div>
<div class="footer"><p>&copy; 2024 Payroo POS &middot; Built by MOJADOO</p></div>
</div></body></html>`;

      await getMailTransporter().sendMail({
        from: `"Payroo POS" <${smtpUser}>`,
        to: ownerEmail,
        subject: `Complete your Payroo POS payment - ${storeName}`,
        html: emailHtml,
      });
      console.log(`Payment follow-up sent to ${ownerEmail}`);
      res.json({ success: true });
    } catch (error) {
      console.error("sendPaymentFollowup error:", error.message);
      res.status(500).json({ error: (error.response && error.response.data && error.response.data.message) || error.message });
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

      let planTier = "basic";
      let planFeatures = {};
      const planSnap = await db.collection("subscriptionPlans").doc(planId).get();
      if (planSnap.exists) {
        planTier = planSnap.data().tier || "basic";
        planFeatures = planSnap.data().features || {};
      }

      const response = await axios.post(
        "https://api.xendit.co/v2/invoices",
        {
          external_id: externalId,
          amount: planPrice,
          description: `POS Subscription - ${planName} Plan (1 month)`,
          invoice_duration: 86400,
          customer: { given_names: ownerName, email: ownerEmail, mobile_number: phone || undefined },
          customer_notification_preference: { invoice_created: ["email"], invoice_reminder: ["email"], invoice_paid: ["email"] },
          success_redirect_url: `${appUrl}/payment/success?ext=${externalId}`,
          failure_redirect_url: `${appUrl}/payment/failed?ext=${externalId}`,
          currency: "PHP",
          items: [{ name: `${planName} Plan - Monthly Subscription`, quantity: 1, price: planPrice, category: "Software Subscription" }],
        },
        { headers: getXenditHeaders() }
      );

      const invoice = response.data;

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
      res.status(500).json({ error: (error.response && error.response.data && error.response.data.message) || error.message });
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

      await db.collection("webhook_events").add({
        invoiceId: id,
        externalId: external_id,
        status,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        payload: req.body,
      });

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
      res.status(500).json({ error: (error.response && error.response.data && error.response.data.message) || error.message });
    }
  });
});
