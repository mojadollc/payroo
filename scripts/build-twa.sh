#!/bin/bash

# Payroo POS TWA Build Script
# This script builds the Android TWA with automatic version updates

echo "🚀 Building Payroo POS TWA..."

# Navigate to TWA directory
cd "$(dirname "$0")/../android-twa"

# Get current timestamp for version
TIMESTAMP=$(date +%Y%m%d%H%M)
VERSION_CODE=$(($(date +%s) / 86400))  # Days since epoch
VERSION_NAME="2.0.$TIMESTAMP"

echo "📱 Updating TWA version to: $VERSION_NAME (code: $VERSION_CODE)"

# Update version in build.gradle
sed -i.bak "s/versionCode [0-9]*/versionCode $VERSION_CODE/" app/build.gradle
sed -i.bak "s/versionName \"[^\"]*\"/versionName \"$VERSION_NAME\"/" app/build.gradle

# Clean and build
echo "🧹 Cleaning previous build..."
./gradlew clean

echo "🔨 Building release APK..."
./gradlew assembleRelease

if [ $? -eq 0 ]; then
    echo "✅ TWA build successful!"
    echo "📦 APK location: app/build/outputs/apk/release/app-release.apk"
    echo ""
    echo "📋 Next steps:"
    echo "1. Test the APK on a device"
    echo "2. Upload to Google Play Console"
    echo "3. Users will get automatic updates"
    echo ""
    echo "🔄 TWA Update Features:"
    echo "• Cache-busting URLs prevent stale content"
    echo "• Single task launch mode prevents multiple instances"
    echo "• WebView cache clearing on app resume"
    echo "• No-cache strategy for fresh content"
else
    echo "❌ TWA build failed!"
    exit 1
fi