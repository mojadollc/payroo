@echo off
REM Payroo POS TWA Build Script for Windows
REM This script builds the Android TWA with automatic version updates

echo 🚀 Building Payroo POS TWA...

REM Navigate to TWA directory
cd /d "%~dp0..\android-twa"

REM Get current timestamp for version
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "TIMESTAMP=%dt:~0,12%"
set /a "VERSION_CODE=%dt:~0,8% - 20240101 + 1000"
set "VERSION_NAME=2.0.%TIMESTAMP%"

echo 📱 Updating TWA version to: %VERSION_NAME% (code: %VERSION_CODE%)

REM Update version in build.gradle (Windows version)
powershell -Command "(Get-Content app\build.gradle) -replace 'versionCode \d+', 'versionCode %VERSION_CODE%' | Set-Content app\build.gradle"
powershell -Command "(Get-Content app\build.gradle) -replace 'versionName \"[^\"]*\"', 'versionName \"%VERSION_NAME%\"' | Set-Content app\build.gradle"

REM Clean and build
echo 🧹 Cleaning previous build...
call gradlew.bat clean

echo 🔨 Building release APK...
call gradlew.bat assembleRelease

if %ERRORLEVEL% EQU 0 (
    echo ✅ TWA build successful!
    echo 📦 APK location: app\build\outputs\apk\release\app-release.apk
    echo.
    echo 📋 Next steps:
    echo 1. Test the APK on a device
    echo 2. Upload to Google Play Console
    echo 3. Users will get automatic updates
    echo.
    echo 🔄 TWA Update Features:
    echo • Cache-busting URLs prevent stale content
    echo • Single task launch mode prevents multiple instances
    echo • WebView cache clearing on app resume
    echo • No-cache strategy for fresh content
) else (
    echo ❌ TWA build failed!
    exit /b 1
)

pause