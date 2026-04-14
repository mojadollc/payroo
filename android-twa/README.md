# Payroo POS — Android TWA (Trusted Web Activity)

This is a native Android wrapper for the Payroo POS web app at `https://payroo.xyz`.
It uses **Trusted Web Activity (TWA)** to load your PWA inside a native Android shell —
no browser UI, full-screen, feels like a native app.

## Prerequisites

- **Java JDK 17** (already installed ✅)
- **Android Studio** — download from https://developer.android.com/studio
- **Google Play Developer account** ($25 one-time fee) — https://play.google.com/console

## Quick Start (Android Studio — Recommended)

### 1. Open the project
```
Open Android Studio → File → Open → select the `android-twa/` folder
```
Android Studio will download Gradle, SDK, and dependencies automatically.

### 2. Copy your app icon
Replace the placeholder icons in `app/src/main/res/mipmap-*/` folders with your actual app icon.
Use Android Studio's **Image Asset Studio**:
- Right-click `res/` → New → Image Asset
- Select your `icon-512.png` from the web project
- It generates all density variants automatically

### 3. Build the AAB (for Google Play)
```
Android Studio → Build → Generate Signed Bundle / APK → Android App Bundle
```
- Select the existing keystore: `keystore/payroo-upload.keystore`
- Password: `payroo2024`
- Key alias: `payroo-upload`
- Key password: `payroo2024`

Or from terminal:
```bash
cd android-twa
./gradlew bundleRelease
```
The AAB file will be at: `app/build/outputs/bundle/release/app-release.aab`

### 4. Build APK (for direct install / testing)
```bash
cd android-twa
./gradlew assembleRelease
```
The APK will be at: `app/build/outputs/apk/release/app-release.apk`

## CRITICAL: Deploy assetlinks.json

For the TWA to work without showing the browser URL bar, Android must verify that
your app owns the website. This is done via Digital Asset Links.

### Step 1: Deploy the file
The file `public/.well-known/assetlinks.json` has already been created.
Deploy your web app to Firebase:
```bash
npm run build
firebase deploy --only hosting
```

### Step 2: Verify it works
Visit: `https://payroo.xyz/.well-known/assetlinks.json`
It should return the JSON with your app's SHA-256 fingerprint.

### Step 3: Test with Google's tool
https://developers.google.com/digital-asset-links/tools/generator
- Hosting site domain: `payroo.xyz`
- App package name: `xyz.payroo.twa`
- App package fingerprint (SHA256): `93:E3:E7:51:95:FD:32:DF:2B:89:E4:F3:20:A9:74:39:49:1E:15:09:CD:C2:25:0F:F4:66:F8:BD:35:75:9D:AE`

## Google Play Store Upload

### 1. Create your app listing
- Go to https://play.google.com/console
- Create a new app → fill in name, description, screenshots, etc.

### 2. Upload the AAB
- Go to **Production** → **Create new release**
- Upload `app-release.aab`
- Google Play will re-sign with their key — you'll need to update `assetlinks.json`
  with Google Play's SHA-256 fingerprint (found in Play Console → Setup → App signing)

### 3. Update assetlinks.json with Play Store fingerprint
After uploading, Google Play Console → Setup → App signing shows the **SHA-256 certificate fingerprint**.
Add it to `public/.well-known/assetlinks.json`:
```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "xyz.payroo.twa",
      "sha256_cert_fingerprints": [
        "93:E3:E7:51:95:FD:32:DF:2B:89:E4:F3:20:A9:74:39:49:1E:15:09:CD:C2:25:0F:F4:66:F8:BD:35:75:9D:AE",
        "PASTE_GOOGLE_PLAY_SHA256_HERE"
      ]
    }
  }
]
```
Then redeploy: `firebase deploy --only hosting`

## Keystore Security

⚠️ **IMPORTANT**: The keystore at `keystore/payroo-upload.keystore` is your signing key.
- **Back it up** — if you lose it, you can never update your app on Google Play
- **Change the password** before publishing: use a strong password and store it securely
- **Do NOT commit** the keystore to a public git repo

To change the keystore password:
```bash
keytool -storepasswd -keystore keystore/payroo-upload.keystore
```

## Project Structure

```
android-twa/
├── app/
│   ├── build.gradle              # App dependencies & signing config
│   └── src/main/
│       ├── AndroidManifest.xml   # TWA configuration
│       └── res/
│           ├── drawable/splash.xml
│           ├── values/colors.xml
│           ├── values/strings.xml
│           ├── values/styles.xml
│           └── xml/filepaths.xml
├── keystore/
│   └── payroo-upload.keystore    # Signing key (BACK THIS UP!)
├── build.gradle                  # Root build config
├── settings.gradle
├── gradle.properties
├── gradlew                       # Build script (macOS/Linux)
└── README.md                     # This file
```

## Troubleshooting

### Browser URL bar showing
- `assetlinks.json` is not deployed or has wrong fingerprint
- Clear Chrome data on the test device and try again
- Use the Digital Asset Links tool to verify

### App crashes on launch
- Make sure `https://payroo.xyz` is accessible
- Check that Chrome is installed and updated on the device

### Build fails
- Open in Android Studio and let it sync Gradle
- Make sure JAVA_HOME points to JDK 17
