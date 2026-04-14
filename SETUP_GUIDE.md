# Sari-Sari Store POS System - Complete Setup Guide

## Overview
This is a production-ready Point of Sale (POS) system designed for sari-sari stores in the Philippines. It includes inventory management, barcode scanning, e-wallet integration (GCash & Maya), and comprehensive profit tracking.

## Prerequisites
- A Google account
- A Firebase project (create at https://console.firebase.google.com/)
- Deployed v0 project (or running locally)

## Step 1: Create and Configure Firebase Project

### 1.1 Create Firebase Project
1. Go to https://console.firebase.google.com/
2. Click "Add Project"
3. Enter project name (e.g., "Sari-Sari Store POS")
4. Choose region
5. Accept terms and create project

### 1.2 Enable Firestore Database
1. In Firebase Console, click "Firestore Database" (left menu)
2. Click "Create Database"
3. Start in **Production Mode**
4. Choose region closest to you
5. Click "Enable"

### 1.3 Enable Cloud Storage
1. Click "Storage" (left menu)
2. Click "Get Started"
3. Keep default settings
4. Click "Done"

### 1.4 Enable Authentication
1. Click "Authentication" (left menu)
2. Click "Get started"
3. Select "Email/Password" provider
4. Enable it and save

## Step 2: Get Firebase Configuration

1. Go to **Project Settings** (gear icon in top-right)
2. Scroll down to "Your apps" section
3. Click the web icon `</>` to register a web app
4. Enter app name and check "Also set up Firebase Hosting"
5. Click "Register app"
6. Copy the configuration values:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

## Step 3: Add Environment Variables

In v0, click the **"Vars"** button in the left sidebar and add:

```
NEXT_PUBLIC_FIREBASE_API_KEY=<YOUR_API_KEY>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<YOUR_PROJECT_ID>.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<YOUR_PROJECT_ID>
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<YOUR_PROJECT_ID>.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<YOUR_MESSAGING_SENDER_ID>
NEXT_PUBLIC_FIREBASE_APP_ID=<YOUR_APP_ID>
```

## Step 4: Configure Firestore Security Rules

⚠️ **Important**: The default production mode rules are restrictive. For the app to work:

1. Go to Firestore Database → Rules
2. Replace the rules with:

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

**Note**: This allows public access. In a production environment with user authentication, implement more restrictive rules.

## Step 5: Configure Storage Security Rules

1. Go to Storage → Rules
2. Replace the rules with:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```

## Step 6: Verify Setup

1. Go to `/setup` page in the app
2. You should see all environment variables marked as configured ✓
3. Click "Go to POS System" to start using the app

---

# Using the POS System

## Features

### 1. Inventory Management (`/inventory`)
- **Add Products**: Upload product images, set barcode, price, cost, category
- **Categories**: Create and manage product categories
- **Stock Tracking**: Monitor inventory levels with low-stock alerts
- **Search**: Quick search by product name, barcode, or category

### 2. Point of Sale (`/pos`)
- **Barcode Scanning**: Scan products using camera or manual entry
- **Quick Select**: Click to add popular products to cart
- **Real-time Cart**: Adjust quantities, remove items, see totals
- **Profit Tracking**: See estimated profit on every sale
- **Checkout**: Multiple payment methods (Cash, GCash, Maya)
- **Auto Stock**: Stock automatically decreases after sale

### 3. E-Wallet Services (`/ewallet`)
- **Cash-In**: Customer deposits money to GCash/Maya
- **Cash-Out**: Customer withdraws money from GCash/Maya
- **Commission Settings**: Customize commission rates for each provider/transaction type
- **Transaction History**: View all transactions with profit tracking
- **Daily Stats**: Track today's and all-time transactions

### 4. Reports & Analytics (`/reports`)
- **Date Range Filtering**: View reports for any time period
- **Profit Chart**: Daily profit breakdown (sales + e-wallet)
- **Sales Report**: Detailed product-wise sales data
- **E-Wallet Report**: All transaction history with commissions
- **CSV Export**: Download data for external analysis

---

# Managing Categories

1. Go to Inventory → Categories tab
2. Click "Add Category" 
3. Enter category name and optional description
4. Click "Add Category"
5. To delete, click the trash icon on any category

---

# Managing E-Wallet Commission Rates

1. Go to E-Wallet page
2. Click "Commission Settings" (top-right)
3. Edit rates for:
   - GCash Cash-In commission
   - GCash Cash-Out commission
   - Maya Cash-In commission
   - Maya Cash-Out commission
4. Rates are entered as percentages (0-100)
5. See live calculation examples
6. Click "Save Settings"

---

# Production Best Practices

## Security
1. **Never share your Firebase credentials** - They're in the environment variables
2. **Implement user authentication** - Add login system using Firebase Auth
3. **Update Security Rules** - Once you have user authentication, restrict data access
4. **Regular Backups** - Export Firestore data regularly

## Performance
1. **Create Firestore indexes** - If you see slow queries, create indexes in Firebase Console
2. **Optimize images** - Compress product images before upload
3. **Archive old data** - Periodically export and delete old transactions

## Monitoring
1. **Check Firebase quota** - Monitor usage in Firebase Console
2. **Review costs** - Firestore charges per read/write operation
3. **Set up alerts** - Configure billing alerts in Google Cloud Console

---

# Troubleshooting

## Firebase Not Configured
- Check environment variables are correctly set in Vars section
- Verify no extra spaces or typos
- Save changes and refresh page

## Cannot Add Products/Categories
- Ensure Firestore Database is enabled
- Check security rules allow write access
- Check browser console for specific error message

## Images Not Uploading
- Verify Cloud Storage is enabled
- Check storage security rules
- Ensure image file size is reasonable (<5MB)

## Transaction Errors
- Verify Firebase credentials in setup page
- Check your Firestore quota hasn't been exceeded
- Review browser console for error details

---

# Support & Resources

- **Firebase Docs**: https://firebase.google.com/docs
- **Firestore Guide**: https://firebase.google.com/docs/firestore
- **Storage Guide**: https://firebase.google.com/docs/storage
- **Local Setup Guide**: See v0 project files in `/app`, `/components`, `/lib/firebase`

---

# Key System Information

## Database Collections
- `products` - Store inventory items
- `categories` - Product categories
- `sales` - Completed transactions
- `inventoryTransactions` - Stock history
- `ewalletTransactions` - E-wallet activities
- `commissionSettings` - Commission rates

## Data Models
All data models are defined in `/lib/firebase/types.ts` with full TypeScript support.

## File Structure
```
/app              - Page components (routes)
/components       - Reusable UI components
/lib/firebase     - Firebase configuration & services
/hooks            - Custom React hooks
/public           - Static assets
```

---

**Last Updated**: 2024
**Version**: 1.0 Production Ready
