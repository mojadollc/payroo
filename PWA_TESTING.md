# PWA Testing Checklist

## Quick Test (5 minutes)

### 1. Verify Manifest
- [ ] Open DevTools (F12)
- [ ] Go to **Application** tab
- [ ] Click **Manifest** in left sidebar
- [ ] Verify all fields load without errors:
  - `name`: "88 Seven Retail Store"
  - `short_name`: "88 Seven POS"
  - `start_url`: "/pos"
  - `display`: "standalone"
  - `icons`: 2 icons listed (192x192, 512x512)

### 2. Verify Service Worker
- [ ] In DevTools, go to **Application** → **Service Workers**
- [ ] Verify status shows **activated and running**
- [ ] Check scope is `/`

### 3. Verify Install Prompt
- [ ] Refresh the page
- [ ] Look for **orange alert at bottom** with "Install Payroo POS"
- [ ] Click **Install** button
- [ ] Browser should show native install dialog
- [ ] Confirm installation
- [ ] App should appear on home screen / app drawer

### 4. Verify Icons
- [ ] In DevTools → **Application** → **Manifest**
- [ ] Click each icon URL
- [ ] Verify images load correctly (192x192 and 512x512)

### 5. Test Offline
- [ ] Open DevTools → **Network** tab
- [ ] Check **Offline** checkbox
- [ ] Refresh page
- [ ] App should still load (with cached assets)
- [ ] Uncheck **Offline** to restore connection

---

## Detailed Test (15 minutes)

### Desktop Chrome/Edge

**Test 1: Install Prompt**
```
1. Open app in Chrome/Edge
2. Look for install icon in address bar (⬇️ icon)
3. Click install icon
4. Confirm in dialog
5. App should open in standalone window
6. Verify no browser UI visible
```

**Test 2: Offline Access**
```
1. Open DevTools (F12)
2. Go to Network tab
3. Check "Offline" checkbox
4. Refresh page (Ctrl+R)
5. App should load from cache
6. Navigate between pages
7. All pages should work offline
```

**Test 3: Cache Storage**
```
1. Open DevTools → Application
2. Go to Cache Storage
3. Expand "88seven-v1"
4. Verify cached assets are listed
5. Should include HTML, CSS, JS, images
```

### Mobile Chrome (Android)

**Test 1: Install from Menu**
```
1. Open app in Chrome
2. Tap menu (⋮) at top right
3. Look for "Install app" option
4. Tap "Install app"
5. Confirm in dialog
6. App should appear in app drawer
7. Launch from app drawer
8. Verify standalone mode (no browser UI)
```

**Test 2: Install from Prompt**
```
1. Open app in Chrome
2. Look for install banner at bottom
3. Tap "Install" button
4. Confirm in dialog
5. App should appear in app drawer
```

**Test 3: Offline Access**
```
1. Open installed app
2. Turn on Airplane mode
3. Refresh page
4. App should load from cache
5. Navigate between pages
6. All pages should work offline
7. Turn off Airplane mode
```

### Mobile Safari (iOS)

**Test 1: Add to Home Screen**
```
1. Open app in Safari
2. Tap Share button (⬆️ in box)
3. Scroll down and tap "Add to Home Screen"
4. Enter app name (or keep default)
5. Tap "Add"
6. App should appear on home screen
7. Tap to launch
8. Verify standalone mode
```

**Test 2: Offline Access**
```
1. Open installed app
2. Turn on Airplane mode
3. Refresh page
4. App should load from cache
5. Navigate between pages
6. Turn off Airplane mode
```

---

## Verification Checklist

### Manifest ✅
- [ ] Manifest file exists at `/public/manifest.json`
- [ ] All required fields present
- [ ] Icons are valid PNG files
- [ ] Start URL is correct
- [ ] Display mode is "standalone"

### Service Worker ✅
- [ ] Service worker file exists at `/public/sw.js`
- [ ] Registered in `app/layout.tsx`
- [ ] Shows as "activated and running" in DevTools
- [ ] Handles fetch events

