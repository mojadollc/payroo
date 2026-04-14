# Firebase Hosting Deployment Guide

## Overview

Your Payroo POS app is configured to deploy to Firebase Hosting with Next.js support. This guide walks you through the complete deployment process.

**Your Firebase Project**: `sari-pos-88979`

---

## Prerequisites

### 1. Install Firebase CLI
```bash
npm install -g firebase-tools
```

Or if you prefer using Homebrew (macOS):
```bash
brew install firebase-tools
```

### 2. Verify Installation
```bash
firebase --version
```

Should output something like: `firebase-tools/13.x.x`

### 3. Ensure You Have Node.js
```bash
node --version
npm --version
```

Required: Node.js 18+ and npm 9+

---

## Step-by-Step Deployment

### Step 1: Login to Firebase

```bash
firebase login
```

This will:
- Open your browser
- Ask you to sign in with your Google account
- Grant Firebase CLI access to your projects
- Return to terminal when complete

**Verify login:**
```bash
firebase projects:list
```

Should show `sari-pos-88979` in the list.

### Step 2: Navigate to Your Project

```bash
cd /Users/macbook/Documents/pos-app-for-stores
```

### Step 3: Install Dependencies

```bash
npm install
```

Or if using pnpm:
```bash
pnpm install
```

### Step 4: Build the Next.js App

```bash
npm run build
```

This will:
- Compile TypeScript
- Bundle React components
- Optimize assets
- Generate `.next` folder
- Create production build

**Expected output:**
```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages (X/X)
✓ Finalizing page optimization
Route (pages)                              Size     First Load JS
...
```

### Step 5: Deploy to Firebase Hosting

```bash
firebase deploy --only hosting
```

This will:
- Build the app (if not already built)
- Upload to Firebase Hosting
- Deploy service worker
- Deploy manifest and assets
- Show deployment URL

**Expected output:**
```
=== Deploying to 'sari-pos-88979'...

i  deploying hosting
i  hosting: preparing .next directory for upload...
✔  hosting: 123 files uploaded successfully
✔  Deploy complete!

Project Console: https://console.firebase.google.com/project/sari-pos-88979
Hosting URL: https://sari-pos-88979.web.app
```

---

## Deployment Options

### Option A: Deploy Everything (Recommended)

```bash
firebase deploy
```

Deploys:
- ✅ Hosting
- ✅ Firestore rules
- ✅ Firestore indexes
- ✅ Cloud Functions (if any)

### Option B: Deploy Only Hosting

```bash
firebase deploy --only hosting
```

Faster if you only changed frontend code.

### Option C: Deploy with Custom Message

```bash
firebase deploy --message "PWA update with install prompts"
```

Helps track deployment history.

### Option D: Deploy Specific Regions

```bash
firebase deploy --only hosting:default
```

---

## Verify Deployment

### 1. Check Hosting URL

Your app is now live at:
```
https://sari-pos-88979.web.app
```

Or with custom domain (if configured):
```
https://your-domain.com
```

### 2. Test PWA Features

**On Desktop:**
```
1. Open https://sari-pos-88979.web.app
2. Look for install icon in address bar
3. Click to install
4. Verify app launches in standalone mode
```

**On Mobile:**
```
1. Open in Chrome/Safari
2. Look for install prompt at bottom
3. Tap "Install"
4. Verify app appears on home screen
```

### 3. Verify Service Worker

```
1. Open DevTools (F12)
2. Go to Application → Service Workers
3. Verify status: "activated and running"
4. Check scope: "/"
```

### 4. Verify Manifest

```
1. Open DevTools → Application
2. Click "Manifest" in sidebar
3. Verify all fields load correctly
4. Check icons are accessible
```

### 5. Test Offline

```
1. Open DevTools → Network
2. Check "Offline" checkbox
3. Refresh page
4. App should load from cache
```

---

## Deployment Checklist

Before deploying, verify:

- [ ] All code changes committed
- [ ] No console errors in development
- [ ] `npm run build` completes successfully
- [ ] PWA files present:
  - [ ] `/public/manifest.json`
  - [ ] `/public/sw.js`
  - [ ] `/public/icon-192.png`
  - [ ] `/public/icon-512.png`
  - [ ] `/public/apple-icon.png`
- [ ] PWA component imported on all pages:
  - [ ] `app/page.tsx`
  - [ ] `app/pos/page.tsx`
  - [ ] `app/dashboard/page.tsx`
  - [ ] `app/management/page.tsx`
- [ ] Firebase config correct in `.firebaserc`
- [ ] No sensitive data in code
- [ ] Environment variables set (if needed)

---

## Post-Deployment

### 1. Monitor Deployment

```bash
firebase hosting:channel:list
```

Shows all deployment channels and versions.

### 2. View Deployment History

```bash
firebase hosting:releases:list
```

Shows all previous deployments with timestamps.

### 3. Rollback to Previous Version

```bash
firebase hosting:releases:rollback
```

Reverts to the previous deployment.

### 4. Check Hosting Status

```bash
firebase hosting:sites:list
```

Shows all hosting sites for your project.

---

## Continuous Deployment (Optional)

### Setup GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Firebase Hosting

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Build
        run: npm run build
      
      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          channelId: live
          projectId: sari-pos-88979
```

### Setup Firebase Service Account

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Project Settings → Service Accounts
3. Click "Generate New Private Key"
4. Save the JSON file
5. In GitHub repo: Settings → Secrets → New repository secret
6. Name: `FIREBASE_SERVICE_ACCOUNT`
7. Paste the JSON content

Now every push to `main` branch auto-deploys!

---

## Troubleshooting

### Issue: "Cannot find module" errors

**Solution:**
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Issue: Build fails with TypeScript errors

**Solution:**
```bash
# Check for errors
npm run lint

