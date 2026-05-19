# Logic Nexus — Android shell build guide

Phase 1 Addendum **T24** wrapped the existing React/Vite SPA in a Capacitor
Android shell. Same source tree, same Supabase backend — the native app
loads the bundled `dist/` assets and reaches the markets-worker via the
same `/api/markets/*` proxy the web build uses.

iOS is Phase 1.5; this guide is Android-only.

## Local prerequisites (one-time)

| What | Why |
|---|---|
| **JDK 17** | Gradle 8.x requires JDK 17 — install via [`brew install --cask temurin@17`](https://adoptium.net/) on macOS. |
| **Android Studio** | Provides the Android SDK + emulator + ADB. [Download](https://developer.android.com/studio). |
| **Android SDK Platform 34** + **Build-Tools 34.0.0** | Capacitor 7's default. Open Studio → SDK Manager → check both. |

Set `JAVA_HOME` to the JDK 17 install path (Android Studio's Embedded JBR
also works) and add `$ANDROID_HOME/platform-tools` to `PATH`.

## Build cycle

```bash
# 1. Build the web bundle + sync into the native project
npm run mobile:build

# 2. Open the native project in Android Studio
npm run cap:open:android

# 3. Run on a connected device / emulator via Studio's Run button,
#    or via CLI:
cd android && ./gradlew assembleDebug && ./gradlew installDebug
```

After UI / Python changes:

```bash
npm run mobile:build   # rebuilds dist + cap sync android
# Studio auto-detects the change; tap Run.
```

## Live-reload against the local Vite dev server

For UI iteration without rebuilding on every change, create a
**gitignored** `capacitor.config.local.ts` that points the native shell
at your laptop's Vite server:

```ts
import baseConfig from "./capacitor.config";
export default {
  ...baseConfig,
  server: {
    ...baseConfig.server,
    url:         "http://192.168.1.42:5173", // ← your laptop's LAN IP
    cleartext:   true,
  },
};
```

`capacitor.config.local.ts` is in `.gitignore` already (see the
Capacitor block at the bottom). Restore the bundled-assets behaviour for
release builds by removing the file or commenting out the `server.url`.

## Release build (Phase 1 launch — T24e)

### 1. Generate the release keystore (one-time, KEEP THIS FILE SAFE)

```bash
keytool -genkey -v \
  -keystore ~/keys/logic-nexus-release.jks \
  -alias logic-nexus-prod \
  -keyalg RSA -keysize 2048 -validity 36500 \
  -storetype JKS
```

You'll be prompted for store password, key password (use the same), and
the standard X.509 fields. Keep the keystore + passwords in a password
manager — losing them means **you can never publish an update to the
same Play listing**. Back up to two physically separated locations.

### 2. Local release build

The Gradle release config reads four env vars (or matching
`gradle.properties` entries):

```bash
export LN_KEYSTORE_PATH=/Users/you/keys/logic-nexus-release.jks
export LN_KEYSTORE_PASSWORD='…'
export LN_KEY_ALIAS=logic-nexus-prod
export LN_KEY_PASSWORD='…'

npm run mobile:build
cd android
./gradlew bundleRelease     # → android/app/build/outputs/bundle/release/app-release.aab
# or for a sideload-able APK:
./gradlew assembleRelease   # → android/app/build/outputs/apk/release/app-release.apk
```

Without those env vars the build still succeeds but falls back to the
debug signing key — useful for smoke tests, NOT useful for Play Store.

### 3. Jenkins CI release build

Set up four Jenkins credentials in **Manage Jenkins → Credentials**:

| Credential ID | Type | Value |
|---|---|---|
| `android-keystore-file` | Secret file | Upload the `.jks` from step 1 |
| `android-keystore-password` | Secret text | store password |
| `android-key-alias` | Secret text | e.g. `logic-nexus-prod` |
| `android-key-password` | Secret text | key password |

The Jenkins agent itself needs JDK 17 + Android SDK Platform 34 +
Build-Tools 34 installed, plus `ANDROID_HOME` exported in the agent's
environment. The dockerized Jenkins on the VPS does **not** ship those
by default — add them to the Jenkins image or use a labelled agent.

Trigger a release build:

1. Open Jenkins → LogicNexus-Pipeline → **Build with Parameters**
2. Tick `ENABLE_ANDROID_RELEASE`
3. Build. The new `Build Android Release` stage runs after the web
   deploy; the AAB lands as a build artifact you can download from
   Jenkins.

### 4. Play Console first upload (the one-time human checklist)

1. Create a developer account at https://play.google.com/console
   ($25 one-time).
2. Create app → package name `com.sospro.logicnexus`.
3. Fill **App content** declarations:
   - Privacy policy URL (required for any app collecting user data —
     ours collects auth + portfolio data).
   - Target audience + content rating questionnaire.
   - Data safety form — disclose Supabase Auth, FCM, broker OAuth
     scopes.
4. **Internal testing** track:
   - Upload the AAB.
   - Add a tester list (Google groups or comma-separated emails).
   - Share the opt-in link with the team.
5. **Pre-launch report** runs automatically on Google's emulator fleet
   for 4 hours after upload. Check the device-compat + accessibility
   warnings.
6. Promote to **Closed testing → Production** after the team
   bakes-in for a week.

Internal testing is enough to start dogfooding before production.
Production review usually takes 1–3 days for new apps.

## What's checked in vs ignored

| Path | Status | Why |
|---|---|---|
| `android/` (source) | **committed** | CI rebuilds the APK from scratch each release |
| `android/.gradle/`, `android/build/`, `android/app/build/` | ignored | regenerated on every `./gradlew` invocation |
| `android/local.properties` | ignored | machine-local SDK path |
| `capacitor.config.ts` | **committed** | shared config |
| `capacitor.config.local.ts` | ignored | per-developer overrides |

## Push notifications — Firebase / FCM setup (T24c)

The Android shell uses FCM HTTP v1 for system-tray notifications (5 events
per addendum §2). Setup is per-environment and one-time.

**1. Firebase Console**

- Create a Firebase project (or reuse an existing one for the org).
- Add an Android app → package name **`com.sospro.logicnexus`** (matches
  `capacitor.config.ts`).
- Download `google-services.json` and drop it at `android/app/google-services.json`.
  This file is **not** in git (`android/app/google-services.json` is in
  the platform's stock `.gitignore`); it's required for each developer
  who builds the APK.

**2. Worker-side credential**

In Firebase Console → Project Settings → Service accounts, click
"Generate new private key". Copy the entire JSON file contents.

On the VPS, append two lines to `/etc/logic-nexus/markets-worker.env`:

```
FCM_PROJECT_ID=your-firebase-project-id
FCM_SERVICE_ACCOUNT_JSON={"type":"service_account",...}   # single line
```

Then restart the worker:

```bash
systemctl restart markets-worker
journalctl -u markets-worker -n 30 --no-pager | grep -i fcm
```

If you see no `fcm.bad_service_account_json` warnings the JSON parsed
cleanly. Test from an authenticated session:

```bash
curl -X POST https://<host>/api/markets/v1/retail/push/test \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{}'
```

Returns `{"delivered": N}` where N is the number of active tokens for
the caller. A 503 means the worker env is missing the credential.

**3. Frontend behaviour**

`usePushRegistration()` runs once when `RetailMode` mounts. On Android it
prompts the OS permission dialog, registers the FCM token, then POSTs to
`/v1/retail/push/register`. On web it's a no-op. Re-registration is
idempotent — the worker route upserts on `(user_id, token)`.

**4. Events that trigger a push today**

| Event | Fires from | Notes |
|---|---|---|
| Drift rebalance available | `routers/rebalance.py` `get_pending` on first detection | Title: "Time to rebalance" |
| Daily Portfolio Health Diagnostic | T19 (not built yet) | Wired via `notify_user_sync` |
| Stop-loss triggered | T17 risk-trio extension | Broker webhook → `notify_user_sync` |
| SIP debit success/failure | Broker SIP integration | Same path |
| Material signal change | T20 holdings-aware commentary | Same path |

The other four event types use the existing `notify_user_sync` plumbing
— the FCM fan-out is automatic. Push delivery is best-effort: if FCM is
misconfigured or unreachable the in-app notification still lands, and
the calling job never fails.

## Capacitor plugins wired in T24a

| Plugin | Used for | Lands in task |
|---|---|---|
| `@capacitor/core` + `@capacitor/cli` + `@capacitor/android` | runtime + tooling | T24a |
| `@aparajita/capacitor-biometric-auth` | login + per-trade biometric confirm | T24b |
| `@capacitor/push-notifications` | FCM for the 5 Phase-1 events | T24c |
| `@capacitor/preferences` | encrypted key-value (broker tokens, TanStack Query persistence) | T24d |
| `@capacitor/network` | offline detection | T24d |
| `@capacitor/app` | resume/pause re-auth | T24b |
| `@capacitor/haptics` | confirmation feedback on trade execute | T24b |

`npx cap ls` lists what's currently installed for each platform.

## Troubleshooting

**"SDK not found"** → set `ANDROID_HOME` to e.g. `/Users/vims/Library/Android/sdk`.

**Gradle "JAVA_HOME points to a non-existing directory"** → install JDK 17
and point `JAVA_HOME` at it (`echo $JAVA_HOME`).

**`cap sync` errors after pulling main** → `rm -rf node_modules android/app/build && npm ci && npm run mobile:build`.

**Capacitor plugin not detected on Android** → re-run `npm run cap:sync`
after every plugin install. Studio caches the merged manifest aggressively.
