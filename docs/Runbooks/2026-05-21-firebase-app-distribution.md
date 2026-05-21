# Firebase App Distribution runbook — Sthira closed beta

Ship a new APK to friends/family via Firebase. Replaces WhatsApp'ing
APKs every time you push a fix.

## Why App Distribution

- Single install link per release; friends get an email
  ("Sthira 0.4.2 is available, tap to install").
- Version history visible in the Firebase console — you can see who
  installed what and when.
- Auto-update notifications on the device when a new release ships.
- Crash reports flow into the same Firebase project that already does
  FCM, so signal/UI bugs surface without extra wiring.
- No Play Store review delay. Lasts up to 150 days per APK.

## One-time setup (you, ~10 min)

1. Open the Firebase console for project `logic-nexus-ai` (or whichever
   the `android/app/google-services.json` points at).
2. Sidebar → **Release & Monitor → App Distribution**. Pick the
   `com.sos.sthira` Android app.
3. **Testers & Groups** tab → **Add Group**. Name it
   `sthira-closed-beta`. Add the friend emails one per line. They get
   an invitation email immediately; they install the Firebase Tester
   app once, accept the invite, and from then on receive every new
   release in the same flow.
4. (Optional) **Service accounts** — if you want non-interactive auth
   (e.g. Jenkins), create a service-account JSON and export it as
   `GOOGLE_APPLICATION_CREDENTIALS` before running the script. For
   manual ops, `firebase login` once on your laptop is enough.

## Per-release workflow

```bash
# First-time on your laptop (interactive auth, one-shot)
npx firebase-tools@latest login

# Every release
FIREBASE_TESTER_GROUPS=sthira-closed-beta \
  npm run mobile:beta
```

The script:

1. Runs the existing `mobile:build:markets` (vite build → bundle budget
   gate → cap sync android).
2. Picks APK type:
   - **release** if `LN_KEYSTORE_PATH` env points at a real keystore
     and the password / alias / key-password envs are all set
     (T24e release signing config).
   - **debug** otherwise.
   - Force with `--debug` or `--release` flag.
3. Runs `gradlew :app:assembleDebug` or `:app:assembleRelease`.
4. Auto-fills release notes from `git log --oneline -5`. Override with
   `RELEASE_NOTES="..."` env if you want a curated note.
5. Uploads via `firebase-tools appdistribution:distribute`. App ID is
   auto-read from `android/app/google-services.json`.

Total wall time: ~2 minutes including upload.

## Friend's first-time install (~3 min)

1. They receive an email "You're invited to test Sthira" with a button
   "Get started".
2. Button opens the **Firebase App Tester** app on their phone (Play
   Store install if they don't have it). They sign in with the same
   email you invited.
3. The Tester app lists available releases. Tap install.
4. From then on, every release fires a push notification on their
   phone: "Sthira 0.4.3 is available". One tap, install.

The first install includes the "unknown sources" prompt because the
APK is debug-signed (or release-signed by your local keystore, not
Google Play). Once accepted, future updates skip it.

## Required env vars

| Var | Required? | Default |
|---|---|---|
| `FIREBASE_TESTER_GROUPS` | yes (or emails) | — |
| `FIREBASE_TESTER_EMAILS` | yes (or groups)| — |
| `FIREBASE_APP_ID` | optional | auto-read from google-services.json |
| `FIREBASE_TOKEN` | optional (CI only) | `firebase login` session |
| `LN_KEYSTORE_PATH` | for release-signed APKs | — (falls back to debug) |
| `LN_KEYSTORE_PASSWORD` | with above | — |
| `LN_KEY_ALIAS` | with above | — |
| `LN_KEY_PASSWORD` | with above | — |
| `RELEASE_NOTES` | optional | last 5 git log lines |
| `APK_TYPE` | optional | release if signing env present, else debug |

## Common failure modes

**`Error: HTTP Error: 401`**
You haven't run `firebase login` on this laptop, or your session
expired. Run it again.

**`Error: Failed to find Group: sthira-closed-beta`**
Create the group in the Firebase console first (step 3 of one-time
setup). Group **aliases** are case-sensitive and don't include spaces.

**`Error: APK is not signed`**
Release builds without `LN_KEYSTORE_*` envs land here. Either set the
env (T24e walkthrough in `deploy/MOBILE.md`) or pass `--debug` to use
the debug-signed APK.

**Friends say "Tester app says no releases available"**
They need to (a) accept the email invitation by tapping the link in
the email and signing in with that exact email; (b) install the
Firebase App Tester from Play Store; (c) sign in to the tester app
with the same email. If steps a/b/c are out of order, the install
sometimes silently fails — have them sign out and back in.

## When to retire this runbook

When you publish to Play Store (internal testing → closed testing →
production). App Distribution is a closed-beta tool; once you have a
real Play Store listing, friends get updates through the same channel
as real users.
