const path = require("path");
const admin = require(path.resolve(__dirname, "../functions/node_modules/firebase-admin"));
const serviceAccount = require(path.resolve(__dirname, "../sari-pos-88979-firebase-adminsdk-fbsvc-46c9d39e03.json"));

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function updateSubscriptionPlans() {
  console.log("🔄 Updating subscription plans to FREE/Gold structure...\n");

  try {
    // Get all existing plans
    const plansSnap = await db.collection("subscriptionPlans").get();
    console.log(`Found ${plansSnap.size} existing plan(s)`);

    // Delete all existing plans first
    const batch = db.batch();
    plansSnap.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    console.log("✅ Deleted existing plans");

    // Create new FREE and Gold plans
    const newPlans = [
      {
        tier: "basic",
        name: "FREE",
        price: 0,
        description: "Perfect for small sari-sari stores",
        isActive: true,
        features: {
          pos: true,
          inventory: true,
          ewallet: true,
          reports: true,
          loyalty: false,
          utang: false,
          aiRestock: false,
          multiUser: false,
          exportData: false,
          marketIntelligence: false,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {
        tier: "gold",
        name: "Gold",
        price: 899,
        description: "Full-featured for growing businesses",
        isActive: true,
        features: {
          pos: true,
          inventory: true,
          ewallet: true,
          reports: true,
          loyalty: true,
          utang: true,
          aiRestock: true,
          multiUser: true,
          exportData: true,
          marketIntelligence: true,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    ];

    // Add new plans
    const newBatch = db.batch();
    for (const plan of newPlans) {
      const ref = db.collection("subscriptionPlans").doc();
      newBatch.set(ref, plan);
      console.log(`✅ Creating ${plan.name} plan (₱${plan.price})`);
    }
    await newBatch.commit();

    console.log("\n🎉 Successfully updated subscription plans!");
    console.log("📋 New structure:");
    console.log("   • FREE Plan (₱0) - POS, Inventory, E-Wallet, Reports");
    console.log("   • Gold Plan (₱899) - All features");
    console.log("\n💡 Refresh your browser to see the changes");

  } catch (error) {
    console.error("❌ Error updating plans:", error);
  }

  process.exit(0);
}

updateSubscriptionPlans();