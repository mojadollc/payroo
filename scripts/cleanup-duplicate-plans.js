const path = require("path");
const admin = require(path.resolve(__dirname, "../functions/node_modules/firebase-admin"));
const serviceAccount = require(path.resolve(__dirname, "../sari-pos-88979-firebase-adminsdk-fbsvc-46c9d39e03.json"));

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function main() {
  const snap = await db.collection("subscriptionPlans").orderBy("price").get();
  console.log(`Found ${snap.size} total plan documents\n`);

  const seen = new Map();
  const toDelete = [];

  snap.docs.forEach(d => {
    const data = d.data();
    const key = data.tier;
    if (!seen.has(key)) {
      seen.set(key, { id: d.id, name: data.name, tier: data.tier, price: data.price });
      console.log(`✅ KEEP   [${d.id}] ${data.name} (${data.tier}) — ₱${data.price}`);
    } else {
      toDelete.push(d.ref);
      console.log(`🗑  DELETE [${d.id}] ${data.name} (${data.tier}) — ₱${data.price}  (duplicate of ${seen.get(key).id})`);
    }
  });

  if (toDelete.length === 0) {
    console.log("\nNo duplicates found. All clean!");
    process.exit(0);
  }

  console.log(`\nDeleting ${toDelete.length} duplicate(s)...`);
  const batch = db.batch();
  toDelete.forEach(ref => batch.delete(ref));
  await batch.commit();
  console.log("Done! Duplicates removed.");
  process.exit(0);
}

main().catch(err => { console.error("Error:", err); process.exit(1); });
