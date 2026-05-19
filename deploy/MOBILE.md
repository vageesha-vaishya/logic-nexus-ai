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

## Release build (Phase 1 launch)

```bash
npm run mobile:build
cd android
./gradlew bundleRelease   # → android/app/build/outputs/bundle/release/app-release.aab
```

You'll need:
- A keystore (one-time: `keytool -genkey -v -keystore release.keystore ...`)
- A `~/.gradle/gradle.properties` entry with the keystore + password
- The Play Console signing key uploaded to Google

These steps land with T24e (first signed APK + Play Console listing) —
this doc is the scaffold.

## What's checked in vs ignored

| Path | Status | Why |
|---|---|---|
| `android/` (source) | **committed** | CI rebuilds the APK from scratch each release |
| `android/.gradle/`, `android/build/`, `android/app/build/` | ignored | regenerated on every `./gradlew` invocation |
| `android/local.properties` | ignored | machine-local SDK path |
| `capacitor.config.ts` | **committed** | shared config |
| `capacitor.config.local.ts` | ignored | per-developer overrides |

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
