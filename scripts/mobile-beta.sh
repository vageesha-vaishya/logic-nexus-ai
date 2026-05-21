#!/usr/bin/env bash
# mobile-beta — package + ship a Sthira APK to Firebase App Distribution.
#
# Wraps the existing mobile:build:markets pipeline (vite build + budget
# gate + cap sync), assembles a release-signed APK if the keystore env
# is present (debug-signed fallback otherwise), and uploads to Firebase
# App Distribution under a tester group.
#
# Required env:
#   FIREBASE_APP_ID         android app id (default read from
#                           android/app/google-services.json)
#   FIREBASE_TESTER_GROUPS  comma-separated App Distribution group aliases
#                           (e.g. "sthira-closed-beta"). Set up in
#                           console.firebase.google.com → App Distribution
#                           → Testers & Groups.
#
# Optional:
#   FIREBASE_TESTER_EMAILS  comma-separated emails (in addition to groups)
#   FIREBASE_TOKEN          CI auth token. Local runs use `firebase login`.
#   APK_TYPE                "release" (default if signing env present) or
#                           "debug" (default if not). Force with --debug
#                           or --release.
#   RELEASE_NOTES           override the default git-log release notes
#
# Usage:
#   FIREBASE_TESTER_GROUPS=sthira-closed-beta npm run mobile:beta
#   FIREBASE_TESTER_GROUPS=sthira-closed-beta ./scripts/mobile-beta.sh --debug
#
# Companion: docs/Runbooks/2026-05-21-firebase-app-distribution.md

set -euo pipefail

# ─── arg parsing ──────────────────────────────────────────────────────────

APK_TYPE_OVERRIDE=""
for a in "$@"; do
  case "$a" in
    --debug)   APK_TYPE_OVERRIDE="debug"   ;;
    --release) APK_TYPE_OVERRIDE="release" ;;
    *) ;;
  esac
done

red()    { printf '\033[31m%s\033[0m\n' "$1"; }
green()  { printf '\033[32m%s\033[0m\n' "$1"; }
yellow() { printf '\033[33m%s\033[0m\n' "$1"; }
bold()   { printf '\033[1m%s\033[0m\n' "$1"; }

# ─── 1. Resolve Firebase app id ───────────────────────────────────────────

if [ -z "${FIREBASE_APP_ID:-}" ]; then
  FIREBASE_APP_ID=$(grep -m1 '"mobilesdk_app_id"' android/app/google-services.json \
    | sed -E 's/.*"mobilesdk_app_id":\s*"([^"]+)".*/\1/' || true)
fi
if [ -z "${FIREBASE_APP_ID:-}" ]; then
  red "✗ FIREBASE_APP_ID not set and could not be read from android/app/google-services.json"
  exit 1
fi
green "✓ Firebase app id: ${FIREBASE_APP_ID}"

# ─── 2. Resolve tester audience ───────────────────────────────────────────

if [ -z "${FIREBASE_TESTER_GROUPS:-}" ] && [ -z "${FIREBASE_TESTER_EMAILS:-}" ]; then
  red "✗ Set FIREBASE_TESTER_GROUPS (e.g. 'sthira-closed-beta') or FIREBASE_TESTER_EMAILS."
  yellow "  Create the group in console.firebase.google.com → App Distribution → Groups."
  exit 1
fi

# ─── 3. Decide APK type ───────────────────────────────────────────────────

# Release signing is "ready" when LN_KEYSTORE_PATH (etc.) point at a real
# file. Mirrors the gradle releaseSigningReady check in android/app/build.gradle.
SIGN_READY=0
if [ -n "${LN_KEYSTORE_PATH:-}" ] && [ -f "${LN_KEYSTORE_PATH}" ] \
   && [ -n "${LN_KEYSTORE_PASSWORD:-}" ] \
   && [ -n "${LN_KEY_ALIAS:-}" ] \
   && [ -n "${LN_KEY_PASSWORD:-}" ]; then
  SIGN_READY=1
fi

if [ -n "$APK_TYPE_OVERRIDE" ]; then
  APK_TYPE="$APK_TYPE_OVERRIDE"
elif [ "$SIGN_READY" -eq 1 ]; then
  APK_TYPE="release"
else
  APK_TYPE="debug"
fi
yellow "→ Building $APK_TYPE APK (sign-ready=${SIGN_READY})"

# ─── 4. Build web bundle + cap sync ───────────────────────────────────────

bold "\n== Building web bundle (mobile:build:markets) =="
npm run mobile:build:markets

# ─── 5. Assemble APK ──────────────────────────────────────────────────────

bold "\n== Assembling $APK_TYPE APK =="
pushd android >/dev/null
case "$APK_TYPE" in
  release) ./gradlew :app:assembleRelease ;;
  debug)   ./gradlew :app:assembleDebug   ;;
esac
popd >/dev/null

APK_PATH="android/app/build/outputs/apk/${APK_TYPE}/app-${APK_TYPE}.apk"
if [ ! -f "$APK_PATH" ]; then
  red "✗ APK not found at $APK_PATH"
  exit 1
fi
green "✓ APK: $APK_PATH ($(du -h "$APK_PATH" | cut -f1))"

# ─── 6. Release notes ─────────────────────────────────────────────────────

if [ -z "${RELEASE_NOTES:-}" ]; then
  RELEASE_NOTES=$(git log --oneline -5 2>/dev/null | sed 's/^/• /' || echo "Sthira closed beta build")
fi

# ─── 7. Upload via Firebase CLI ───────────────────────────────────────────

bold "\n== Uploading to Firebase App Distribution =="
DISTRIBUTE_ARGS=(
  appdistribution:distribute "$APK_PATH"
  --app "$FIREBASE_APP_ID"
  --release-notes "$RELEASE_NOTES"
)
if [ -n "${FIREBASE_TESTER_GROUPS:-}" ]; then
  DISTRIBUTE_ARGS+=(--groups "$FIREBASE_TESTER_GROUPS")
fi
if [ -n "${FIREBASE_TESTER_EMAILS:-}" ]; then
  DISTRIBUTE_ARGS+=(--testers "$FIREBASE_TESTER_EMAILS")
fi

# Auth precedence: FIREBASE_TOKEN env (CI) → interactive `firebase login`
# session cached in ~/.config/configstore. firebase-tools handles both.
npx --yes firebase-tools@latest "${DISTRIBUTE_ARGS[@]}"

green "\n✓ Uploaded. Testers will receive an install email shortly."
yellow "  Track distribution at console.firebase.google.com → App Distribution → Releases."
