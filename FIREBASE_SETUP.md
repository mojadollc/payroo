# Firebase Setup Guide for Sari-Sari Store POS

## Quick Start

Your POS system is built and ready, but it needs Firebase credentials to work. Follow these steps to get everything running.

## Prerequisites
- A Google account
- The POS system URL (from Vercel)

## Step 1: Create Firebase Project (5 minutes)

1. Visit https://console.firebase.google.com/
2. Click **"Add Project"**
3. Enter project name (e.g., "SariPayroo POS")
4. Click **Continue** → Accept terms → **Create Project**
5. Wait for project to initialize

## Step 2: Enable Firestore Database

1. In Firebase Console, click **Firestore Database** (left menu)
2. Click **Create Database**
3. Choose **Start in production mode**
4. Select region closest to you (or default)
5. Click **Create**

## Step 3: Enable Cloud Storage

1. Click **Storage** (left menu)
2. Click **Get Started**
3. Accept defaults and click **Done**

## Step 4: Get Your Configuration

1. In Firebase Console, click **Project Settings** (gear icon, top left)
2. Go to **General** tab
3. Scroll down to find your Firebase SDK snippet
4. Look for the config object - it should look like:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcd1234efgh5678"
};
```

## Step 5: Add Environment Variables

1. Go to your Vercel project dashboard
2. Click **Settings** → **Environment Variables**
3. Add these variables with values from your Firebase config:

```
NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcd1234efgh5678
```

4. Click **Save** for each variable

## Step 6: Redeploy

1. Go to your Vercel project **Deployments**
2. Redeploy the latest version (or push a new commit to trigger auto-deploy)
3. Wait for deployment to complete

## Step 7: Set Firestore Security Rules

For production, update your Firestore rules:

1. In Firebase Console, go **Firestore Database** → **Rules**
2. Replace with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

3. Click **Publish**

**Note:** For production, implement proper authentication and RLS policies.

## Step 8: Test the System

1. Go to your POS system URL
2. You should see the /setup page showing ✓ Green checkmarks
3. Navigate to **Inventory** and try:
   - Adding a category
   - Adding a product
   - Scanning a barcode (camera will request permission)

4. Go to **E-Wallet** and try:
   - Configuring commission rates
   - Processing a test transaction

## Troubleshooting

### "Firebase not configured" error
- Check that all 6 environment variables are added in Vercel
- Make sure there are no typos in the variable names
- Redeploy after adding variables
- Clear browser cache

### Camera not working for barcode scanner
- Allow camera access when prompted by browser
- Make sure you're on HTTPS (camera only works on secure connection)
- Try manual barcode entry instead
- Check browser camera permissions

### Database operations failing
- Make sure Firestore database is created
- Check Firestore Rules allow read/write
- Verify API Key has Firestore access

### Products/Categories not saving
- Check Firestore Database in Firebase Console
- Look for "products", "categories", "ewalletTransactions" collections
- If not there, they'll be created on first use

## Features Now Available

Once Firebase is configured:

✅ **Inventory Management**
- Add/edit/delete products
- Upload product images
- Manage categories
- Track stock levels

✅ **Point of Sale**
- Barcode/QR code scanning
- Quick checkout with cart
- Multiple payment methods
- Automatic stock deduction

✅ **E-Wallet Services**
- GCash and Maya cash-in/out
- Customizable commission rates
- Transaction history
- Profit tracking

✅ **Reports & Analytics**
- Daily sales tracking
- E-wallet commission tracking
- Date range filtering
- Export to CSV

## Getting Help

- Visit /setup page for configuration status
- Check browser console (F12) for error messages
- Visit Firebase Console to verify database/storage creation

Happy selling! 🎉