### Install Prompt ✅
- [ ] Component exists at `components/pwa-install-prompt.tsx`
- [ ] Imported on all major pages:
  - [ ] Home page (`app/page.tsx`)
  - [ ] POS page (`app/pos/page.tsx`)
  - [ ] Dashboard page (`app/dashboard/page.tsx`)
  - [ ] Management page (`app/management/page.tsx`)
- [ ] Prompt appears on first visit
- [ ] Prompt hides after installation
- [ ] Dismiss button (X) works

### Icons ✅
- [ ] `public/icon-192.png` exists
- [ ] `public/icon-512.png` exists
- [ ] `public/apple-icon.png` exists
- [ ] All icons are valid PNG files
- [ ] Icons have correct dimensions

### Metadata ✅
- [ ] Manifest linked in `<head>`
- [ ] Apple web app meta tags present
- [ ] Viewport meta tag configured
- [ ] Theme color set

---

## Expected Behavior

### First Visit
```
User opens app
    ↓
Browser detects PWA capability
    ↓
Install prompt appears at bottom
    ↓
User can click "Install" or dismiss
```

### After Installation
```
User clicks "Install"
    ↓
Browser shows native install dialog
    ↓
User confirms
    ↓
App added to home screen / app drawer
    ↓
Prompt no longer shows on subsequent visits
```

### Offline Mode
```
User opens installed app
    ↓
Service worker intercepts requests
    ↓
Serves cached assets
    ↓
App works without internet
    ↓
Data syncs when connection restored
```

---

## Common Issues & Solutions

### Issue: Prompt Not Showing

**Cause**: App already installed
- **Solution**: Uninstall app and reload page

**Cause**: Browser doesn't support PWA
- **Solution**: Use Chrome, Edge, or Safari (latest versions)

**Cause**: HTTPS not enabled
- **Solution**: PWA requires HTTPS (not HTTP)

**Cause**: Manifest not loading
- **Solution**: Check DevTools → Application → Manifest for errors

### Issue: App Won't Install

**Cause**: Manifest has errors
- **Solution**: Check DevTools console for manifest errors

**Cause**: Icons missing
- **Solution**: Verify all icon files exist in `/public/`

**Cause**: Service worker not registered
- **Solution**: Check DevTools → Application → Service Workers

### Issue: Offline Not Working

**Cause**: Service worker not active
- **Solution**: Check DevTools → Application → Service Workers

**Cause**: Cache not populated
- **Solution**: Visit app pages to populate cache first

**Cause**: Browser cache cleared
- **Solution**: Reload page to rebuild cache

---

## Performance Metrics

### Load Time
- **First Load**: ~2-3 seconds (normal)
- **Cached Load**: ~0.5-1 second (after installation)
- **Offline Load**: ~0.5-1 second (from cache)

### Cache Size
- **Total Cache**: ~5-10 MB (typical)
- **Manifest**: ~0.5 KB
- **Service Worker**: ~1 KB
- **Assets**: ~5-10 MB

### Browser Support
- ✅ Chrome 90+
- ✅ Edge 90+
- ✅ Firefox 92+
- ✅ Safari 16.4+
- ✅ Samsung Internet 14+

---

## Test Results Template

```
Date: _______________
Tester: _______________
Browser: _______________
Device: _______________

Manifest: ☐ Pass ☐ Fail
Service Worker: ☐ Pass ☐ Fail
Install Prompt: ☐ Pass ☐ Fail
Installation: ☐ Pass ☐ Fail
Offline Access: ☐ Pass ☐ Fail
Icons: ☐ Pass ☐ Fail
Performance: ☐ Pass ☐ Fail

Notes:
_________________________________
_________________________________
_________________________________
```

---

## Next Steps

1. **Test on Multiple Devices**
   - Desktop Chrome
   - Desktop Safari
   - Android Chrome
   - iOS Safari

2. **Monitor Performance**
   - Check cache hit rates
   - Monitor offline usage
   - Track installation rates

3. **Gather User Feedback**
   - Ask users about install experience
   - Monitor support tickets
   - Track adoption metrics

4. **Optimize**
   - Improve cache strategy
   - Add more offline features
   - Enhance install prompt

---

**Last Updated**: 2024
**Status**: Ready for Testing
