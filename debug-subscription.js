// Debug script to check subscription plans
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

async function checkPlans() {
  try {
    const snap = await getDocs(query(collection(db, "subscriptionPlans"), orderBy("price")));
    console.log("Found plans:", snap.size);
    
    snap.docs.forEach(doc => {
      const data = doc.data();
      console.log(`Plan ID: ${doc.id}`);
      console.log(`Name: ${data.name}`);
      console.log(`Price: ${data.price}`);
      console.log(`Tier: ${data.tier}`);
      console.log(`Active: ${data.isActive}`);
      console.log("---");
    });
  } catch (error) {
    console.error("Error:", error);
  }
}

checkPlans();