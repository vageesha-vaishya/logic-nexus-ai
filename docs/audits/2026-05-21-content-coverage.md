# Content coverage audit — news + signals · 2026-05-21

Pre-closed-beta content audit. Answers: when 10–20 friends/family open
Sthira tomorrow, will they actually see useful content on Home (news
carousel, signals feed) — or empty states?

**Headline verdict: two UX dealbreakers and two cheap fixes between now
and closed-beta launch.**

## Dealbreakers (must fix before friends touch it)

### D1 — No signals get generated when a new portfolio is created

The `markets.signals` table currently has 179 rows from the **last 7
days**, **all owned by 1 user** (the dev account). Out of 103
authenticated users on prod, only 1 has any signals.

That's not because the signal generator is broken — it works fine for
the dev account (78 active signals across 82 instruments). It's
because of *how* the generator is scheduled:

- `services/markets-worker/src/markets_worker/scheduler.py:setup_daily_jobs()`
  runs on worker startup. It loads all active portfolios and enqueues
  a daily RQ job at 07:00 IST per portfolio. Each job self-reschedules
  for the next trading day.
- **There is no hook that fires when a new portfolio is created.** A
  friend who signs up, onboards, links Zerodha, and opens the Signals
  tab will see zero signals — *forever*, until either the worker
  restarts or someone manually invokes the job for their portfolio.

The first friend opening the app to an empty Signals tab is a
first-impression failure that no later fix recovers.

**Fix paths (pick one):**

1. **Realtime subscription in the worker** on `markets.portfolios`
   INSERT events. On insert, call `schedule_immediate_refresh(new_id)`
   + `_enqueue_daily_for_portfolio(new_id)`. ~1 day. Cleanest.
2. **Trigger an edge function** on `AFTER INSERT ON markets.portfolios`
   that POSTs to the worker's `/v1/jobs/refresh-and-signals/{id}`
   endpoint. ~0.5 day. Adds Postgres → edge function → worker hop.
3. **Frontend ad-hoc fire** — the retail onboarding "create portfolio"
   path calls the worker's job endpoint after the portfolio row is
   created. ~2 hours, simplest. Risk: if the user closes the app
   mid-flow, the job never fires.

Recommended: option 1 (worker realtime subscription) + option 3 as a
belt-and-suspenders fallback.

### D2 — News carousel will be mostly empty for individual stocks

`markets.news_events` has 967 total rows, 163 in the last 24h. But:

- **80.9% of rows are untagged** (782 of 967 have empty `instruments`
  arrays). The Holdings News query uses `instruments && ARRAY[...]`
  (Postgres array overlap) — untagged rows are unreachable.
- Among the 185 tagged rows, distinct symbols in the last 7 days = 28.
  In the **last 24h, only 10 distinct symbols**, half of them indices
  or commodities (NIFTY, SENSEX, NIFTY 50, GOLD, SILVER).
- Individual NIFTY-50 stocks with news in last 24h: **only 5** (ITC,
  HINDALCO, TITAN, ONGC, GRASIM). The other 45 NIFTY-50 stocks have 0
  news tagged.

A user whose top-3 holdings are RELIANCE / HDFCBANK / INFY (extremely
common) sees three empty cards on their Home page.

**Fix paths:**

1. **One-off tagging pass over historical news_events.** Run a script
   that loads all rows with empty `instruments`, scans `title` for
   known stock symbols (NIFTY-50 + popular non-Nifty), and updates the
   `instruments` array. ~4 hours including symbol-alias dictionary
   (e.g. "Reliance Industries" → RELIANCE, "HDFC Bank" → HDFCBANK).
2. **Wire the same tagger into the ingestion path** (`markets-ingest-news`
   pg_cron job at `*/15 3-10 * * 1-5`) so new rows arrive pre-tagged.
   ~3 hours after #1.
3. **Carousel fallback tile** (frontend) — if a holding has 0 news in
   24h, render a "NIFTY 50 — market today" tile in its slot.
   ~1 hour, no backend work.

Recommended: do #1 + #3 before closed beta. Do #2 within the first
week post-launch.

## Cheap follow-on improvements (nice-to-have for closed beta)

### Stretch the news carousel lookback to 72h

Current backend uses `_LOOKBACK_HOURS = 24` in
`services/markets-worker/src/markets_worker/routers/holdings_news.py`.
Given ingestion sparsity, 24h is too tight even for indices. Bump to
72h, keep the per-symbol cap at 5 so heavy-news symbols don't drown
out quiet ones. 1-line change.

### Add a "show why" link on empty cards

