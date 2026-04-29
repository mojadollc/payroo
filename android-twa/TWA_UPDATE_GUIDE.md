# Payroo POS TWA Update Guide

## 🔄 How TWA Updates Work

The Trusted Web Activity (TWA) has been enhanced to handle updates properly and prevent infinite loading loops.

## ✅ Update Features Implemented

### 1. **Cache-Busting URLs**
- TWA launches with timestamp parameter: `https://payroo.xyz/pos?v=1234567890`
- Ensures fresh content on every app launch
- Prevents stale cached content

### 2. **Custom Launcher Activity**
- `PayrooTWALauncher.java` extends the default TWA launcher
- Clears WebView cache on app resume
- Forces no-cache strategy for fresh content

### 3. **Single Task Launch Mode**
- Prevents multiple app instances
- Ensures clean app state on launch
- Reduces memory usage

### 4. **Automatic Version Updates**
- Version code auto-increments on build
- Version name includes timestamp
- Google Play handles automatic updates

## 🚀 Building the TWA

### Windows:
```bash
scripts\build-twa.bat
```

### Linux/Mac:
```bash
chmod +x scripts/build-twa.sh
scripts/build-twa.sh
```

## 📱 Deployment Process

1. **Build TWA** using the script above
2. **Test APK** on Android device
3. **Upload to Google Play Console**
4. **Publish Update** - users get automatic updates

## 🔧 Update Mechanism

### For Users:
1. **Automatic Updates** - Google Play updates the TWA app
2. **Fresh Content** - App always loads latest web content
3. **No Manual Refresh** - Cache-busting handles updates automatically

### For Developers:
1. **Deploy Web App** - `npm run deploy` updates the web version
2. **Build TWA** - `scripts/build-twa.bat` creates new APK
3. **Upload to Play Store** - Users get the updated TWA

## 🛠️ Technical Details

### Cache Strategy:
- **Web App**: Service Worker handles PWA updates
- **TWA**: Cache-busting URLs + WebView cache clearing
- **Result**: Always fresh content, no loading loops

### Version Management:
- **Web**: Service Worker version auto-updates on deploy
- **TWA**: APK version auto-updates on build
- **Sync**: Both stay in sync automatically

## 📋 Troubleshooting

### If TWA Gets Stuck Loading:
1. **Force Stop** the app
2. **Clear App Data** in Android settings
3. **Reopen** the app - it will load fresh content

### If Updates Don't Appear:
1. **Check Google Play** for pending updates
2. **Force Update** in Play Store
3. **Clear App Cache** if needed

## 🎯 Best Practices

1. **Always test** TWA builds before publishing
2. **Increment version** for each Play Store upload
3. **Deploy web updates** before TWA updates
4. **Monitor** user feedback for loading issues

## 📊 Update Flow

```
Web Deploy → Service Worker Updates → PWA Users Get Updates
     ↓
TWA Build → Play Store Upload → TWA Users Get Updates
```

Both PWA and TWA users stay synchronized with the latest version!