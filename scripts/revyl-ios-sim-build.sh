#!/usr/bin/env bash
# Builds a standalone (JS bundled, Release) iOS Simulator .app on a macOS runner.
set -euo pipefail
export EXPO_PUBLIC_CONVEX_URL="${EXPO_PUBLIC_CONVEX_URL:-https://kindly-retriever-868.convex.cloud}"
export CI=1
# Generated Xcode project/scheme/app name follows expo.name (alphanumerics only).
APP_NAME="$(node -p "require('./app.json').expo.name.replace(/[^A-Za-z0-9]/g, '')")"

for attempt in 1 2 3; do
  npm ci --no-audit --no-fund --fetch-retries=5 --fetch-retry-maxtimeout=120000 && break
  [ "$attempt" = 3 ] && exit 1
  echo "npm ci failed (attempt $attempt), retrying"; sleep 15
done
npx expo prebuild --platform ios --clean --no-install
(cd ios && pod install)

if ! xcodebuild \
  -workspace "ios/$APP_NAME.xcworkspace" \
  -scheme "$APP_NAME" \
  -configuration Release \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath ios/build \
  ARCHS=arm64 ONLY_ACTIVE_ARCH=NO CODE_SIGN_IDENTITY=- CODE_SIGN_STYLE=Manual DEVELOPMENT_TEAM= PROVISIONING_PROFILE_SPECIFIER= COMPILER_INDEX_STORE_ENABLE=NO \
  build > ios/xcodebuild.log 2>&1; then
  grep -n -B3 -A8 "error:" ios/xcodebuild.log | head -300 || true
  tail -80 ios/xcodebuild.log
  exit 1
fi
grep -c "warning:" ios/xcodebuild.log || true
APP=ios/build/Build/Products/Release-iphonesimulator/$APP_NAME.app
codesign -d --entitlements - "$APP" 2>&1 | head -20 || true
ls -la "$APP"
