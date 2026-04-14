# Get Your POS System Running RIGHT NOW - 10 Min Setup

## What You Have
✅ Fully built POS system (Categories, Barcode Scanner, Commission Settings)
❌ Missing: Firebase database connection (environment variables)

## The Problem
Without Firebase credentials, the app can't save data to the database.

## The Solution (10 minutes)

### Step 1: Get Firebase Credentials (5 minutes)

1. Open: https://console.firebase.google.com/
2. Click **"+ Add Project"**
3. Name it: `SariPayroo POS` → Continue → Create
4. Wait for Firebase to initialize...
5. Click **"Firestore Database"** in left menu
6. Click **"Create Database"** → Production mode → Create
7. Click **"Storage"** in left menu → **"Get Started"** → Done

### Step 2: Copy Your Config (2 minutes)

1. Click ⚙️ **Settings** icon (top left) → **Project Settings**
2. Find this code section at bottom:

```javascript
const firebaseConfig = {
  apiKey: "COPY_THIS",
  authDomain: "COPY_THIS",
  projectId: "COPY_THIS", 
  storageBucket: "COPY_THIS",
  messagingSenderId: "COPY_THIS",
  appId: "COPY_THIS"
};
```

**Copy each value - you'll need them next**

### Step 3: Add to Your POS App (3 minutes)

1. Go to your **Vercel project settings**
2. Click **Settings** → **Environment Variables**
3. Add these 6 variables:

```
NEXT_PUBLIC_FIREBASE_API_KEY = [apiKey value]
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = [authDomain value]
NEXT_PUBLIC_FIREBASE_PROJECT_ID = [projectId value]
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = [storageBucket value]
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = [messagingSenderId value]
NEXT_PUBLIC_FIREBASE_APP_ID = [appId value]
```

4. Click **Save** after each one
5. **Redeploy** your project (or wait for auto-deploy)

### Done! ✨

Your app should now be fully functional.

---

## Test These 3 Features

### 1. Add a Category (Inventory Page)
- Go to Inventory tab
- Find "Add New Category"
- Type `Test` as name
- Click **Add Category**
- ✓ You should see success message and category appear below

### 2. Use Barcode Scanner (POS Page)  
- Click **"Scan Barcode"** button
- Allow camera permission when prompted
- Type `123456789` in the text field
- Click **Confirm Barcode**
- ✓ You should see the scanner accept the barcode

### 3. Set Commission Rates (E-Wallet Page)
- Click **Commission Settings** (gear icon)
- Change GCash Cash-In to `2.5`
- Click **Save Settings**
- ✓ You should see success message
- Refresh page - rates should still be there

---

## If Something Doesn't Work

### "Firebase not configured" error
→ Redeploy your Vercel project after adding environment variables

### Camera not working in scanner
→ Allow camera permission when browser asks
→ Or just type the barcode manually (it works!)

### Can't see added categories after refresh
→ Check Firebase Console that Firestore database exists
→ Check environment variables are spelled correctly

### Commission rates don't save
→ Make sure all 6 Firebase environment variables are set
→ Redeploy after adding variables

---

## What Each Feature Does

**📦 Category Manager**
- Organize inventory into categories
- Add product categories like: Drinks, Snacks, Basics
- Delete categories you don't need
- Data saves to Firestore database

**📱 Barcode Scanner**  
- Scan product barcodes with laptop/phone camera
- Works on HTTPS (Vercel is HTTPS)
- Camera permission required first time
- Manual barcode entry also works
- Add scanned products directly to cart

**💳 Commission Settings**
- Set what % you earn on GCash/Maya transactions
- Separate rates for cash-in and cash-out
- Examples: 2.5% = ₱25 commission on ₱1,000
- Rates apply to all transactions automatically

---

## Your Complete System Now Has

✅ **Inventory Management**
- Add/edit products with images
- Organize by categories
- Track stock levels

✅ **Point of Sale**
- Barcode/QR code scanning
- Shopping cart
- Multiple payment methods
- Auto stock deduction

✅ **E-Wallet Processing**
- GCash & Maya support
- Custom commission rates
- Transaction tracking

✅ **Reports & Analytics**
- Daily sales reports
- Profit tracking
- Date filtering
- CSV export

---

## Next Steps After Setup

1. **Add Your First Products**
   - Inventory → Add Product
   - Upload product image
   - Set barcode number
   - Set price and cost

2. **Configure Categories**
   - Inventory → Add New Category
   - Create categories for your products

3. **Set Commission Rates**
   - E-Wallet → Commission Settings
   - Set your preferred rates

4. **Make Your First Sale**
   - POS → Scan barcode
   - Add to cart
   - Complete checkout
   - Watch profit update in Reports

---

## Support

Need help? Check these files:
- `FIREBASE_SETUP.md` - Detailed Firebase setup
- `FEATURE_TEST_GUIDE.md` - Complete feature testing
- `/setup` page - Configuration status (green = ready)

---

**You're ready to go! Your POS system is production-ready.** 🚀
