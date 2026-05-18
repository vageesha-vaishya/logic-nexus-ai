# Retail Investment Recommendation Platform — Full Design

**Date:** 2026-05-18
**Status:** Design Complete — Ready for Implementation Planning
**Scope:** Extension of existing Markets module (`src/features/module-markets/` + `services/markets-worker/`)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Competitive Positioning](#2-competitive-positioning)
3. [Architecture Overview](#3-architecture-overview)
4. [Onboarding & Risk Profiling](#4-onboarding--risk-profiling)
5. [Signal Engine](#5-signal-engine)
6. [Recommendation Feed UI & Three-Tier Portfolio](#6-recommendation-feed-ui--three-tier-portfolio)
7. [Intelligent Autonomous Execution](#7-intelligent-autonomous-execution)
8. [Behavioral Support Layer](#8-behavioral-support-layer)
9. [Community Layer](#9-community-layer)
10. [Compliance & SEBI Requirements](#10-compliance--sebi-requirements)
11. [Post-Launch Monitoring](#11-post-launch-monitoring)
12. [Phased Rollout Plan](#12-phased-rollout-plan)
13. [File Structure](#13-file-structure)

---

## 1. Executive Summary

This document specifies the design for a retail-focused financial investment recommendation platform built as an extension of the existing Markets module within Logic Nexus AI. The platform democratizes access to sophisticated market insights for non-expert users across all major asset classes: stocks (long-term, short-term, intraday), mutual funds, cryptocurrencies, F&O, commodities, bonds, and forex.

**Five core differentiators vs every current competitor (Zerodha, Groww, Angel One, eToro, Wealthfront):**

1. **Transparent AI signals** — confidence scores with visible reasoning chains, not black-box recommendations
2. **Three-tier portfolio segregation** — Safety Net / Core / Experimental with separate P&L, eliminating panic selling from psychological cross-contamination
3. **Hardened autonomous execution** — LLM-adjusted pre-authorized rules with 14-point safety validation, not direct LLM-to-broker execution
4. **Loss-aversion behavioral support** — real-time market stress nudges and cooling-off screens during panic moments
5. **Contextual inline education** — triggered by user actions at the exact moment of relevance, not a content library

**MVP scope:** All asset classes from day one. Experience-level adaptive UI (Beginner / Casual / Self-directed). Web-first responsive. SEBI-compliant by April 1, 2026.

---

## 2. Competitive Positioning

### 2.1 Benchmarking Methodology (Data-Driven, Repeatable)

This platform must win on **trust, clarity, and speed** while keeping the experience simple enough for non-expert retail users. To avoid “opinion-based product design”, all competitor research should be captured with a repeatable benchmarking rubric.

**Competitor set definition**
- **Regional direct competitors (India):** platforms used by the majority of Indian retail investors for stocks + F&O (mobile-first).
- **Global direct competitors:** platforms leading in UX (beginner), execution/risk tools (pro), and social/copy trading (community).
- **Indirect competitors:** charting/analytics platforms and crypto exchanges where investors spend most of their decision time.

**Data sources to capture for each competitor**
- Store listing (Play Store/App Store): downloads, update cadence, “Data safety” disclosures, user complaint patterns (execution, latency, crash rate, payments).
- Public product pages: supported instruments, order types, risk tools, research features.
- Hands-on workflow tests (internal): onboarding steps count, taps-to-trade, time-to-first-order, latency under load.
- Published reviews/comparatives (methodology-driven) for global brokers (education, execution tools, mobile completeness).

**How to measure (required)**
- **Core screen load time:** cold start and warm start on mid-range Android + iPhone over 4G (target < 2s for home, watchlist, portfolio, order ticket).
- **Trade execution UX latency:** time from “Place order” tap → “Order acknowledged” UI state (target < 300ms UI acknowledgement; backend acknowledgement varies by broker).
- **Reliability:** crash-free sessions %, uptime of critical services, offline resilience for portfolio.
- **Navigation efficiency:** ≤ 3 taps/clicks to reach 90% of core actions: watchlist → order, portfolio → rebalance, signals → rationale → approve trade.

### 2.2 Competitive Benchmark — Top 10 (Global + Regional)

This table deliberately mixes **India-first broker UX leaders** with **global best-in-class platforms** for: execution tools, education, social trading, and professional analytics.

| Platform | Region | Strengths to Copy | Weaknesses / Risks | Differentiator to Beat |
|---|---|---|---|---|
| Zerodha Kite | India | Fast execution UI, options/chain depth, ecosystem integrations; strong product ecosystem around trading | New users can be overwhelmed; limited “plain language” guidance; education exists but not always in-context | “Pro tools + beginner clarity” in the same flow |
| Groww | India | Beginner-first UX, simple investing workflows, frictionless onboarding | Depth for advanced traders is limited compared to pro terminals | “Beginner UX without growth ceiling” |
| Upstox | India | Trading-first UI, search + order flow focus, derivatives accessibility | Can feel feature-dense; recommendation trust varies by user | “Speed + confidence + safe autonomy” |
| Angel One | India | Advisory/insights emphasis, research + signals positioning | Users often distrust “tips” unless transparency is strong | “Explainability-first signals” |
| Dhan | India | Power-user features, advanced order tools focus | Higher learning curve for novices | “Power features hidden behind adaptive UI” |
| TradingView | Global | Best-in-class charts, indicators, community ideas, alerts | Not a broker-first full stack; execution depends on integrations | “TradingView-grade analysis + broker-ready execution UX” |
| Interactive Brokers (IBKR) | Global | Multi-market breadth, advanced order types, risk controls | UX complexity; retail beginners struggle | “Institutional-grade risk controls packaged simply” |
| Charles Schwab (incl thinkorswim) | Global | Mobile completeness + research; thinkorswim deep pro tools | Complexity; not designed for India-first flows | “Pro tooling + mobile-first simplicity” |
| Robinhood | Global | Mobile-first simplicity, fast onboarding, behaviorally optimized UI | Criticized for gamification and risk; limited pro tooling | “Simple UX without dark patterns; safety rails” |
| eToro | Global | Social + copy trading experience; discovery of traders | Risk of herd behavior; transparency needed | “Copy trading with risk governance + auditability” |

Notes and sources for global broker positioning:
- Investopedia’s broker rankings cite Fidelity/IBKR/Schwab strengths around tools, mobile completeness, and international/risk capabilities. citehttps://www.investopedia.com/best-online-brokers-4587872
- Zerodha Kite app listing provides a concrete feature inventory (IPO, options chain, basket orders, GTT, etc.) and data safety claims. citehttps://play.google.com/web/store/apps/details?id=com.zerodha.kite3&hl=en-AU

### 2.3 India-Specific “Must Match” Feature Baseline (Parity List)

To be credible in India, we must hit parity on the following baseline expectations before claiming differentiation:
- Instant digital onboarding + eKYC (Aadhaar/Video where applicable), bank verification, account status tracking.
- Equity delivery + intraday + F&O, with option chain, OI, IV, greeks, and common order types (market/limit/SL/SL-M, bracket/cover where supported).
- Funds: deposit/withdraw with clear settlement states; ledger view; contract notes; tax reports; P&L statements.
- Watchlists (multiple), alerts, and portfolio breakdown (holdings, positions, realized/unrealized P&L).
- Broker integrations: at minimum one “reference broker” integration for MVP (paper trading + simulated broker as fallback).

### 2.4 Feature Inventory to Prioritize (High Impact)

This is the prioritized inventory for integration. The intent is to lead with the features that improve outcomes for non-expert users without increasing cognitive load.

**A. Market data + analytics**
- Real-time LTP, OHLC, depth (where available), and index dashboards with resilient caching and graceful degradation.
- “Explainable indicators” layer: RSI/MACD/VWAP/SuperTrend shown with plain-language interpretation.
- Event overlays: earnings, macro calendar, FII/DII flows, news sentiment.

**B. Risk management (non-negotiable)**
- Dynamic risk score per user and per instrument (volatility × leverage × concentration).
- Exposure caps by asset class and by strategy bucket (Safety/Core/Experimental).
- Automatic stop-loss / trailing stop recommendations with “why” + scenario outcomes.
- Stress testing: “What if market drops 5/10/20% tomorrow?” per portfolio and per bucket.

**C. Portfolio tracking + behavior layer**
- Time-weighted return vs money-weighted return (to avoid misleading growth perception).
- Goal tracking + progress visuals (simple, not chart-heavy).
- Offline portfolio access (last synced) with clear “stale data” badge.
- Journal + post-trade reflection prompt (lightweight), tied to signal outcomes.

**D. Trading workflows**
- One-tap approval for pre-built “suggested orders” from signals (user must explicitly approve).
- Basket orders for multi-leg actions (hedges, rebalancing).
- Copy trading with safety constraints: max allocation, drawdown stop, follower-specific risk settings.

**E. Engagement features**
- Customizable alerts: price, volatility, volume spikes, news sentiment shifts, portfolio drawdown.
- Contextual education cards triggered by user actions (not a static library).
- Community: curated “strategies/baskets” with transparent performance, risk, and audit trail.

### 2.5 UI/UX Best Practices (Web + Mobile, Retail-First)

**Design principles**
- Default to “plain language”; show advanced detail progressively (disclosure triangles, “Learn more”, drill-down).
- Always separate **decision** (recommendation) from **execution** (order) with a confirmation step and risk disclosure.
- Use consistent semantic colors: green (positive), red (risk/stop), amber (warning), neutral (hold).

**Critical flows (target ≤ 3 steps)**
- Watchlist → Open instrument → Buy/Sell ticket
- Signal feed → Rationale → Approve trade
- Portfolio → Risk view → Apply recommended risk fix (rebalance/stop-loss)
- Deposit → Status tracking → First order

**Mobile-first patterns**
- Bottom navigation: Watchlist, Signals, Portfolio, Community, Account.
- Persistent “Trade” FAB only when risk/eligibility is satisfied (otherwise shows “Why not?”).
- Order ticket as a bottom sheet (single-hand use), with “Advanced” drawer.

### 2.6 Cross-Platform Phase 1 Architecture (Native-Like Mobile + Web Parity)

Because this repo is already a Vite + React web app, the fastest path to “mobile app + web parity” is:
- **Web:** responsive app + installable PWA
- **Mobile apps:** thin native shell via Capacitor (iOS/Android), pointing at the same UI bundle and APIs

**Why this wins Phase 1**
- One UI codebase with device-specific bridges (biometrics, push, secure storage).
- Faster iteration and guaranteed feature parity.
- Offline-first and caching are solved once (service worker + storage layer).

**Mandatory Phase 1 mobile capabilities**
- Push notifications: alerts, signal approvals, risk warnings.
- Biometric login (FaceID/TouchID) using platform keychain/secure enclave.
- Offline portfolio access: cached holdings + last prices; explicit stale-state UI.

**Performance gates (Phase 1 acceptance)**
- < 2s load for core screens on 4G networks (home/watchlist/portfolio/order).
- Crash-free sessions target ≥ 99.5% for mobile shell.
- 90% of core features reachable in ≤ 3 interactions.

**Security baseline**
- MFA (TOTP + optional device binding), risk-based auth challenges on sensitive actions.
- Device-bound tokens stored in secure storage on mobile shells.
- Event audit logging: every order approval, portfolio change, and permissions change.

### What Competitors Do Well (To Match)

| Feature | Best-in-class | Our approach |
|---|---|---|
| Clean beginner UI | Groww | Adaptive UI per experience level |
| AI recommendations | Angel One ARQ Prime | Hybrid rule-based + LLM with confidence scores |
| Copy trading | eToro CopyTrader | Extend existing copy trades module |
| Goal-based investing | Betterment / Kuvera | Goal-first onboarding (not risk-first) |
| Thematic baskets | Smallcase | Community basket marketplace |
| Automated rebalancing | M1 Finance | Deposit-driven rebalancing (no selling) |
| Aggregated tracking | INDmoney | External demat import across all brokers |
| No-code algo | Zerodha Streak | Plain-language rule builder |
| Multilingual | Groww | Hindi + regional languages (Phase 2) |

### Gaps No Competitor Fills (Our Differentiators)

1. **Loss aversion management** — behavioral nudges + cooling-off screens during market stress
2. **Contextual just-in-time education** — inline, triggered by specific user actions
3. **Three-tier risk bucket segregation** — separate P&L per Safety Net / Core / Experimental
4. **Transparent AI confidence with reasoning chain** — every signal shows why, not just what
5. **Hardened autonomous execution** — 4-layer safety architecture, SEBI-compliant

---

## 3. Architecture Overview

The platform is a **Retail Intelligence Layer** added to the existing Markets module — not a separate app or service.

### What Is Reused (Not Rebuilt)

- SIP automation → extended for all asset classes
- Copy trading module → extended into community layer
- Broker order execution (`QuickTradeButton`) → reused for one-tap approval
- Portfolio P&L tracking → extended with three-tier view
- Alerts infrastructure → extended for behavioral nudges
- Screener → feeds signal engine candidate universe
- LLM chat infrastructure → reused for signal explanations and agents
- Market breadth & sector heatmap → feeds signal engine context

### New Top-Level Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                    Retail Intelligence Layer                     │
├────────────┬──────────────┬─────────────────┬───────────────────┤
│  Adaptive  │   Signal     │   Autonomous    │   Behavioral      │
│  Onboarding│   Engine     │   Execution     │   Support         │
│  & Risk    │   (6-tier    │   (4-layer      │   (Loss aversion  │
│  Profiling │   pipeline)  │   safety model) │   + inline edu)   │
├────────────┴──────────────┴─────────────────┴───────────────────┤
│                    Community Layer                                │
│         (Thematic baskets + Copy trading + Strategy market)      │
├─────────────────────────────────────────────────────────────────┤
│              Existing Markets Module (reused)                    │
│     Screener | Alerts | SIP | Copy Trades | Portfolio P&L        │
│     Broker Execution | Options Builder | LLM Chat | Charts        │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Market data → Layer 0 validation → Signal Engine → Scored signals + LLM explanations
     → Recommendation Feed → User one-tap approves OR Autonomous rule triggers
     → Broker execution layer → Portfolio tracking → Behavioral support feedback loop
```

### Frontend Location

`src/features/module-markets/retail/` — new sub-feature within existing markets module

### Backend Location

`services/markets-worker/` — new routers and modules added to existing Python service

---

## 4. Onboarding & Risk Profiling

### Philosophy: Goal-First, Not Risk-First

Research shows goal framing reduces decision paralysis and increases retention. "What are you investing for?" beats "What's your risk tolerance?" every time.

### 5-Step Onboarding Flow (Under 3 Minutes)

**Step 1 — Experience level**
User selects one: Beginner / Casual / Self-directed. Sets default UI density and information depth across the entire platform. Can be changed anytime in settings.

**Step 2 — Life goals**
User picks 1–3 from:
- Retirement
- Emergency Fund / Safety Net
- Wealth Growth
- Child's Education
- Home Purchase
- Short-term Income
- "Just exploring"

**Step 3 — Timeline per goal**
Slider per selected goal: 1 / 3 / 5 / 10 / 20+ years.

**Step 4 — Scenario-based risk quiz (4 questions)**
Uses real scenarios, not abstract percentages:

- "Your ₹1 lakh investment drops to ₹75,000 in 3 months. You…" → Sell / Hold / Buy more
- "You see a trending stock tip on social media. You…" → Investigate / Buy small amount / Ignore
- "Markets have fallen 20%. Your advisor says to wait. You…" → Sell anyway / Wait / Invest more
- "You need this money in 2 years. Would you invest it in stocks?" → Yes / Some of it / No

**Step 5 — Three-tier portfolio setup**
User allocates starting capital across three buckets (absolute amounts, not percentages):

| Tier | Name | Purpose | Suggested Amount |
|---|---|---|---|
| 1 | Safety Net | Capital protected, emergency access | 3–6 months expenses |
| 2 | Core Portfolio | Long-term wealth, auto-managed | Remainder of stable savings |
| 3 | Experimental | Active signals, play money, separate P&L | Only what you can afford to lose |

Default suggestion shown based on onboarding answers. User can override freely.

### Output

- **Risk profile tag:** Conservative / Moderate / Aggressive
- **Behavioral flags:** e.g., "tends toward panic selling" — derived from quiz answers
- **Goal timeline map:** drives which signals appear in the feed
- **Tier allocations:** stored per user, drive portfolio segregation

### Continuous Profile Evolution

The risk profile is not static. It updates based on observed behavior:
- User ignores 10 consecutive sell signals → profile recalibrates toward "buy and hold"
- User tends to sell during dips → loss-aversion alerts activate at lower threshold
- User manually overrides autonomous execution frequently → system suggests moving to lower autonomy level

---

## 5. Signal Engine

A 6-tier pipeline running inside `services/markets-worker/`. Scheduled: every 15 minutes for intraday signals, daily EOD batch for long-term signals.

### Tier 1: Data Ingestion

**Real-time stream (Kafka topics):**
Tick data from broker WebSocket feeds → `market-data`, `options-flow`, `sentiment-stream` topics via Spark Structured Streaming. Target latency: <100ms intraday, <5 seconds swing.

**Daily batch (post 4 PM IST via Airflow):**
Fundamentals, FII/DII flows (NSE publishes 4–6:30 PM IST), MF NAV, insider disclosures, on-chain crypto metrics.

**Alternative data feeds:**
- Unusual options activity: volume/OI ratio >5× average, buys above ask = bullish conviction
- FII/DII 3–5 session trend (single-day spikes filtered as noise; requires 3 consecutive sessions minimum)
- Insider cluster purchases (single sales ignored; cluster buys = ~21% excess returns per research)
- FinBERT-scored news sentiment (96–98% precision on financial text)
- On-chain crypto: hash rate, whale wallet transfers, Fear & Greed Index

### Tier 2: Feature Engineering

Research confirms: lightweight, well-selected features outperform feature-heavy models.

**Tier 1 features (mandatory):**
Daily returns, EMA-20/50/200, 20-day rolling volatility (std dev), ATR, volume ratio vs 20-day average

**Tier 2 features:**
RSI, MACD histogram, Bollinger Band position, VWAP deviation, OBV

**Tier 3 features (signal enhancement):**
FII net flow (3-session rolling), options IV percentile, news sentiment z-score

**Asset-class-specific additions:**

| Asset Class | Additional Features |
|---|---|
| Stocks | PE vs sector median (z-score), ROE >30% flag, earnings momentum (YoY profit >15%), EPS growth |
| Mutual Funds | Rolling alpha vs benchmark, Sharpe ratio, expense ratio, rolling 3/5-year returns |
| Crypto | On-chain hash rate, exchange inflow/outflow, dominance metrics, Fear & Greed Index |
| F&O | Delta, gamma, theta, IV rank, PCR, Max Pain level, unusual options flow |
| Commodities | Seasonal patterns, supply/demand indicators, dollar index correlation |
| Bonds | Duration, yield spread vs benchmark, credit rating, macroeconomic indicators |
| Forex | Interest rate differential, economic calendar events, COT (Commitment of Traders) data |

### Tier 3: Signal Generation — Hybrid Rule-Based + ML Ensemble

**Critical constraint from research:** Use 2–3 indicators from *different* categories only. More indicators destroy win rates by overfitting.

**Per asset class and horizon:**

| Asset Class | Horizon | Combination | Expected Win Rate |
|---|---|---|---|
| Stocks | Intraday | VWAP + EMA(9/21) + RSI + Supertrend | 65–75% |
| Stocks | Swing (5–20d) | RSI + Bollinger Bands + Volume confirmation | 60–68% |
| Stocks | Long-term | 200-day MA + Fundamental score | 58–65% |
| Mutual Funds | Long-term | Rolling Sharpe + Alpha + expense ratio | Ranking, not direction |
| Crypto | Swing | RSI + MACD + on-chain flow | 55–63% |
| F&O | Intraday | PCR + IV Rank + Delta + unusual flow | 55–63% |
| Commodities | Swing | Seasonal + momentum + volume | 57–64% |
| Bonds | Long-term | Duration + yield spread + macro score | Ranking + direction |
| Forex | Swing | Interest diff + momentum + sentiment | 56–62% |

**Volume confirmation is mandatory:** Breakouts on 50%+ above 20-day average succeed significantly more. Low-volume signals penalized −15% confidence automatically.

**ML Ensemble (nightly, informs next-day signals):**
- XGBoost for feature selection (SHAP importance values identify what matters)
- LSTM for sequence prediction on selected features
- Walk-forward validation only — no k-fold (prevents data leakage)
- Training window: 3–6 months rolling (shorter handles non-stationarity)
- Regime detection: separate bull / bear / sideways models
- Hybrid LSTM+XGBoost consistently outperforms either alone per research

**Weighting by horizon:**

| Horizon | Technical | Fundamental | Volume | Sentiment |
|---|---|---|---|---|
| Short-term | 65% | 20% | 10% | 5% |
| Medium-term | 45% | 40% | 10% | 5% |
| Long-term | 25% | 60% | 10% | 5% |

### Tier 4: Confidence Scoring with Decay

**Confidence formula:**
```
Confidence = (Technical_score × 0.40)
           + (Fundamental_score × 0.35)
           + (Volume_score × 0.15)
           + (Sentiment_score × 0.10)

Time-adjusted = Confidence × e^(-decay_rate × time_elapsed)
```

**Signal decay rates:**

| Horizon | Validity | Decay Rate |
|---|---|---|
| Intraday | Hours | −20%/hour |
| Swing | 5–20 days | −15%/week |
| Long-term | Months | −5%/quarter |

**Threshold:** Only signals scoring ≥60% released to feed.

| Score | Label |
|---|---|
| 60–70% | Moderate |
| 70–85% | Strong |
| >85% | High Conviction |

**Realistic accuracy expectations (for honest display):**
- Random signals: ~50% (coin flip baseline)
- Basic technical: 50–60%
- Optimised hybrid (this platform): 55–70%
- Professional quants: 55–65%

Win rate >70% in live trading = likely overfitted. Displayed accuracy always shown with 95% confidence interval, broken down by market regime (bull/bear/sideways), with Profit Factor and Sharpe Ratio alongside.

### Tier 5: LLM Explanation Layer

Each scored signal passes to the existing LLM infrastructure with the full reasoning JSON. Temperature = 0 (deterministic). Output format is structured JSON, not free text.

**Three explanation depths:**

**Beginner:**
> "Reliance looks like a good buy right now. More big investors are buying it than selling, and its business has been growing steadily for 2 years."

**Casual:**
> "RSI at 62 shows rising momentum. Earnings grew 18% last quarter vs same period. Confidence: 73% (Strong). Suggested entry: ₹2,890–₹2,910."

**Self-directed:**
> "Bullish. EMA20 crossed above EMA50 (trend confirmation). RSI 62 — momentum, not overbought. Volume 68% above 20-day avg (strong confirmation). PE 24× vs sector 26× (slight discount). Earnings momentum +18% YoY. FII net buyers 4 of last 5 sessions. Unusual call activity at 3000 strike (IV rank 72). Confidence: 73% (95% CI: 70%–76%). Historical accuracy this signal type: 68% over 847 signals (2 years). Stop: ₹2,820. Target: ₹3,050. Risk/Reward: 1:2.3."

### Tier 6: Compliance Guardrails

Every signal stored in Supabase `signals` table with: instrument, asset class, direction, confidence, confidence interval, reasoning JSON, explanation per level, data sources used, expiry timestamp, SEBI-required disclaimers.

**Strategy decay monitoring:**
Monthly comparison of current signal accuracy vs 3-month average at deployment. Degradation >15% → strategy flagged "Review Required", autonomous execution paused. ML ensemble retrained every 6 months via walk-forward revalidation.

---

## 6. Recommendation Feed UI & Three-Tier Portfolio

### Three-Tier Portfolio Architecture

**The biggest structural differentiator.** Separate P&L dashboards per tier eliminate psychological cross-contamination — users who see Experimental tier down 12% don't panic about their Core tier.

| Tier | Name | Purpose | Signal Access | Rebalancing |
|---|---|---|---|---|
| 1 | Safety Net | Capital protected, liquid | None | None |
| 2 | Core Portfolio | Long-term wealth | High Conviction only (≥70%) | Deposit-driven (M1-style) |
| 3 | Experimental | Active trading, play money | All signals, all horizons | Manual |

**Core Portfolio rebalancing (M1 Finance approach):**
New deposits automatically directed to underweight assets. No selling required — no capital gains triggered. Drift threshold: rebalance when any asset class exceeds target allocation by ±5%. User sees: "Your next ₹5,000 deposit will go 60% to equity, 40% to bonds to rebalance your Core Portfolio."

**External portfolio import (INDmoney-style differentiator):**
Users link external demat accounts via broker API to pull in holdings bought elsewhere. Single true portfolio view across all brokers. Separate from the three-tier structure — imported holdings are shown as "External" until user assigns them to a tier.

### Recommendation Feed

**Component:** `RetailSignalFeed.tsx`

**Beginner view:**
Large card per signal. Instrument name, plain-English headline, coloured action button (Buy / Hold / Sell), confidence as a label ("Strong"). No charts, no numbers except price and estimated return. One-tap approve → confirmation bottom sheet.

**Casual view:**
Same card + 2-line explanation + confidence % + asset class tag + horizon badge. Tap to expand: 3 plain-English bullet points of reasoning.

**Self-directed view:**
Full signal card: confidence score with CI, each contributing factor with weight, historical accuracy for this signal type, entry/stop/target levels, Sharpe ratio. Inline 30-day sparkline chart.

**Feed filtering:**
Asset class, horizon, tier (Core / Experimental), minimum confidence. Defaults to user's risk profile — Conservative users see only High Conviction long-term signals by default.

### One-Tap Execution Flow

Tapping "Execute" opens a **bottom sheet** (no page navigation):

1. Plain-English order summary: "Buy 5 shares of HDFC Bank at ₹1,840 = ₹9,200 total"
2. Tier selector: Core or Experimental (pre-selected based on signal type, overridable)
3. One mandatory SEBI-required risk disclosure sentence
4. Confirm → fires existing `QuickTradeButton` broker integration

Execution result surfaces inline on the card. Failed orders show broker error in plain English + a suggested fix.

### Portfolio Dashboard

Three tabs — one per tier:
- Current value + absolute and % gain/loss from entry
- Asset allocation donut with plain-English labels (not tickers)
- Recent activity: last 5 signals acted on with outcome
- Core tier: rebalancing status message
- Goal progress anchor shown prominently (see Section 8)

---

## 7. Intelligent Autonomous Execution

### Core Design Principle

**LLM acts as the brain that sets and adjusts rules. Pre-authorized conditional orders are the hands that execute. LLM never directly triggers a broker order.**

This eliminates the hallucination risk (LLMs achieve only 8.4% accuracy with incomplete information) while preserving intelligent, context-aware execution. The execution layer remains white-box and SEBI-compliant.

### Four-Layer Safety Architecture

```
Layer 0: Pre-Flight Validation    →  Data integrity, staleness, corporate actions
Layer 1: LLM Decision Brain       →  Multi-agent reasoning (tools only, no memory hallucination)
Layer 2: Rule Engine              →  Pre-authorized conditional orders, idempotency, fat-finger checks
Layer 3: Broker OMS               →  Execution, Algo-ID tagging, audit trail, kill switches
```

### Layer 0: Pre-Flight Data Validation

Runs before the LLM or Rule Engine sees any data. Garbage in = garbage out.

**1. Price staleness gate**
Reject price feeds where `(now − last_update_timestamp) > 5 seconds` for equities, `> 100ms` for options. If primary feed is stale → failover to backup feed → if both stale → halt all autonomous execution, alert user.

**2. Cross-source triangulation**
Price validated against 3 independent sources. Divergence >0.5% → hold execution, flag for human review. Reduces data errors by 50% per research.

**3. Corporate action detection**
Pre-market check daily: dividends, splits, bonus issues, rights issues, delistings for instruments with active rules. Detected → suspend affected rules → notify user → resume after corporate action is processed.

**4. Bad tick filtering**
Reject: zero/negative prices, price deviation >10% from previous tick in <1 second, spread widening >5× historical average. All rejections logged.

**5. Exchange circuit breaker status**
Poll NSE/BSE every 30 seconds. Circuit breaker active → pause execution on affected instruments → queue orders → resume post-halt with user notification.

**6. Clock synchronization**
All timestamps synchronized to NTP server. Maximum drift: 100ms. Exceeds threshold → halt execution until sync restored.

### Layer 1: LLM Decision Brain

**LLM accesses data only via tools — never from memory.** This eliminates hallucinations for market data. When a tool fails to return data, the LLM returns "insufficient data — recommend no action."

**Prompt injection defense:**
All external text (news, social media, earnings transcripts) passes through a sanitization classifier before reaching the LLM prompt. Injected instructions are detected and stripped.

**Context window overflow protection:**
Each agent operates on a bounded context. If context exceeds 80% capacity mid-decision → agent outputs "context limit reached — deferring to rule engine defaults." Never silently truncates.

**Temperature = 0** for all execution-path decisions. Temperature > 0 only for explanation generation.

**Multi-agent debate (TradingAgents framework):**

| Agent | Role |
|---|---|
| Bull Agent | Argues bullish case using tool-fetched technical + fundamental + FII data |
| Bear Agent | Argues bearish case using same data |
| Risk Agent | Evaluates both arguments against current portfolio exposure, daily loss remaining, position correlation |
| Trader Agent | Synthesizes into a proposed rule change (not an execution order) |

**LLM outputs a proposed rule change, not a trade.** Rule changes require user approval for Guard and Rule mode users. Algo mode users can pre-authorize automatic adjustments within defined bounds.

**Escalation to human (autonomous execution halts, urgent notification sent):**
- Confidence interval width > 15%
- Bull and Bear agents cannot reach consensus after 3 rounds
- Any circuit breaker condition detected
- Market volatility spikes > 2 standard deviations from 30-day average
- Daily loss limit within 20% of threshold

**LLM confidence calibration:**
Output is structured JSON: `{"direction": "buy", "confidence_low": 0.62, "confidence_high": 0.71, "reasoning": [...]}`. Displayed confidence is calibrated to observed historical win rates, not raw LLM output probability.

### Layer 2: Rule Engine

**Idempotency and race condition prevention:**
Every rule evaluation assigned a UUID idempotency key. Two signals for same instrument within 500ms → only first processed (Redis in-memory deduplication). Prevents double execution.

**Fat-finger detection (blocks before submission):**
1. Order size > 10% of instrument's average daily volume
2. Order value > 20% of user's total portfolio
3. Price deviation > 5% from current market price (limit orders)
4. Quantity suspiciously larger than user's historical order pattern

**Gap risk disclosure:**
Stop-loss orders submitted as exchange-side GTT orders, not client-side watchers. Survives offline. Gap risk disclosed during rule setup in plain English:

> "If bad news hits overnight, your stop at ₹1,790 means you'll sell when the market opens — which could be at ₹1,600 if the news is severe. This is gap risk. Would you like to set a hard floor at ₹1,500 below which you'd rather not sell automatically?"

**Available order types:**

| Order Type | Description | Access Level |
|---|---|---|
| Smart Stop-Loss | ATR-based, exchange-side, survives offline | All levels |
| Trailing Stop-Loss | Stop price follows rising price, locks in profits | Rule + Algo |
| Bracket Order | Entry + stop + target simultaneously, OCO on exit | Rule + Algo |
| OCO | Two exits, first fill cancels other | Rule + Algo |
| Time-Based Exit | Auto-exit at specified time (e.g., 3:20 PM intraday) | Algo |
| LLM-Adjusted Rule | LLM proposes adjustment, user approves (or pre-authorized within bounds) | Rule (approval) / Algo (bounds) |

**LLM morning review (8:30–9:00 AM IST pre-market):**
LLM reviews open rules against overnight news, earnings, FII data, signal confidence changes. Proposes adjustments as plain-English notifications:

> "I've tightened your HDFC Bank stop-loss from ₹1,790 to ₹1,810 because RBI announces a rate decision today. Approve this change? [Approve] [Ignore]"

LLM never modifies a rule without explicit user approval for Guard and Rule mode users.

### Layer 3: Broker OMS

**Execution flow:**
```
Rule condition fires
  → Layer 0 validation (re-run before execution)
  → Fat-finger checks
  → Idempotency check
  → Risk limits (daily loss, position size, portfolio %)
  → Broker API (Angel One SmartAPI / Zerodha / Fyers)
  → Order tagged with Algo-ID
  → Fill confirmation received
  → Push notification (plain English)
  → Audit log written to Supabase
```

**Multi-level kill switch (network-independent design):**

| Level | Trigger | Action | Network Required? |
|---|---|---|---|
| Per-trade | Price deviation >5% from expected | Cancel single order | No — exchange-side |
| Per-strategy | Strategy daily loss > limit | Pause strategy, cancel open orders | No — exchange-side GTT |
| Per-account | Account drawdown > user-defined limit | Liquidate all positions at market | No — pre-submitted stops at exchange |
| Platform-wide | System error rate >1% or latency >500ms | Halt all new execution | Yes — but existing stops remain at exchange |

Stop-loss orders exist at the exchange level even if the platform's servers go down. Lesson from Knight Capital 2012: kill switch must not depend on platform operational status.

**Failure handling:**
- Partial fills → retry remaining quantity once → alert user for manual decision
- Network failure → idempotent retry with deduplication key, max 3 attempts, exponential backoff
- Broker rejection → immediate push notification with plain-English reason + manual fallback link
- Exchange halt → queue orders → execute on resumption → notify user

### Three Autonomy Levels

| Level | Name | Who | What Runs Autonomously | User Action Required |
|---|---|---|---|---|
| 1 | Guard Mode | Beginners | Stop-loss only (capital protection) | Set once, modify anytime |
| 2 | Rule Mode | Casual investors | GTT + trailing stop + profit target | Rules set once; LLM adjustments require approval |
| 3 | Algo Mode | Self-directed | Full bracket orders + multi-condition strategies | Setup only; LLM adjustments within pre-authorized bounds |

### Mandatory Gradual Autonomy Phases

No user goes live with full autonomous execution immediately:

**Phase 1: Paper Trading (minimum 30 days)**
Live market data, no real orders. System shows what would have executed and at what P&L. Cannot skip. User must see at least one volatile period.

**Phase 2: Micro-Live (minimum 14 days, max 5% of portfolio)**
Real orders, hard cap at 5% of total portfolio. Slippage measured, order rejections handled, notifications verified.

**Phase 3: Pilot (4–8 weeks, max 25% of portfolio)**
System tested across market conditions. Kill switch deliberately tested. User confirms daily loss limits.

**Phase 4: Full Autonomy**
Unlocked only after Phases 1–3 complete. Weekly performance review required.

### Audit Trail (SEBI-Mandated, 7-Year Retention)

Every automated order logs:

```
order_id, algo_id (exchange-assigned), strategy_version,
client_id, broker_id, static_ip, api_key,
instrument, side, quantity, price, order_type,
trigger_condition (plain text),
pre_trade_checks (JSON: all checks + results),
llm_recommendation (JSON: agent outputs, confidence CI),
user_approved_rule (bool + timestamp),
execution_timestamp (nanosecond), fill_price, fill_quantity,
slippage (fill_price − signal_price),
p_and_l_attribution (which signal, which strategy),
kill_switch_active (bool),
data_sources_validated (bool + source list)
```

### Tax Risk Management

Frequent automated trading (>20–30 trades/month) may be classified as business income by Indian Income Tax Department — taxed at slab rates (up to 30%) vs capital gains (STCG 20%, LTCG 12.5%).

Platform response:
- Real-time monthly trade count tracker
- Alert at 15 trades/month: "At this pace, gains may be taxed as business income (up to 30%) vs short-term capital gains (20%). Consider reviewing strategy frequency."
- Exportable trade logs in ITR-compatible format
- STT auto-calculated and included in every trade record

### Execution Summary (What Happened While Away)

On app open after absence, **Execution Summary card** at dashboard top:

**Action Required (red):**
> "HDFC Bank stop-loss triggered but filled at ₹1,761 — ₹29 below your stop of ₹1,790 due to gap open (overnight news). Loss: ₹1,450 vs estimated ₹1,100. This is gap risk. [Learn more]"

**Completed (green):**
> "SIP executed: ₹5,000 added to Parag Parikh Flexi Cap at NAV ₹72.43."

**Pending (amber):**
> "Reliance bracket order still open. Target ₹2,950. Stop ₹2,820 at exchange. [Modify] [Cancel]"

Every item tappable → full audit trail: timestamp, data validated, pre-trade checks, fill details, slippage, tax impact.

---

## 8. Behavioral Support Layer

No competitor implements this. Loss aversion and knowledge gaps are the #1 reason retail investors make poor decisions and abandon platforms.

### Sub-Feature 1: Loss Aversion Management

**Market stress detection — two continuous signals:**
1. Portfolio drawdown from peak (user's portfolio)
2. Market stress: Nifty/Sensex down >2% intraday, or VIX-equivalent spikes >2 standard deviations

**Three-tier response:**

**Yellow Alert — portfolio down 5–10% from peak:**
Calm, non-alarming push notification:
> "Markets are moving today. Your portfolio is down ₹4,200 (6.1%) from its recent high. This is normal for a long-term portfolio. No action needed."

In-app: gentle header banner showing drawdown + historical recovery context (how often this drawdown level recovered, median timeframe). Single action: "See historical recoveries."

**Orange Alert — portfolio down 10–20%:**
Proactive push + in-app modal on next open:
> "Your portfolio is down 14% from its peak. In the last 20 years, portfolios with your allocation recovered from 15% drawdowns within 14 months on average. Selling now locks in this loss permanently."

Modal shows a simple chart of historical Indian equity drawdown events with recovery timelines. Two actions: "I understand, keep holding" and "I want to speak to support."

**Red Alert — portfolio down >20% OR user about to manually sell entire Core Portfolio during downturn:**
Mandatory cooling-off screen before sell order placed:
> "You're about to sell your entire long-term portfolio during a market dip.
>
> — Investors who sold during the COVID crash (March 2020) and didn't reinvest missed a 100% recovery in 18 months
> — Your portfolio needs ₹X to reach your retirement goal. Selling today sets that goal back by ~3 years.
>
> [Wait 24 hours] [Talk to support] [Proceed anyway]"

"Wait 24 hours" postpones the sell and sends a reminder tomorrow. "Proceed anyway" executes but logs a behavioral flag.

**Critical principle:** None of these screens block the user from selling. They inform and slow down — they never prevent. Blocking erodes trust and creates legal liability.

### Sub-Feature 2: Contextual Inline Education

Triggered by user actions at the exact moment of relevance. Not a content library.

**12 high-value trigger moments:**

| User Action | Education Shown |
|---|---|
| About to buy stock with <50K daily volume | "Low liquidity: This stock trades ₹X/day. Your ₹50,000 order is Y% of daily volume — getting a good price and selling later may be hard." |
| Comparing two mutual funds | Inline cost comparison: "Fund A (0.5% expense ratio) costs ₹500/year on ₹1L. Fund B (1.8%) costs ₹1,800. Over 20 years that difference compounds to ₹47,000." |
| Setting stop-loss for first time | "A stop-loss automatically sells if price falls to your level. It protects against large losses but won't protect against gap-down openings." |
| Enabling F&O trading | Mandatory 3-screen education: options risk, max loss scenarios, time decay. Quiz at end. Cannot enable F&O without completing. |
| Portfolio concentrated >40% in one stock | "Your portfolio is 43% in Reliance. A typical diversified portfolio keeps no single stock above 10%. High concentration means one company's problems can severely hurt you." |
| First intraday trade | "Intraday means you must sell before 3:30 PM today. If you forget, your broker will auto-square off at market price, which may not be favourable." |
| Viewing a High Conviction signal | Show historical accuracy: "This signal type has been right 68% of the time over 2 years — meaning 32% of the time it was wrong. Only invest what you can afford to lose." |
| About to execute during high VIX | "Markets are unusually volatile. Prices are moving fast — your order may fill at a very different price than shown. Consider a limit order instead of market order." |
| First SIP setup | "SIP invests the same amount every month regardless of market conditions. When markets fall, your ₹5,000 buys more units — this is called rupee cost averaging." |
| Checking portfolio after green day | "Your portfolio gained ₹3,200 today. Long-term investors who stay invested through ups and downs historically outperform those who try to time the market." |
| Enabling autonomous execution | Full 5-screen autonomy onboarding: how it works, what can go wrong, kill switch location, tax implications, SEBI protections. Cannot skip. |
| Approaching monthly trade count limit | Tax classification warning (detailed earlier). |

**Delivery format (adaptive):**
- Beginner: Single sentence + simple visual. Dismisses in 3 seconds. Non-blocking.
- Casual: 2–3 sentences + one data point. Tap to expand.
- Self-directed: Full statistics, historical data, can be permanently disabled ("Don't show basic tips").

**No fatigue:** Each education card shown maximum once per context type. "Lessons learned" log shows users their education history — builds progress sense.

### Sub-Feature 3: Goal Progress Anchoring

Every portfolio view shows two numbers side by side:

```
Today's value:     ₹4,82,300    (▼ ₹8,400 today)
Goal progress:     67% of ₹8,00,000 retirement target   (on track for 2038)
```

During downturns, the goal progress number barely moves — reframes "I lost ₹8,400 today" as "I'm still 67% toward my goal." This is the most powerful behavioral tool, derived from Betterment's goal-based research.

### Sub-Feature 4: Behavioral Profile (Continuous Learning)

System tracks behavioral patterns and personalizes responses:

- User consistently ignores stop-losses → next stop-loss setup shows their historical max loss without one
- User tends to sell during dips → Yellow Alert activates at 8% drawdown instead of 10%
- User has never tested kill switch → monthly reminder
- User accepted all LLM rule adjustments without reviewing → mandatory 24-hour review delay added for larger adjustments
- User completed cooling-off period and didn't sell → positive reinforcement notification next day

Behavioral flags feed back into the risk profiling — profile evolves based on actual behavior, not just onboarding quiz answers.

---

## 9. Community Layer

### Sub-Feature 1: Thematic Baskets (Smallcase-style)

Users and SEBI-registered research analysts can create **Baskets** — curated collections of stocks/ETFs/MFs representing a theme or strategy.

**Examples:**
- "India EV Revolution" — stocks across EV manufacturing, charging infrastructure, battery supply
- "Dividend Income" — high-yield dividend stocks with >3% yield and 5-year payout consistency
- "Nifty Alpha 50" — stocks with highest risk-adjusted returns vs Nifty 50
- "PSU Turnaround" — fundamentally improving public sector companies

**Basket creation (for verified creators):**
1. Define theme and investment rationale
2. Select instruments (stocks, ETFs, MFs) with weightings
3. Define rebalancing criteria and frequency
4. Backtest displayed automatically
5. Submit for SEBI compliance review before publishing

**User interaction:**
- Browse baskets by theme, performance, risk level
- One-tap invest: allocates user's specified amount across basket instruments
- Track basket-level P&L separately from individual holdings
- Follow basket creator for updates and rebalancing notifications

**Quarterly rebalancing:**
Platform notifies users when a basket they hold requires rebalancing. User approves rebalancing in one tap. Sells removed instruments → uses proceeds for new ones → notifies of any shortfall.

### Sub-Feature 2: Copy Trading Extension

Extends the existing copy trades module with retail-friendly features:

**Creator discovery:**
Browse top-performing traders ranked by: risk-adjusted returns (Sharpe ratio), max drawdown, consistency (% months positive), follower count. Transparent metrics — no hiding of losing periods.

**Partial copy:**
Copy only a specific strategy from a trader (e.g., their long-term stock picks but not their intraday F&O trades). Users set a copy budget cap.

**Safety limits:**
- Maximum allocation to any single copied trader: 20% of Experimental tier
- Cannot copy traders into Core Portfolio or Safety Net tier
- Automatic unfollow if copied trader's max drawdown exceeds user's configured limit

**Creator accountability:**
Creators must trade with their own real money in the same strategy they offer for copying. Performance metrics are real, not simulated.

### Sub-Feature 3: Strategy Marketplace

Community-contributed no-code automation strategies:

**Browse and deploy:**
Users browse pre-built strategies (e.g., "RSI Reversal for Nifty 50 stocks", "Momentum SIP top-up"). Each strategy shows: backtest performance, walk-forward validation results, number of live users, creator rating.

**Paper trade before live:**
Any community strategy must be paper-traded for 14 days before live deployment. System enforces this.

**Rating system:**
Users rate strategies after 30+ days of live use. Only users with active deployments can rate — no fake reviews.

---

## 10. Compliance & SEBI Requirements

### SEBI Algo Trading Compliance Deadlines

| Deadline | Requirement | Status |
|---|---|---|
| Oct 31, 2025 | API algo product application + first strategy registered | Must complete |
| Nov 30, 2025 | All strategies registered with exchange | Must complete |
| Jan 3, 2026 | Exchange mock session participation, evidence submitted | Must complete |
| Apr 1, 2026 | Full compliance mandatory — no exceptions | Hard deadline |

### White-Box vs Black-Box Classification

**Execution layer (white-box):** Rule engine uses fully documented, deterministic conditions. No SEBI RA license required. Executes orders based on pre-defined conditions (GTT, trailing stop, bracket) — all transparent.

**LLM recommendation layer (black-box):** The LLM multi-agent system qualifies as a black-box algorithm. Platform must either:
- Hold SEBI Research Analyst (RA) license, OR
- Position LLM strictly as advisory (proposes rule changes, user approves) — never as direct execution trigger

The current architecture (LLM → proposed rule change → user approval → Rule Engine → execution) satisfies the second path. LLM never directly triggers an order.

### Mandatory User Disclosures

Before enabling autonomous trading, user must read and confirm:

1. Strategy documentation in plain language
2. Historical performance with walk-forward validation results
3. Risk metrics: max drawdown, Sharpe ratio, win rate with CI
4. Cost transparency: brokerage, STT, platform charges
5. SEBI registration details (Algo-ID, strategy ID)
6. Kill switch triggers and location
7. Tax implications for automated trading frequency
8. Written consent for autonomous execution

### Signal Display Compliance

Every signal must show:
- "Past performance is not indicative of future results"
- Confidence interval (not just point estimate)
- Accuracy broken down by market regime
- Backtesting assumptions (slippage, brokerage, walk-forward methodology)
- AI usage disclosure

### Investor Grievance

SEBI SCORES portal integration. Users can file complaints directly from the app. Broker must respond within 21 calendar days with Action Taken Report.

**Algo-specific grievance types handled:**
- Unauthorized execution
- Data feed failure causing losses
- Kill switch failure
- Excessive slippage vs expected
- Strategy underperformance vs disclosed backtest

---

## 11. Post-Launch Monitoring

### Signal Accuracy Tracking

**Monthly review cycle:**
- Win rate by signal type, asset class, horizon, market regime
- Profit Factor (sum wins / sum losses) — target >1.3
- Sharpe Ratio of following all signals — target >0.8
- Slippage: actual fill vs signal price — target <0.3%

**Strategy decay detection:**
Current month accuracy vs 3-month deployment average. Degradation >15% → automated alert → strategy review → potential suspension.

**Walk-forward revalidation every 6 months:**
Full ML ensemble retrained on latest data. Out-of-sample performance below threshold → downgrade strategy from Active to Review Required.

### User Portfolio Growth Metrics

Tracked per user cohort (by onboarding date, risk profile, experience level):
- Average portfolio growth vs Nifty 50 benchmark
- Average drawdown experienced vs drawdown in benchmark
- % of users who completed paper trading phase
- % of users who activated autonomous execution
- % of users who survived first >10% market correction without panic selling
- Retention at 30 / 90 / 180 / 365 days

### Platform Usage Patterns

- Signal → execution conversion rate (what % of signals do users act on)
- Autonomy level distribution (Guard / Rule / Algo)
- Behavioral alert effectiveness (did cooling-off screens reduce panic sells?)
- Education engagement (which inline educations are dismissed vs read)
- Community basket adoption and follow-through rates
- Top causes of kill switch activation

### Continuous Improvement Loop

Monthly review meeting inputs:
1. Signal accuracy report
2. User portfolio growth cohort analysis
3. Behavioral alert effectiveness metrics
4. User feedback and SEBI grievance patterns
5. Strategy decay status

Outputs:
- Signal engine retraining if needed
- Behavioral threshold adjustments
- UI/UX changes based on education engagement
- New signal types based on user requests

---

## 12. Phased Rollout Plan

### Phase 1 — Foundation (Weeks 1–6)

**Goal:** Core signal engine + recommendation feed live. Manual execution only (no autonomy).

- Onboarding & risk profiling (all 5 steps)
- Three-tier portfolio setup and dashboard
- Signal engine: stocks (all 3 horizons) + mutual funds
- Recommendation feed (all 3 experience levels)
- One-tap approve execution via existing QuickTradeButton
- Basic portfolio tracking (no external import yet)
- SEBI compliance: white-box strategy documentation prepared

**Deliverable:** Retail Mode visible in Markets navigation, strategy documentation filed with broker.

### Phase 2 — Signal Expansion + Behavioral Layer (Weeks 7–12)

**Goal:** All asset classes live. Behavioral support active.

- Signal engine extended: crypto, F&O, commodities, bonds, forex
- Behavioral support layer: all three alert tiers
- Inline contextual education: 12 trigger moments
- Goal progress anchoring on all portfolio views
- External portfolio import (2–3 major brokers)
- Aggregated portfolio view

**Deliverable:** Full asset class coverage. Behavioral differentiation live.

### Phase 3 — Autonomous Execution (Weeks 13–20)

**Goal:** Intelligent autonomous execution live for Rule and Algo mode users.

- Layer 0 data validation pipeline
- LLM multi-agent framework (Bull/Bear/Risk/Trader agents)
- Rule engine: all order types, idempotency, fat-finger detection
- Broker OMS integration with Algo-ID tagging
- Multi-level kill switch (all 4 levels)
- Mandatory paper trading phase enforcement
- Gradual autonomy phases (Paper → Micro → Pilot → Full)
- SEBI audit trail: full 7-year retention logging
- Strategy decay monitoring

**Deliverable:** Autonomous execution live with full SEBI compliance. April 1, 2026 deadline met.

### Phase 4 — Community Layer (Weeks 21–28)

**Goal:** Community features driving retention and engagement.

- Thematic basket creation and discovery
- Copy trading extension with safety limits
- Strategy marketplace with mandatory paper trading
- Creator verification and accountability system
- Multilingual support: Hindi (then Tamil, Bengali)

**Deliverable:** Community layer live. Platform self-sustaining through network effects.

---

## 13. File Structure

### Frontend (`src/features/module-markets/retail/`)

```
retail/
  onboarding/
    OnboardingWizard.tsx          # 5-step onboarding
    GoalSelector.tsx
    RiskQuiz.tsx
    TierSetup.tsx
    RiskProfile.ts                # Profile types and calculations

  dashboard/
    RetailDashboard.tsx           # Three-tier overview
    PortfolioTierView.tsx         # Per-tier P&L and allocation
    GoalProgressAnchor.tsx        # Goal progress alongside P&L
    ExternalPortfolioImport.tsx   # External demat import

  feed/
    RetailSignalFeed.tsx          # Main recommendation list
    SignalCard.tsx                # Adaptive card (3 experience levels)
    SignalFilter.tsx              # Asset class, horizon, confidence filters
    ExecutionBottomSheet.tsx      # One-tap approve flow

  autonomous/
    AutoExecutionSetup.tsx        # Rule builder (plain English)
    RuleBuilder.tsx               # Visual rule creation
    GradualAutonomyWizard.tsx     # Paper → Micro → Pilot → Full phases
    PaperTradingPhase.tsx         # Paper trading dashboard
    KillSwitchPanel.tsx           # All 4 kill switch levels
    ExecutionSummaryCard.tsx      # "What happened while away"
    ExecutionAuditLog.tsx         # Full audit trail viewer
    TaxWarningBanner.tsx          # Monthly trade count + tax alert
    DecayStatusCard.tsx           # Strategy decay monitoring

  behavioral/
    LossAversionAlert.tsx         # Yellow/Orange/Red alert tiers
    MarketStressBanner.tsx        # Portfolio + market stress header
    CoolingOffScreen.tsx          # Mandatory cooling-off before panic sell
    InlineEducation.tsx           # Contextual education component
    BehavioralProfileView.tsx     # User's behavioral flags (transparent)

  community/
    BasketDiscovery.tsx           # Browse thematic baskets
    BasketDetail.tsx              # Basket performance + invest
    BasketCreator.tsx             # Create/manage baskets (verified creators)
    CopyTradingExtended.tsx       # Extended copy trading UI
    StrategyMarketplace.tsx       # Community strategies browse + deploy
```

### Backend (`services/markets-worker/`)

```
src/markets_worker/
  signal_engine/
    ingestor.py                   # Kafka + batch data ingestion
    features.py                   # Feature engineering (all asset classes)
    rules/
      stocks.py                   # Stock signal rules
      mutual_funds.py
      crypto.py
      futures_options.py
      commodities.py
      bonds.py
      forex.py
    ml/
      ensemble.py                 # LSTM + XGBoost hybrid
      walk_forward.py             # Walk-forward validation
      decay_monitor.py            # Strategy decay detection
    scorer.py                     # Confidence scoring + decay
    explainer.py                  # LLM explanation generation

  autonomous/
    validation/
      data_validator.py           # Layer 0: price staleness, cross-source
      corporate_actions.py        # Corporate action detection
      fat_finger.py               # Fat-finger order detection
      idempotency.py              # Redis-based duplicate prevention
      clock_sync.py               # NTP synchronization guard
    agents/
      bull_agent.py               # Bull case LLM agent
      bear_agent.py               # Bear case LLM agent
      risk_agent.py               # Risk assessment agent
      trader_agent.py             # Rule change synthesis agent
      prompt_sanitizer.py         # Prompt injection defense
      context_guard.py            # Context window overflow protection
    rule_engine.py                # Pre-authorized conditional order execution
    oms.py                        # Order management, Algo-ID, audit logging
    kill_switch.py                # Multi-level kill switch (all 4 levels)
    tax_classifier.py             # Monthly trade count + tax risk alert

  behavioral/
    stress_detector.py            # Portfolio + market stress monitoring
    nudge_engine.py               # Alert tier determination + delivery
    education_trigger.py          # Inline education condition evaluation

  routers/
    signals.py                    # Signal feed API
    risk_profile.py               # Risk profile CRUD
    execution_rules.py            # Autonomous rule management
    kill_switch.py                # Kill switch endpoints
    behavioral.py                 # Behavioral alerts + education
    community.py                  # Baskets, copy trading, strategy market
    portfolio_tiers.py            # Three-tier portfolio data
    audit.py                      # Audit trail retrieval
```

### Database (Supabase — new tables)

```sql
signals                    -- scored signals with reasoning JSON
risk_profiles              -- user risk profile + behavioral flags
portfolio_tiers            -- three-tier allocation per user
execution_rules            -- autonomous rule definitions
execution_audit_log        -- 7-year retention audit trail (Algo-ID tagged)
paper_trading_results      -- paper trading phase outcomes
behavioral_events          -- stress alerts, education triggers, cooling-off actions
community_baskets          -- thematic basket definitions
basket_holdings            -- basket instrument weights
strategy_marketplace       -- community strategies
copy_trading_extended      -- extended copy trading with safety limits
```

---

*Design validated through competitive analysis of 20+ global and Indian platforms, deep technical research on signal engine architecture, autonomous execution failure modes, and SEBI regulatory framework (2025–2026). Ready for implementation planning.*