# Fix common issues
npm run build -- --verbose
```

### Issue: Deployment fails with "Permission denied"

**Solution:**
```bash
# Re-login
firebase logout
firebase login

# Verify project
firebase projects:list
```

### Issue: Service worker not updating

**Solution:**
```bash
# Clear cache and redeploy
firebase hosting:disable
firebase deploy --only hosting
firebase hosting:enable
```

### Issue: PWA install prompt not showing

**Solution:**
1. Verify HTTPS is enabled (Firebase Hosting uses HTTPS by default ✅)
2. Check manifest loads: DevTools → Application → Manifest
3. Verify service worker is active: DevTools → Application → Service Workers
4. Clear browser cache and reload

### Issue: App shows old version after deployment

**Solution:**
```bash
# Hard refresh in browser
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (Mac)

# Or clear service worker cache
DevTools → Application → Service Workers → Unregister
```

---

## Performance Optimization

### 1. Enable Compression

Firebase Hosting automatically compresses assets. No action needed.

### 2. Enable Caching

Add to `firebase.json`:

```json
{
  "hosting": {
    "headers": [
      {
        "source": "**/*.@(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      }
    ]
  }
}
```

Then redeploy:
```bash
firebase deploy --only hosting
```

### 3. Monitor Performance

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select project `sari-pos-88979`
3. Go to Hosting → Analytics
4. View traffic, performance, errors

---

## Custom Domain (Optional)

### 1. Connect Custom Domain

```bash
firebase hosting:sites:create
```

Or via Firebase Console:
1. Go to Hosting → Custom domains
2. Click "Add custom domain"
3. Enter your domain
4. Follow DNS setup instructions

### 2. Verify Domain

Firebase will provide DNS records to add to your domain registrar.

### 3. SSL Certificate

Firebase automatically provisions SSL certificate (free).

---

## Environment Variables

If you need environment variables:

### 1. Create `.env.local`

```
NEXT_PUBLIC_FIREBASE_API_KEY=your_key
NEXT_PUBLIC_FIREBASE_PROJECT_ID=sari-pos-88979
```

### 2. Build with variables

```bash
npm run build
firebase deploy --only hosting
```

**Note:** Only `NEXT_PUBLIC_*` variables are available in browser.

---

## Deployment Commands Reference

```bash
# Login
firebase login

# List projects
firebase projects:list

# Deploy everything
firebase deploy

# Deploy only hosting
firebase deploy --only hosting

# Deploy with message
firebase deploy --message "PWA update"

# View deployment history
firebase hosting:releases:list

# Rollback to previous version
firebase hosting:releases:rollback

# View hosting sites
firebase hosting:sites:list

# Check deployment status
firebase hosting:channel:list

# Disable hosting
firebase hosting:disable

# Enable hosting
firebase hosting:enable
```

---

## Deployment Workflow

### Quick Deploy (5 minutes)

```bash
# 1. Make changes
# 2. Test locally
npm run dev

# 3. Build
npm run build

# 4. Deploy
firebase deploy --only hosting

# 5. Verify
# Open https://sari-pos-88979.web.app
```

### Full Deploy (10 minutes)

```bash
# 1. Update code
# 2. Commit changes
git add .
git commit -m "Add PWA install prompts"

# 3. Install dependencies
npm install

# 4. Build
npm run build

# 5. Deploy everything
firebase deploy

# 6. Verify all services
# - Hosting: https://sari-pos-88979.web.app
# - Firestore: Firebase Console
# - Functions: Firebase Console
```

---

## Monitoring & Maintenance

### Daily Checks

```bash
# View recent deployments
firebase hosting:releases:list --limit 5

# Check for errors
# Go to Firebase Console → Hosting → Analytics
```

### Weekly Checks

```bash
# Verify service worker is active
# Test PWA install on different devices
# Check offline functionality
# Monitor performance metrics
```

### Monthly Checks

```bash
# Review deployment history
firebase hosting:releases:list

# Check storage usage
# Review analytics
# Update dependencies
npm update
```

---

## Rollback Procedure

If something goes wrong:

### Quick Rollback

```bash
firebase hosting:releases:rollback
```

### Rollback to Specific Version

```bash
# List all versions
firebase hosting:releases:list

# Rollback to specific version
firebase hosting:releases:rollback --release-id=<version-id>
```

### Manual Rollback

```bash
# 1. Revert code changes
git revert <commit-hash>

# 2. Rebuild
npm run build

# 3. Redeploy
firebase deploy --only hosting
```

---

## Security Best Practices

✅ **Always use HTTPS** - Firebase Hosting enforces HTTPS
✅ **Never commit secrets** - Use environment variables
✅ **Validate user input** - Prevent XSS attacks
✅ **Use Firestore security rules** - Protect database
✅ **Enable authentication** - Protect sensitive pages
✅ **Monitor deployments** - Review deployment history
✅ **Keep dependencies updated** - Run `npm update` regularly

---

## Support & Resources

- [Firebase Hosting Docs](https://firebase.google.com/docs/hosting)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Firebase Console](https://console.firebase.google.com)
- [Firebase CLI Reference](https://firebase.google.com/docs/cli)

---

## Quick Reference

| Task | Command |
|------|---------|
| Login | `firebase login` |
| Build | `npm run build` |
| Deploy | `firebase deploy --only hosting` |
| View URL | `https://sari-pos-88979.web.app` |
| Rollback | `firebase hosting:releases:rollback` |
| History | `firebase hosting:releases:list` |
| Disable | `firebase hosting:disable` |
| Enable | `firebase hosting:enable` |

---

**Status**: ✅ Ready to Deploy
**Project**: sari-pos-88979
**Hosting URL**: https://sari-pos-88979.web.app
**Last Updated**: 2024