The carousel hides itself entirely when no holdings have any news
(see `HoldingsNewsCarousel.tsx`). Instead, when individual cards are
empty, show a soft message: "No news on RELIANCE in the last 24h —
markets were quiet here." Communicates that the absence is meaningful,
not broken.

## Other surfaces — actual data on prod today

For sanity, these are the 7-day counts for the rest of the retail
surface (all for the single test user with a portfolio):

| Surface | 7-day count | Verdict |
|---|---|---|
| `signals` (Signals tab) | 179 / **all 1 user** | D1 above |
| `news_events` | 930 ingested, 185 tagged | D2 above |
| `rebalance_recommendations` | 1 | Works on-trigger; not the empty-state risk |
| `portfolio_risk_history` (Risk Score card) | 13 runs | Healthy |
| `behavioral_events` (cooling-off etc.) | 4 | Fires when conditions met — fine |
| `ai_briefs` | 1 | LLM-gated, expected to be sparse pre-counsel |
| `price_alerts` | 0 | User-configured; empty until friends set one |
| `portfolio_templates` (active) | 3 (Conservative / Balanced / Growth) | Good — covers risk_tag onboarding mapping |

Risk score, behavioral events, and rebalance flow all work for the
single user; their absence on a brand-new friend's account is
expected and self-resolves as the daily jobs run for them — assuming
D1 is fixed.

## Data-quality observations

- `markets.signals` only has 7 days of history (oldest = 2026-05-16).
  The 30-day backtest surfaces in the UI will look empty for any
  account that wasn't generating signals last month. Acceptable for
  closed beta — friends will only see signals generated for *them*
  going forward.
- `markets.news_events` oldest is **2016-10-05** — there's a historical
  backfill in the table that's mostly untagged. Tagging pass should
  ignore anything older than ~30 days unless we have a UI surface for
  historical context.
- pg_cron jobs that run are: `markets-ingest-news-market-hours` (every
  15m during market hours), `markets-enrich-news-hourly` (47 * * * *).
  The enrich job probably exists to do… something. **Worth checking
  whether it already does symbol tagging and is just under-performing,
  or whether tagging is missing entirely** — that decides whether D2's
  fix #1 is a backfill or a from-scratch build.

## Concrete plan for closed-beta launch

Three pieces of work, in priority order:

1. **D1 fix** — auto-enqueue signal generation on portfolio creation.
   ~1 day. (Tracked as new task — see TaskCreate below.)
2. **D2 fix #1 + #3** — historical news tagging script + carousel
   fallback tile for empty per-symbol slots. ~5 hours combined.
3. **Carousel lookback bump 24h → 72h** — 1-line change before D2
   ships to soften the gap.

Without these, friends/family will land on a Home tab with mostly
empty cards and no actionable signals. That's a closed-beta launch
failure even with 10 hand-picked users.

## Verification queries used

```sql
-- news coverage summary
SELECT count(*) AS total, count(*) FILTER (WHERE ts >= now() - interval '24 hours') AS last_24h,
       count(*) FILTER (WHERE array_length(instruments, 1) IS NULL OR array_length(instruments, 1) = 0) AS untagged,
       count(*) FILTER (WHERE array_length(instruments, 1) > 0) AS tagged,
       min(ts) AS oldest, max(ts) AS newest
FROM markets.news_events;

-- symbol coverage in last 24h
SELECT symbol, count(*) FROM (
  SELECT unnest(instruments) AS symbol FROM markets.news_events
  WHERE ts >= now() - interval '24 hours' AND array_length(instruments, 1) > 0
) GROUP BY symbol ORDER BY count(*) DESC;

-- signal volume + ownership
SELECT count(*) AS total, count(DISTINCT owner_user_id) AS distinct_owners,
       count(*) FILTER (WHERE ts >= now() - interval '24 hours') AS last_24h
FROM markets.signals;

-- user funnel
SELECT (SELECT count(*) FROM auth.users) AS users,
       (SELECT count(DISTINCT owner_user_id) FROM markets.portfolios) AS users_with_portfolios,
       (SELECT count(DISTINCT user_id) FROM markets.risk_profiles)    AS users_with_risk_profiles,
       (SELECT count(DISTINCT owner_user_id) FROM markets.broker_connections) AS users_with_brokers,
       (SELECT count(DISTINCT owner_user_id) FROM markets.signals
        WHERE ts >= now() - interval '7 days')                         AS users_with_signals_7d;

-- pg_cron jobs
SELECT jobname, schedule, command, active FROM cron.job ORDER BY jobname;
```
