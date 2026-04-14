# Feature Testing Guide

After Firebase is configured, test these three main features:

## 1. Category Management (Add & Save)

**Location:** Inventory → Category Manager tab

### Test Steps:
1. Scroll to "Add New Category" section
2. Enter category name: `Test Category`
3. Enter description: `Testing category add`
4. Click **Add Category** button
5. Verify:
   - Success toast notification appears
   - New category appears in the grid below
   - Form fields clear after submission
   - Refresh page - category should still be there

### What happens behind the scenes:
- Category is saved to Firestore `categories` collection
- Category ID is auto-generated
- Timestamp is recorded
- UI updates immediately

### If it doesn't work:
- Check browser console (F12) for error messages
- Verify Firebase environment variables are set
- Make sure Firestore database is created in Firebase Console
- Check Firestore Rules allow write access

---

## 2. Barcode/QR Scanner (Camera + Manual Entry)

**Location:** POS Page → Click "Scan Barcode" button

### Test Steps:

#### Camera Scanning:
1. Click "Scan Barcode" button
2. Browser will request camera permission - **Allow it**
3. You should see:
   - Live camera feed
   - Crosshair in center
   - "Point camera at barcode" text
4. Positioning camera:
   - For testing without barcodes, use the manual entry
   - Real barcodes work best at 6-12 inches away
   - Good lighting helps detection

#### Manual Entry:
1. In scanner dialog, scroll to "Enter barcode number"
2. Type a test barcode: `123456789`
3. Click **Confirm Barcode**
4. Verify:
   - Product lookup works if barcode exists
   - If product found, it adds to cart
   - Dialog closes

### Camera Not Working - Try These:
1. **Permission Issue:**
   - Check browser address bar for camera icon
   - Click to see permissions
   - Allow camera access
   - Refresh page

2. **HTTPS Required:**
   - Camera only works on HTTPS
   - Vercel URLs are HTTPS by default
   - Localhost also works

3. **Alternative - Use Manual Entry:**
   - Type barcode manually - this always works
   - Great for testing without actual barcodes

### What happens behind the scenes:
- Camera stream is captured via `navigator.mediaDevices.getUserMedia()`
- Barcode gets looked up in Firestore
- If found, product details load and add to cart
- Manual entry bypasses camera, allows any string

---

## 3. Commission Settings (E-Wallet)

**Location:** E-Wallet Page → Click "Commission Settings" button

### Test Steps:
1. On E-Wallet page, click **Commission Settings** (gear icon)
2. Dialog opens showing current rates:
   - GCash Cash-In: %
   - GCash Cash-Out: %
   - Maya Cash-In: %
   - Maya Cash-Out: %

3. Update a rate:
   - Change GCash Cash-In to: `2.5`
   - Watch example calculation update below
   - Verify: Shows "₱25.00 commission on ₱1,000"

4. Save Settings:
   - Click **Save Settings**
   - Success toast appears
   - Dialog closes
   - Settings persist in Firestore

5. Verify persistence:
   - Refresh page
   - Open Commission Settings again
   - Your custom rates should still be there

### Rate Format:
- Rates are in **percentage** (0-100)
- Enter as decimal: `2.5` for 2.5%
- Displayed as: "2.50%"
- Stored as decimal: `0.025`

### Example:
- GCash Cash-In: 2.5%
- Customer deposits: ₱1,000
- Your commission: ₱25
- Your profit: +₱25

### What happens behind the scenes:
- Rates saved to Firestore `commissionSettings` collection
- Used in all GCash/Maya transactions
- Real-time calculations on transaction forms
- Profit tracking in reports uses these rates

### If it doesn't work:
- Check if commission settings exist in Firestore
- Verify all 4 rate fields have valid values (0-100)
- Make sure Firestore write permissions are enabled
- Check browser console for validation errors

---

## Complete Feature Testing Checklist

- [ ] **Categories Saved**
  - Add category
  - Refresh page
  - Category still there

- [ ] **Barcode Scanner Working**
  - Camera opens with permission
  - Can type manual barcode
  - Barcode lookup works
  - Product added to cart

- [ ] **Commission Settings Saved**
  - Change rates
  - Save settings
  - Refresh page
  - Rates still saved

---

## System Status Dashboard

Check `/setup` page anytime to see:
- ✓ Green checkmark = Firebase configured
- ✗ Red X = Missing environment variables
- If red, go back to FIREBASE_SETUP.md

---

## Transaction Flow (After Features Work)

### Complete POS Sale:
1. Inventory → Add products with barcodes
2. POS → Scan barcodes, add to cart
3. Complete checkout with payment method
4. Stock automatically deducts
5. Reports → View sales and profit

### E-Wallet Transactions:
1. E-Wallet → Set commission rates
2. Process cash-in or cash-out
3. Commission calculated automatically
4. Transaction history shows all activity
5. Reports → View e-wallet earnings

---

## Testing Tips

**Test Barcodes to Try:**
- Use product codes: `123456789`, `987654321`
- Add these as product barcodes first, then scan them
- Create simple numeric codes for testing

**Camera Testing:**
- Use QR code generator online
- Print or display on phone
- Point laptop camera at it to test recognition

**Best Practices:**
- Test on actual Vercel deployment, not localhost
- Test on mobile device with real camera
- Test on different browsers (Chrome, Firefox, Safari)
- Test all commission rates (0%, 5%, 10%)
