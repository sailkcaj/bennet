#!/usr/bin/env bash
# Compiles a Release iphoneos (arm64, JS bundled) app WITHOUT signing, to prove the native
# Swift module and bundle build for physical iPhones. The output is NOT installable on a phone:
# installation needs Apple signing (see README "Install on your own iPhone").
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
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -derivedDataPath ios/build-device \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO COMPILER_INDEX_STORE_ENABLE=NO \
  build > ios/xcodebuild-device.log 2>&1; then
  grep -n -B3 -A8 "error:" ios/xcodebuild-device.log | head -300 || true
  tail -80 ios/xcodebuild-device.log
  exit 1
fi
APP=ios/build-device/Build/Products/Release-iphoneos/$APP_NAME.app
lipo -info "$APP/$APP_NAME"
test -f "$APP/main.jsbundle" && echo "JS bundle embedded"
/usr/libexec/PlistBuddy -c 'Print :DTPlatformName' "$APP/Info.plist"
(cd ios/build-device/Build/Products/Release-iphoneos && mkdir -p Payload && cp -R "$APP_NAME.app" Payload/ && zip -qry ../../../../Bennet-UNSIGNED-device-compile-check.ipa Payload)
ls -la ios/Bennet-UNSIGNED-device-compile-check.ipa
