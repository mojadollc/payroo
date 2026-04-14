const admin = require("firebase-admin");
const path = require("path");
const serviceAccount = require(path.resolve(__dirname, "../sari-pos-88979-firebase-adminsdk-fbsvc-46c9d39e03.json"));

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const SUBSCRIPTION_DAYS = 29;
const REMINDER_DAYS_BEFORE = 5;
const EMAILS_TO_ACTIVATE = ["pacificbelmont@gmail.com", "nmcanonoy@gmail.com"];

async function activateSubscription(email) {
  const snap = await db.collection("customerSubscriptions")
    .where("ownerEmail", "==", email)
    .get();

  // Filter to pending only, pick most recent
  const pendingDocs = snap.docs
    .filter(d => d.data().status === "pending")
    .sort((a, b) => (b.data().createdAt?.toMillis?.() || 0) - (a.data().createdAt?.toMillis?.() || 0));

  if (pendingDocs.length === 0) {
    console.log(`❌ No pending subscription found for ${email}`);
    return;
  }

  const docRef = pendingDocs[0].ref;
  const data = pendingDocs[0].data();
  const now = new Date();
  const startDate = admin.firestore.Timestamp.now();
  const endDateRaw = new Date(now.getTime() + SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000);
  const endDate = admin.firestore.Timestamp.fromDate(endDateRaw);
  const reminderDate = new Date(endDateRaw.getTime() - REMINDER_DAYS_BEFORE * 24 * 60 * 60 * 1000);

  // Resolve plan features
  let features = data.features ?? {};
  let tier = data.tier ?? "basic";
  if (data.planId) {
    const planSnap = await db.collection("subscriptionPlans").doc(data.planId).get();
    if (planSnap.exists) {
      features = planSnap.data().features ?? features;
      tier = planSnap.data().tier ?? tier;
    }
  }

  // 1. Activate subscription
  await docRef.update({
    xenditPaymentStatus: "PAID",
    status: "active",
    startDate,
    endDate,
    features,
    tier,
    expiryReminderDate: admin.firestore.Timestamp.fromDate(reminderDate),
    expiryReminderSent: false,
    notes: `Manually activated on ${now.toLocaleDateString("en-PH")} · Expires ${endDateRaw.toLocaleDateString("en-PH")} (${SUBSCRIPTION_DAYS} days)`,
    updatedAt: admin.firestore.Timestamp.now(),
  });

  // 2. Write storeSettings
  const externalId = data.externalId;
  const settingsId = `owner_${(externalId).replace(/[^a-z0-9]/gi, "_")}`;
  await db.collection("storeSettings").doc(settingsId).set({
    name: data.storeName,
    businessType: data.businessType || "retail",
    ownerEmail: data.ownerEmail,
    ownerName: data.ownerName,
    subscriptionStatus: "active",
    subscriptionTier: tier,
    subscriptionFeatures: features,
    subscriptionEndDate: endDate,
    externalId,
    storeId: externalId,
    updatedAt: admin.firestore.Timestamp.now(),
  }, { merge: true });

  // 3. Auto-create owner StoreUser if not exists
  const storeId = externalId;
  const existingOwner = await db.collection("storeUsers")
    .where("externalId", "==", storeId)
    .where("role", "==", "owner")
    .get();

  let ownerPin = "(existing)";
  if (existingOwner.empty) {
    const ownerUsername = (data.ownerName ?? "owner").split(" ")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
    ownerPin = String(Math.floor(100000 + Math.random() * 900000));
    await db.collection("storeUsers").add({
      name: data.ownerName,
      username: ownerUsername,
      pin: ownerPin,
      role: "owner",
      externalId: storeId,
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  // 4. Credit affiliate commission if referral code present
  if (data.referralCode) {
    const COMMISSION = 150;
    const affSnap = await db.collection("affiliates").where("referralCode", "==", data.referralCode).get();
    if (!affSnap.empty) {
      const affDoc = affSnap.docs[0];
      const affData = affDoc.data();
      const planSnap2 = data.planId ? await db.collection("subscriptionPlans").doc(data.planId).get() : null;
      const planName = planSnap2?.exists ? planSnap2.data().name : tier;
      const planPrice = planSnap2?.exists ? planSnap2.data().price : 0;
      const batch = db.batch();
      batch.set(db.collection("affiliateEarnings").doc(), {
        affiliateId: affDoc.id, referralCode: data.referralCode,
        referredEmail: data.ownerEmail, referredStoreName: data.storeName,
        planName, planPrice, commission: COMMISSION,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      batch.update(affDoc.ref, {
        walletBalance: (affData.walletBalance || 0) + COMMISSION,
        totalEarned: (affData.totalEarned || 0) + COMMISSION,
        totalReferrals: (affData.totalReferrals || 0) + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await batch.commit();
      console.log(`   💰 Affiliate commission ₱${COMMISSION} credited to ${affData.email}`);
    }
  }

  console.log(`✅ Activated: ${data.storeName} (${email})`);
  console.log(`   Store ID: ${storeId}`);
  console.log(`   Tier: ${tier}`);
  console.log(`   Start: ${now.toLocaleDateString("en-PH")}`);
  console.log(`   End:   ${endDateRaw.toLocaleDateString("en-PH")}`);
  console.log(`   Owner PIN: ${ownerPin}`);
  console.log("");
}

async function main() {
  console.log("=== Activating paid subscriptions ===\n");
  for (const email of EMAILS_TO_ACTIVATE) {
    await activateSubscription(email);
  }
  console.log("=== Done ===");
  process.exit(0);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
