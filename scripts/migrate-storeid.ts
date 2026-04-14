/**
 * Migration: Stamp all existing documents that have no storeId with "8807" (88 Seven Store)
 *
 * Run with: npx tsx scripts/migrate-storeid.ts
 */

import { initializeApp } from "firebase/app"
import {
  getFirestore, collection, getDocs, writeBatch, doc,
} from "firebase/firestore"

const firebaseConfig = {
  apiKey: "AIzaSyCCkjIavh4Ip6Zud9z6ydmpSmfGQJ5BJRA",
  authDomain: "sari-pos-88979.firebaseapp.com",
  projectId: "sari-pos-88979",
  storageBucket: "sari-pos-88979.firebasestorage.app",
  messagingSenderId: "412821814538",
  appId: "1:412821814538:web:b4cb53f58d5d54c5ef8ef3",
}

const STORE_ID = "8807"

const COLLECTIONS = [
  "products",
  "categories",
  "sales",
  "ewalletTransactions",
  "inventoryTransactions",
  "commissionSettings",
  "storeSettings",
  "utang",
  "utangPayments",
  "loyaltyCustomers",
  "loyaltyTransactions",
  "loyaltySettings",
  "loyaltyRules",
]

async function migrate() {
  console.log("🔧 Initializing Firebase...")
  const app = initializeApp(firebaseConfig)
  const db = getFirestore(app)

  let totalUpdated = 0

  for (const colName of COLLECTIONS) {
    const snap = await getDocs(collection(db, colName))
    const docsWithoutStoreId = snap.docs.filter(d => !d.data().storeId)

    if (docsWithoutStoreId.length === 0) {
      console.log(`  ✓ ${colName}: all docs already have storeId`)
      continue
    }

    // Batch update (max 500 per batch)
    for (let i = 0; i < docsWithoutStoreId.length; i += 400) {
      const batch = writeBatch(db)
      const chunk = docsWithoutStoreId.slice(i, i + 400)
      for (const d of chunk) {
        batch.update(doc(db, colName, d.id), { storeId: STORE_ID })
      }
      await batch.commit()
    }

    console.log(`  ✅ ${colName}: stamped ${docsWithoutStoreId.length} docs with storeId="${STORE_ID}"`)
    totalUpdated += docsWithoutStoreId.length
  }

  console.log("")
  console.log(`Done! Updated ${totalUpdated} documents total.`)
  process.exit(0)
}

migrate().catch(err => {
  console.error("❌ Migration failed:", err)
  process.exit(1)
})
