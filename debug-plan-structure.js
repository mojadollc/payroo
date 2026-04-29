// Debug script to check plan structure
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, orderBy } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyCCkjIavh4Ip6Zud9z6ydmpSmfGQJ5BJRA",
  authDomain: "sari-pos-88979.firebaseapp.com",
  projectId: "sari-pos-88979",
  storageBucket: "sari-pos-88979.firebasestorage.app",
  messagingSenderId: "412821814538",
  appId: "1:412821814538:web:b4cb53f58d5d54c5ef8ef3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkPlanStructure() {
  try {
    const snap = await getDocs(query(collection(db, "subscriptionPlans"), orderBy("price")));
    console.log("Raw plan data:");
    
    snap.docs.forEach(doc => {
      const data = doc.data();
      const planWithId = { id: doc.id, ...data };
      console.log("Plan object:", JSON.stringify(planWithId, null, 2));
      console.log("---");
    });
  } catch (error) {
    console.error("Error:", error);
  }
}

checkPlanStructure();