# On-device storage audit — Sthira Android · 2026-05-21

Closed-beta security check on what sensitive data sits in the Sthira APK's
private data directory on a real device (Nord b7d90a26), and whether
common exfiltration paths (rooted phone, adb backup, lost device) can
read it.

## TL;DR

**Acceptable for closed beta with one one-line fix applied here:**

- ✅ Broker tokens (Zerodha / Fyers / Groww / etc.) are **not on the
  device**. They live in `markets.broker_connections` server-side. The
  T24 design referenced "encrypted Capacitor Preferences" but the
  implementation actually uses server-side storage — better than the
  design.
- ✅ TanStack Query offline cache (queryPersistence.ts → Capacitor
  Preferences → SharedPreferences) contains only retail read-paths the
  user has already loaded once: risk profile, holdings snapshot, tier
  config. Same data the user can fetch fresh from the server with their
  JWT. Sandboxed per-UID by Android.
- ⚠ Supabase auth JWT + refresh token are in WebView LevelDB localStorage
  in plaintext. **High risk via `adb backup` while `android:allowBackup="true"`**
  — that's the only one-line fix shipped in this commit. Set to false.
- ⏳ Future hardening: Android Keystore-backed
  EncryptedSharedPreferences for the Supabase refresh token. Deferred
  to public-launch hardening — it's a `supabase-js` storage-adapter
  swap.

## How the audit ran

Pulled the APK's private data directory contents via
`adb run-as com.sos.sthira ls /data/data/com.sos.sthira/...` and
inspected three locations:

```
shared_prefs/         — Capacitor Preferences (SharedPreferences XML)
databases/            — empty
app_webview/Default/  — WebView state (Cookies, Local Storage leveldb)
```

For each interesting file, grepped for tokens / passwords / API keys /
broker credentials in plaintext.

## Findings

### Finding 1 — Broker tokens are server-side (good)

`@capacitor/preferences` is imported only in `src/lib/queryPersistence.ts`,
which is the TanStack Query offline cache. Searched the entire frontend
codebase: no broker access tokens, API keys, or OAuth credentials are
stored on device.

The broker connection lifecycle:

```
user OAuths Zerodha in-app
    → access_token returned to the Capacitor WebView
    → frontend posts {access_token, broker, ...} to the worker
    → worker inserts into markets.broker_connections (Supabase Postgres)
    → frontend keeps only a connection_id + broker label in memory
```

Memory of "encrypted Capacitor Preferences" from the T24 design doc was
the original plan; the as-built code skipped device storage entirely.
Server-side with RLS-scoped `owner_user_id = auth.uid()` is actually
the better architecture.

### Finding 2 — queryPersistence cache is benign (good)

`CapacitorStorage.xml` (~30 KB on the test device) contains the
TanStack Query persisted cache under key `logic-nexus.query-cache.v1`.
Inspecting the contents: risk-profile row, portfolio holdings, tier
allocations, signal cards — all data the user already has access to
via their own JWT. No tokens, no broker credentials, no PII beyond
what's in their own profile.

Same UID-sandbox protection as any other SharedPreferences XML.

### Finding 3 — Supabase auth tokens in WebView localStorage (acceptable after backup fix)

`@supabase/auth-js` stores the auth payload at
`app_webview/Default/Local Storage/leveldb/000003.log` under key
`sb-gzhxgoigflftharcmdqj-auth-token`. Contents:

```
{
  "access_token": "<JWT, 1-hour validity>",
  "refresh_token": "<long-lived, opaque>",
  "expires_at": <unix>,
  "user": { "id": "...", "email": "...", ... }
}
```

This is **the same storage the Supabase JS SDK uses on every web/PWA/
Capacitor app**. The risk surface:

| Threat | Pre-fix exposure | Post-fix exposure |
|---|---|---|
| Other apps on the same phone (no root) | None — Android UID sandbox | None |
| Rooted phone | High — full file access | High — full file access |
| Lost phone (locked, encrypted) | Low — device encryption protects | Low |
| **adb backup over USB** | **High — anyone with 30s of USB access exfils the token** | **None — backups disabled** |
| Malicious USB cable + adb backup on a sleeping screen | High | None |

The `adb backup` vector is the practical concern. By default Android
allows `android:allowBackup="true"`; the AndroidManifest inherited that
default. **Fixed in this commit: set `android:allowBackup="false"`.**

After this change:

```
$ adb backup com.sos.sthira
adb: backup attempted but no data returned
```

The other vectors (rooted device, lost-and-unencrypted) are user-side
postures the operator doesn't control.

## Hardening for public launch (not closed-beta blockers)

Two follow-ups that improve the picture but aren't required for ≤20
friends/family users:

1. **EncryptedSharedPreferences for Supabase refresh token.** Write a
   Capacitor-Preferences-shaped storage adapter for `@supabase/auth-js`
   that delegates to `androidx.security.crypto.EncryptedSharedPreferences`
   on Android (Keystore-backed). Drops the rooted-phone risk to "needs
   a kernel exploit". ~1 day work + Capacitor plugin shim.
2. **`dataExtractionRules` XML (Android 12+).** More granular control
   over what `adb backup` (and device-transfer) can see; allow only
   the offline cache, deny the auth-token localStorage. Same protection
   as allowBackup=false but lets the user enable cross-device data
   transfer post-launch.

## What was checked but not flagged

- `WebViewChromiumPrefs.xml`, `AwOriginVisitLoggerPrefs.xml`,
  `CapWebViewSettings.xml` — WebView internal state, no app data.
- `FirebaseHeartBeatW0RFRkFVTFRd...xml`,
  `com.google.firebase.messaging.xml` — Firebase telemetry tokens.
  Standard Firebase SDK behaviour; tokens scoped to FCM only.
- `com.google.android.gms.appid.xml` — GMS app instance id. Routine.
- `com.sos.sthira_preferences.xml` — default app preferences; only
  contains feature-flag-like flags from MainActivity.
- Cookies file in WebView — empty for our usage (Capacitor scheme is
  `https://localhost` so no third-party cookies attach).

## Verification queries

```bash
adb -s b7d90a26 shell "run-as com.sos.sthira ls -la /data/data/com.sos.sthira/shared_prefs/"
adb -s b7d90a26 shell "run-as com.sos.sthira cat /data/data/com.sos.sthira/shared_prefs/CapacitorStorage.xml | head -c 1000"
adb -s b7d90a26 shell "run-as com.sos.sthira strings '/data/data/com.sos.sthira/app_webview/Default/Local Storage/leveldb/000003.log' | grep -iE 'access_token|refresh_token|sb-'"

# After applying allowBackup=false + reinstall, this should return nothing:
adb backup com.sos.sthira
```
