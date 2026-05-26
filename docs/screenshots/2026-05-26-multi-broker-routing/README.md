# Multi-broker routing — mobile smoke test artifacts

Captured **2026-05-26** on Sthira APK against the prod worker
(`https://markets.sosservices.online`). Device: OnePlus AC2001
(`b7d90a26`), Android 12. Build: from local source post-commit
`52e2f667 fix(markets): broker card action row overflowed past card on mobile`.

Companion design: [`../../plans/2026-05-26-broker-portfolio-routing-design.md`](../../plans/2026-05-26-broker-portfolio-routing-design.md).

## 01 — Broker card action row

`01-broker-card-action-row.png`

The new compact action row inside the Groww connection card:
**`Portfolio | Routing | Data ›   ↻`**. Sits cleanly inside the card on
phone width thanks to the `flex-col sm:flex-row` outer + `flex-wrap`
inner layout. Pre-fix, "Routing" was clipped past the card right edge.

## 02 — Routing rules sheet opened

`02-routing-sheet-opened.png`

Tapping **Routing** slides in the right-side sheet (full-width on
phone). Visible: title with broker name interpolation, description
copy, Default destination select bound to current portfolio, "Holdings
that don't match a specific rule go here" hint, existing override-rule
row with trash icon (the backfilled 2026-05-21 row), **Add rule**
button, **Done** action.

## 03 — Add rule inline form

`03-add-rule-form.png`

Inline form with all three segment chips Groww supports
(**Equity / F&O / Mutual Funds** — F&O wasn't in `broker.supports` for
Groww until the recent worker registry update; this confirms it
correctly), portfolio Select with "Create new portfolio…" default,
auto-name placeholder `Groww (Trade API) — rule`, Cancel + Save rule
buttons (Save disabled until segments picked).

## 04 — More tab Broker accounts row

`04-more-tab-broker-accounts-row.png`

The new entry I added in this session. Plug icon, "Broker accounts" /
"Connect or manage your trading accounts" hint, navigates to
`/dashboard/markets/settings/brokers`. Makes the broker page reachable
on mobile when the Home connect-prompt is suppressed (user already
has brokers connected).

## 05 — ICICI Direct (Breeze) Connect sheet

`05-icici-direct-connect-sheet.png`

The existing connect flow for ICICI Direct on mobile — included as the
canonical example from the design doc. Shows Client ID / API Key /
API Secret fields, the 2-step session-token instruction copy,
Portfolio binding with "Create new portfolio…" + auto-name, Enable
live trading toggle. The "Get login URL" CTA opens the Breeze login
page via Capacitor Browser (Custom Tabs) thanks to `openExternal`
plugged in earlier in this session.

## 06 — Bottom nav restored on broker page

`06-bottom-nav-restored-on-broker-page.png`

After commit `8e542cee fix(markets): retail bottom nav disappeared on
broker pages`. Pre-fix, BrokerConnectionsPage wrapped itself in
`DashboardLayout` (CRM/admin sidebar) which on a retail-only user
hid the 5-tab bottom nav entirely — leaving the user stranded with
only the Android system back button.

Post-fix: a new `BrokerPageShell` swaps to a `RetailBottomNav` for
retail audiences. The screenshot shows the 5-tab nav present at the
bottom (`Home | Portfolio | Signals | Goals | More`), the Groww
connection card with its full action row inside the card boundary
(`Portfolio | Routing | Data ›   ↻ 🔌`), and the broker grid below.

## Reproduction

```bash
# Build the APK against prod
MARKETS_WORKER_URL=https://markets.sosservices.online npm run mobile:build:markets
( cd android && ./gradlew :app:assembleDebug )

# Install + launch
adb -s <device> install -r android/app/build/outputs/apk/debug/app-debug.apk
adb -s <device> shell monkey -p com.sos.sthira -c android.intent.category.LAUNCHER 1

# Navigate by hand on the device:
#   More tab (bottom-right) → Broker accounts → tap a connection's Routing button
```

Automated CDP-driven navigation is blocked by Chromium 130+'s
`--remote-allow-origins` enforcement (any WS handshake from `adb forward`
gets 403). uiautomator sees the WebView as one opaque View, so
`uiautomator dump` exposes no inner bounds. Pixel-precise `input tap`
works once the screenshot is read carefully — see
[../../../supabase/tests/markets_multibroker_rls.sql] for the
behavioural-correctness assertions that cover the same path without
touching the UI.
