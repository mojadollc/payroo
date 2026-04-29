const path = require("path");
const admin = require(path.resolve(__dirname, "../functions/node_modules/firebase-admin"));
const serviceAccount = require(path.resolve(__dirname, "../sari-pos-88979-firebase-adminsdk-fbsvc-46c9d39e03.json"));

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function updateGoldPlanPrice() {
  console.log("🔄 Updating Gold plan price to ₱499...\n");

  try {
    // Find the Gold plan
    const plansSnap = await db.collection("subscriptionPlans")
      .where("tier", "==", "gold")
      .get();

    if (plansSnap.empty) {
      console.log("❌ No Gold plan found");
      process.exit(1);
    }

    // Update the Gold plan price
    const goldPlan = plansSnap.docs[0];
    await goldPlan.ref.update({
      price: 499,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log("✅ Successfully updated Gold plan price:");
    console.log("   • Old price: ₱899/month");
    console.log("   • New price: ₱499/month");
    console.log("\n💡 Refresh your browser to see the changes");

  } catch (error) {
    console.error("❌ Error updating Gold plan price:", error);
  }

  process.exit(0);
}

updateGoldPlanPrice();