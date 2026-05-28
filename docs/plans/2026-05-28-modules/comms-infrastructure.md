# `comms-infrastructure` — Email / Messaging / Notification Delivery Layer

**Date:** 2026-05-28
**Status:** Audit + enhancement requirements
**Companion to:** [`comms.md`](./comms.md) — schema + business events
**Parent doc:** [`../2026-05-28-platform-modules-redesign.md`](../2026-05-28-platform-modules-redesign.md)

---

## 1. Purpose & relationship to `comms.md`

`comms.md` covers **what the platform models** (channels, threads, messages, deliveries, templates as schema entities + events). It does **not** cover **how delivery actually happens** — the providers, queues, OAuth flows, webhook receivers, suppression lists, deliverability concerns, domain reputation, rate limits, retry policies.

This subdoc fills that gap. It is the **delivery infrastructure** layer.

| Layer | Concerns | Owner doc |
|---|---|---|
| Schema / events | tables, RLS, event contracts, ACLs, UI surface | `comms.md` |
| **Delivery infrastructure** | **providers, queues, webhooks, deliverability, domain auth, suppression, rate-limit** | **this doc** |

The `comms` module owns both. Implementation work flows from this doc into Phase 6 of the master rollout.

---

## 2. Current state inventory (evidence-based)

### 2.1 Outbound email — Resend + nodemailer

**Primary provider: Resend** (per memory `project_resend_key_rotation`).

| Path | Notes |
|---|---|
| `supabase/functions/send-email/index.ts` | **1,078 LOC god function**. Direct `fetch` to `https://api.resend.com/emails` (no SDK). Falls back to `nodemailer` SMTP when tenant has `email_accounts.smtp_*` configured. Last-resort fallback to `onboarding@resend.dev` if tenant's domain is unverified. |
| `supabase/functions/marketing-inquiry/index.ts` | Bypasses send-email — direct Resend `fetch`. Sends to `bahuguna.vimal@gmail.com + hello@sosservices.online` from `noreply@sosservices.online`. |
| `supabase/functions/alert-notifier/index.ts` | Bypasses send-email — direct Resend `fetch`. For platform alerts. |
| `supabase/functions/accept-invite/index.ts`, `self-service-onboarding/index.ts` | Likely additional send paths — needs audit. |
| `supabase/functions/process-scheduled-emails/index.ts` | Polls `public.scheduled_emails` for `status='pending' AND scheduled_at <= now()`, batches up to 50. Acts as a poor-man's queue. |

**Verified sender domain:** `sosservices.online` in Resend `ap-south-1` with SPF + DKIM + MX records (per memory `project_resend_key_rotation`, verified 2026-05-24).

**Canonical from-address:** `SOS Services <noreply@sosservices.online>` for platform-originated mail.

### 2.2 Inbound email — Gmail OAuth + IMAP polling

| Path | Notes |
|---|---|
| `supabase/functions/sync-emails-v2/services/gmail.ts` | `GmailService` — OAuth token refresh + label sync (INBOX, SENT). **Polling-based.** No Gmail Watch push subscriptions. |
| `supabase/functions/sync-emails-v2/services/imap.ts` | IMAP polling for generic providers. |
| `supabase/functions/sync-emails-v2/utils/{db,parser}.ts` | `saveEmailToDb`, `parseEmail` — direct DB inserts. |
| `supabase/functions/sync-emails/` | **Legacy v1** still present — parallel path, naming suggests v2 migration in progress. |
| `supabase/functions/sync-all-mailboxes/index.ts` | Bulk orchestrator. |
| `supabase/functions/discover-email-settings/index.ts` | Auto-discover SMTP/IMAP settings from a domain. |
| `supabase/functions/verify-email-credentials/index.ts` | Credential check. |

**Schedule:** unclear — likely cron-triggered, or invoked from the frontend on user action. Worth confirming.

### 2.3 Email accounts schema (today)

`public.email_accounts` (migration `20251001073702_..`) holds:
- Identity: `user_id`, `tenant_id`, `franchise_id`, `email_address`, `display_name`
- Provider enum: `office365 | gmail | smtp_imap | other`
- OAuth tokens: **`access_token TEXT`, `refresh_token TEXT`, `token_expires_at`** ← stored as plain text
- SMTP credentials: **`smtp_host`, `smtp_port`, `smtp_username`, `smtp_password TEXT`, `smtp_use_tls`** ← password as plain text
- IMAP credentials: **`imap_host`, `imap_port`, `imap_username`, `imap_password TEXT`** ← password as plain text

Related: `public.email_account_delegations` for shared inboxes.

### 2.4 Templates

`public.email_templates` (same migration):
- `name`, `description`, `subject`, `body_html`, `body_text`
- `variables JSONB` (array of variable names)
- `category`, `is_shared`, `is_active`

**No template engine in `package.json`.** Variable substitution appears to be inline string replacement. No safe HTML escaping. No conditionals. No partials.

### 2.5 Tracking

`public.email_tracking_events` (migration `20260221000000_email_tracking.sql`):
- `event_type CHECK IN ('open', 'click')` — **opens + clicks only**
- IP, user_agent, GeoIP location
- References `public.emails(id)` (the inbound + outbound message table — separate concept from `email_templates`)

**Not tracked today:** bounces, complaints (spam reports), unsubscribes, delivered confirmations.

### 2.6 Domain authentication

| Path | Notes |
|---|---|
| `src/components/email/DomainHealth.tsx` (353 LOC) + `DomainManagement.tsx` | UI for showing SPF / DKIM / DMARC status |
| `src/services/email/DomainVerificationService.ts` | Frontend service |
| `supabase/functions/domains-register/index.ts`, `domains-verify/index.ts` | Backend endpoints |
| Migrations: `20260219010000_email_infrastructure_phase1.sql`, `20260222180000_domain_health.sql` | Schema + initial logic |

**State:** point-in-time read of DNS records. No periodic re-check job visible. No alerting when DKIM rotates.

### 2.7 SMS / WhatsApp / Push

| Channel | Implementation status |
|---|---|
| **WhatsApp** | `supabase/functions/send-whatsapp/index.ts` — **INSERT into `messages` table only**. No Twilio / Meta WA Business API integration. Function comment says "Queueing outbound WhatsApp message" but nothing dequeues + actually sends. Hollow stub. |
| **SMS** | No SMS-specific function found. Channel exists in schema. Provider not wired. |
| **Push (mobile)** | `services/markets-worker/src/markets_worker/push/fcm.py` — Real FCM integration for Sthira native app. Markets-only today. |
| **Push (web)** | `supabase/functions/send-web/index.ts` exists — needs audit; likely web-push browser API. |
| **In-app** | `public.notifications` table exists; rendering via frontend reads — no realtime subscriptions visible in current code. |

### 2.8 AI-driven email features (already in production)

Counts confirm meaningful AI investment in comms:
- `ai-message-assistant` — message drafting
- `analyze-email-threat` — security analysis
- `autonomous-email` — auto-reply / draft
- `classify-email` — inbound classification
- `route-email` — routing decision
- `escalate-message`, `moderate-message` — workflow
- `ingest-email`, `email-scan`, `search-emails`, `email-stats`, `track-email`

11 comms-AI functions. None route through `@platform/llm-client` yet — Phase 9 migration target.

### 2.9 Webhook receivers (inbound)

| Path | Purpose |
|---|---|
| `supabase/functions/payment-webhook-handler/` | Razorpay (per memory `project_t3_billing`) |
| `supabase/functions/quote-event-webhook/` | Internal — fires on quote events to external systems |
| `supabase/functions/lead-event-webhook/` | Internal — same for leads |
| `supabase/functions/plan-event-webhook/` | Internal — subscription events |
| `supabase/functions/domain-subscription/` | DNS-change subscriptions (?) |

**Not found:** Resend webhook receiver (`/webhook/resend`), bounce / complaint endpoints, Gmail Pub/Sub topic subscription, Microsoft Graph subscription validation.

### 2.10 Edge function count (the meta-finding)

**137 edge functions total**, ~25–30 comms-related. The communications surface is **larger than the application code suggests** — much of the logic lives in Deno edge functions rather than `src/` or `services/`. This is invisible from the application-code-only audit done in §1B of the master design doc.

---

## 3. Gaps (organized by severity)

### 🔴 Critical (security / compliance)

#### G-CR-1 — Secrets stored as plaintext TEXT in `public.email_accounts`

`smtp_password TEXT`, `imap_password TEXT`, `access_token TEXT`, `refresh_token TEXT` are stored as **plain text columns**. Any DB read (RLS-permitted user, leaked backup, intentional admin pull) exposes credentials.

**Industry standard:** OAuth tokens and SMTP credentials in `supabase_vault` or `core.secrets` (Phase 1 design has this — currently unbuilt for `core.secrets`). Existing `platform.llm_provider_configs.vault_secret_name` shows the project already uses the vault pattern for LLM keys — same standard not applied to email auth.

#### G-CR-2 — No Resend webhook receiver = no bounce / complaint ingestion = silent sender-reputation collapse

Resend emits webhooks for `email.bounced`, `email.complained`, `email.delivered`, `email.opened`, `email.clicked`, `email.delivery_delayed`. **None are ingested today.**

Consequences:
- Bouncing addresses keep being sent to → ISPs drop sender reputation → legit emails go to spam
- Complaints (spam reports) are invisible → no auto-suppression → CAN-SPAM exposure
- No "did the email actually arrive" signal beyond what tracking pixels show

`email_tracking_events` only tracks pixel-loaded events ('open') and clicked links ('click') — the events that fire from the *recipient's mailbox*, not the *delivery path*.

#### G-CR-3 — No global suppression list, no unsubscribe enforcement at send time

- No `comms.suppressions` table that the send path consults.
- No `List-Unsubscribe` / `List-Unsubscribe-Post` headers in outbound mail (RFC 8058 — required by Gmail / Yahoo / Apple for bulk senders in 2024+).
- `crm.do_not_contact` (designed in `crm.md §3`) exists in design only; current send path doesn't check it.
- One-click unsubscribe URL infrastructure doesn't exist.

**Compliance exposure:** CAN-SPAM (US), CASL (Canada), GDPR / ePrivacy (EU), DPDP (India). The 2 confirmed design-partner pilots are Indian customers under DPDP. Material legal risk.

### 🟠 High (deliverability / reliability)

#### G-HI-1 — `send-email` is a 1,078-LOC god function

Mixes: Resend API call, nodemailer SMTP fallback, OAuth token refresh for Gmail-send, template variable substitution, attachment encoding, signature handling, recipient validation, fallback-to-onboarding-resend.dev, logging, retry. **No tests visible.**

#### G-HI-2 — No retry / dead-letter for outbound

Inline send → if Resend returns 5xx or rate-limits → caller gets error and the email is dropped (or scheduled-emails table holds it indefinitely). No exponential-backoff retry, no DLQ.

#### G-HI-3 — No per-recipient / per-domain / per-tenant rate limiting

A loop sending 100 emails to the same recipient hits Resend at full speed → recipient inbox provider rate-limits → reputation hit.

#### G-HI-4 — Inbound mail is polling-only

Gmail Watch push (Pub/Sub) and Microsoft Graph subscriptions are the modern paths. Polling wastes API quota and adds 2–15min latency between actual receipt and visibility in the app.

#### G-HI-5 — Domain health is point-in-time, not continuous

`DomainHealth.tsx` shows current state of DNS records when the page loads. No cron job re-checks daily; no alert fires when an admin accidentally removes a DKIM record (silent deliverability collapse).

#### G-HI-6 — Templates have no engine = XSS / injection risk

String-replacement of `{{variable}}` in `body_html` without HTML escaping = stored XSS if variables contain user-controlled content. Customers see corrupted content; worse, malicious HTML lands in inboxes.

#### G-HI-7 — `send-emails` and `sync-emails-v2` co-existing legacy paths

Legacy `sync-emails/` co-exists with `sync-emails-v2/`. Different behavior, divergence over time. Risk: bug fixed in v2 reappears via v1.

### 🟡 Medium (architecture / maintainability)

#### G-MD-1 — No template versioning

Templates can be edited after sends reference them. Sent message says "from template_id X" but template X's current content may differ from what was sent. Audit trail incomplete; A/B test attribution impossible.

#### G-MD-2 — No email-signature management

Per-user signatures, per-tenant defaults, signature variables (`{{user.full_name}}`, `{{user.title}}`) — all undefined. Users hard-code signatures into individual sends today.

#### G-MD-3 — `send-whatsapp` is a hollow stub

Function exists, accepts auth, inserts a `messages` row, returns "queued". Nothing dequeues + sends to actual WhatsApp Business API or Twilio.

#### G-MD-4 — `messages` table schema not visible in audit

Several functions write to `public.messages` but the table doesn't appear in `/tmp/all_tables.txt`. Possible: it does exist but my grep missed it, or the channel_kind schema design lives only inline. Worth confirming during Phase 6.

#### G-MD-5 — Marketing-inquiry hardcodes recipients

`NOTIFY_RECIPIENTS = ["bahuguna.vimal@gmail.com", "hello@sosservices.online"]` in `marketing-inquiry/index.ts`. Direct hardcode; no per-tenant configuration; ships founder's email in source.

#### G-MD-6 — Send paths bypass `send-email`

`marketing-inquiry`, `alert-notifier`, `accept-invite` all call Resend directly rather than through `send-email`. Multiple call-sites = multiple places that need updating when send semantics change (retry, suppression, tracking).

### 🟢 Low (nice-to-have)

#### G-LO-1 — No send-time optimization

Best-time-to-send per recipient based on past open behavior (`comms.md §7 LLM #5`) is a designed but unbuilt feature.

#### G-LO-2 — No A/B subject-line testing

Designed (`comms.md §7 LLM #6`); no infrastructure.

#### G-LO-3 — No notification batching/digest

Designed (`comms.md §7 LLM #9`); related to G-MD-1.

#### G-LO-4 — In-app realtime delivery

Notifications panel likely refreshes on render rather than subscribing to Supabase Realtime → users miss new notifications until manual refresh.

---

## 4. Target architecture (delivery infrastructure)

### 4.1 Single send gateway (`services/comms-api/`)

All outbound mail flows through **one entry point**. Today there are 4+ direct-to-Resend call sites; target is one.

```
caller (any module)
   │
   │  emit core.notifications row (intent) ── OR ──  direct comms.sendEmail() call
   ↓
services/comms-api/send-gateway
   │
   │  1. Check suppression list (comms.suppressions)
   │  2. Check rate limit (per recipient + per tenant)
   │  3. Apply List-Unsubscribe header
   │  4. Render template with safe escaping (handlebars + auto-escape)
   │  5. Insert into comms.outbound_queue (status='queued')
   │
   ↓
Worker (BullMQ on Redis OR poller on outbound_queue)
   │
   │  6. Pick up queued rows
   │  7. Dispatch to provider adapter (Resend default; SMTP for tenant accounts)
   │  8. Update row to 'sent' / 'failed' / 'rate_limit_pending' (with retry-after)
   │  9. Exponential backoff on transient failures; DLQ on permanent
   │
   ↓
Resend / SMTP / etc.
   │
   ↓ (webhook back)
   │
services/comms-api/webhook-receivers/resend
   │
   │  10. Validate signature (Svix)
   │  11. Update comms.deliveries with bounce / complaint / delivered
   │  12. Auto-add to comms.suppressions on hard bounce or complaint
   │  13. Emit comms.email.{bounced|complained|delivered} event
```

### 4.2 Secrets in `core.secrets`

Phase 1 designs `core.secrets`. **OAuth tokens, SMTP/IMAP passwords, provider API keys all live here, never in business tables.** `email_accounts.access_token`, `email_accounts.smtp_password` columns become `email_accounts.access_token_secret_id REFERENCES core.secrets`. Migration script:
- Copy each existing token/password into `core.secrets` (vault-encrypted)
- Replace column with secret_id reference
- Drop the plaintext column once consumers cut over

### 4.3 Webhook intake (`/comms/webhooks/resend`)

Dedicated endpoint with:
- Svix signature verification (Resend uses Svix)
- IP allow-list (Resend egress IPs)
- Idempotency via `core.idempotency_keys` keyed by `resend_webhook_event_id`
- Writes to `comms.deliveries` + emits the right `comms.email.*` event

Equivalent endpoints land for any future provider (SendGrid, Postmark) by the same pattern.

### 4.4 Provider adapters (parallels `@platform/llm-client` pattern)

```
comms.send.fromIntent(notification) ──→ ProviderRouter ──→ ProviderAdapter
                                              │
                                              ├── ResendAdapter
                                              ├── SmtpAdapter (nodemailer)
                                              ├── SesAdapter (future)
                                              ├── TwilioSmsAdapter (future)
                                              ├── MetaWhatsAppAdapter (future)
                                              ├── FcmPushAdapter (lift markets-worker)
                                              └── WebPushAdapter
```

Each adapter implements: `send(message) → DeliveryResult`. Router decides:
- Channel → adapter family (email / sms / whatsapp / push)
- Tenant config → which adapter within family (tenant-owned SMTP vs default Resend)
- Recipient preferences → channel choice if intent is multi-channel
- Provider health → failover (if Resend is degraded, attempt SMTP backup)

CI lint should enforce: no module outside `services/comms-api/src/providers/` imports `resend` / `nodemailer` / `@twilio/conversations` / `firebase-admin` (mirrors the LLM-SDK lint).

### 4.5 Template engine + versioning

**Recommend Handlebars** (smallest, well-known, auto-escapes HTML by default). Alternative: **React-Email** for designer-friendly JSX templates compiled at deploy time.

Schema:

```sql
comms.templates_v2 (
  id uuid PK,
  tenant_id uuid,
  name text,
  channel_kind text,
  body_template text,           -- handlebars source
  subject_template text,
  variables_schema jsonb,        -- declares required variables
  current_version_id uuid
)
comms.template_versions (
  id, template_id, version_number,
  body_template, subject_template,
  variables_schema,
  created_at, created_by,
  active_at, deprecated_at
)
```

A sent message stores `template_version_id` (immutable) — not `template_id` (mutable). Audit trail is complete; A/B attribution is possible.

### 4.6 Suppression list

```sql
comms.suppressions (
  id uuid PK,
  tenant_id uuid,
  address text,             -- email | phone | push token
  channel_kind text,        -- 'email' | 'sms' | 'whatsapp' | 'push'
  reason text,              -- 'bounce_hard' | 'complaint' | 'unsubscribe' | 'manual' | 'invalid_format'
  source_event_id uuid,     -- the bounce/complaint event that caused this
  added_at timestamptz,
  expires_at timestamptz    -- some suppressions are temporary (soft bounce → retry after 7d)
)
```

Send gateway queries this **before every outbound**. Unsubscribe link target is `comms.unsubscribe(token)` which:
- Validates token (HMAC of `{tenant_id, address, channel_kind, expires_at}`)
- Inserts suppression row
- Emits `comms.do_not_contact.added` event

### 4.7 Rate limiting

Three tiers, enforced in send-gateway before queue insert:
- **Per-recipient**: max N emails/hour to the same address (default 5; configurable per template's `urgency` class)
- **Per-domain**: max N/min to the same recipient domain (avoids Gmail rate-limit penalties)
- **Per-tenant**: configurable cap per minute; defaults from plan tier

Backed by Redis token-bucket counters. Exceeded → row stays in `outbound_queue` with `status='rate_limit_pending'` and `next_attempt_at` set.

### 4.8 Domain health monitoring

Replaces today's point-in-time check:

- Cron: re-verify SPF / DKIM / DMARC daily for every active tenant domain
- Result rows: `comms.domain_health_checks (domain, spf_status, dkim_status, dmarc_status, mx_status, checked_at, errors)`
- Degradation event: `comms.domain.health_degraded` fires if any value worsens vs prior check
- Tenant admin gets a notification + dashboard alert
- Sender reputation tied to domain health — block sends from broken domains (gate)

### 4.9 Inbound mail upgrade

- Gmail: add **Gmail Pub/Sub Watch** push subscription per linked Gmail account; receive webhook → fetch only the changed messages (saves API quota, near-real-time)
- Microsoft 365: add **Graph subscriptions** with renewal cron
- IMAP: keep polling for generic providers; consider IDLE for long-lived connections (later phase)
- Kill `sync-emails` v1 directory once v2 is verified — eliminates the dual-path divergence

### 4.10 SMS + WhatsApp + Push fan-out

When `core.notifications` row's recipient has multi-channel preferences:
- Email → ResendAdapter (or tenant SMTP)
- SMS → TwilioSmsAdapter (new provider integration; not built today)
- WhatsApp → MetaWaBusinessApiAdapter (replace today's stub)
- Push (mobile) → FcmPushAdapter (lift from markets-worker into comms-api)
- Push (web) → WebPushAdapter (audit existing `send-web` function)
- In-app → write `comms.in_app_notifications` row; user's Supabase Realtime subscription delivers

---

## 5. Enhancement requirements (ranked)

| Rank | Requirement | Severity addressed | Effort | Phase |
|---|---|---|---|---|
| 1 | **Migrate plaintext secrets to `core.secrets`** (OAuth tokens, SMTP/IMAP passwords) | G-CR-1 | 1 week | P1 Slice C+ |
| 2 | **Build Resend webhook receiver** + write to `comms.deliveries` | G-CR-2 | 3 days | P6 |
| 3 | **Suppression list + unsubscribe flow** with `List-Unsubscribe` header | G-CR-3 | 1 week | P6 |
| 4 | **Single send-gateway** with rate limit + retry + DLQ | G-HI-1, G-HI-2, G-HI-3, G-MD-6 | 2 weeks | P6 |
| 5 | **Decompose `send-email` (1,078 LOC)** into provider adapters + composer | G-HI-1 | 1 week | P6 |
| 6 | **Template engine (Handlebars or React-Email)** + versioning | G-HI-6, G-MD-1 | 1 week | P6 |
| 7 | **Domain health continuous monitoring** + alerting | G-HI-5 | 3 days | P6 |
| 8 | **Inbound push subscriptions** (Gmail Watch, Graph subs) | G-HI-4 | 1 week per provider | P6 (optional defer) |
| 9 | **Kill sync-emails v1** after parity tests | G-HI-7 | 2 days | P6 |
| 10 | **Provider adapter pattern** for SMS / WhatsApp / Push | G-MD-3 | 1 week per provider | P6 |
| 11 | **Email-signature management** schema + UI | G-MD-2 | 4 days | P6 |
| 12 | **Move marketing-inquiry hardcoded recipients to per-tenant config** | G-MD-5 | half-day | P6 |
| 13 | **In-app realtime notifications** via Supabase Realtime | G-LO-4 | 2 days | P6 |
| 14 | **Send-time optimization, A/B subject testing, digest batching** | G-LO-1/2/3 | 1 week each | post-P10 |

**Critical path before any other enhancement work**: items 1–3. These are security/compliance issues that should not wait for the full Phase 6 rollout. Suggest fast-tracking them into Phase 1 Slice C alongside the `core.secrets` build.

---

## 6. Migration plan

| Step | Phase | Notes |
|---|---|---|
| Build `core.secrets` table | P1 Slice C | Vault-backed; per-tenant; per-purpose (oauth, smtp, api_key) |
| Build `comms.suppressions` | P1 Slice C-extension | Doesn't need full comms.* schema yet; can ship early |
| Build Resend webhook receiver | P1 Slice C-extension | Lightweight edge function; writes to a temporary `comms_deliveries_v1` table until full comms.* lands |
| Migrate `email_accounts.{access_token,refresh_token,smtp_password,imap_password}` → `core.secrets` | P1 Slice C+ | Backfill script; then drop plaintext columns |
| Add `List-Unsubscribe` header + unsubscribe-token edge function | P1 Slice C-extension | Independent of full send-gateway |
| Build `services/comms-api/` with full schema | P6 | Per `comms.md §6 services and the rollout plan from §7.4` |
| Migrate all direct-Resend callers to use comms-api | P6 | One caller per PR; keep direct paths working via wrapper |
| Replace WhatsApp stub with real provider | P6 | After provider decision (§7) |
| Decommission `sync-emails` v1 | P6 | After 30-day parity-test window |
| Move FCM logic from markets-worker into comms-api | P6 | Markets keeps consuming; provider is shared |

---

## 7. Open decisions

1. **WhatsApp Business API provider** — Meta direct, Twilio, MessageBird, AiSensy (India)? Twilio is easiest; Meta direct is cheapest at scale; AiSensy is popular for Indian SMBs. **Recommend Twilio** for the design-partner pilot; revisit at 10k WA msg/month.

2. **SMS provider for India** — Twilio (expensive but reliable), MSG91 (cheap, India-focused), Plivo. **Recommend MSG91** for Indian tenants; Twilio for international. Per-tenant provider config.

3. **Template engine** — Handlebars (small, well-known, auto-escapes) vs React-Email (designer-friendly, compiled at deploy). **Recommend Handlebars** for runtime tenant-edited templates; React-Email for platform-fixed transactional templates (welcome, password reset, etc.). Both can coexist.

4. **Queue backend** — BullMQ (Redis-based, mature, has retry / DLQ / scheduling) vs Supabase pg_cron + polled table (no new infra) vs Kafka (already in use for events, but heavy for queue). **Recommend BullMQ + Upstash Redis** — purpose-built for jobs, integrates with the Redis we'll need for caching anyway (master §8.4).

5. **Inbound push subscriptions** — Gmail Pub/Sub Watch is free but adds GCP project complexity. Microsoft Graph subscriptions need cert-renewal cron. **Recommend defer to post-P6** — the polling MVP works for the pilot scale.

6. **Send-from-address strategy** — single tenant from-address (`noreply@<tenant_subdomain>.sosservices.online`), per-user from-address (`firstname.lastname@<tenant>.sosservices.online`), or tenant-owned domain (BYO sender). **Recommend tenant-owned domain support** as table stakes for enterprise; default is platform-managed `<subdomain>.sosservices.online` per tenant.

7. **DKIM key rotation** — Resend handles rotation automatically; tenant-BYO domain needs explicit handling. **Recommend** the daily domain-health check alerts on DKIM degradation; rotation runbook documented but manual.

8. **Compliance retention** — How long do `comms.deliveries` rows live? 13 months for analytics (master §8.1 reference) feels right; per-tenant override possible.

9. **GDPR right-to-erasure for messages** — when a user requests deletion, messages they authored are deleted, but messages received from them stay (different legal basis for retention as a customer record). **Confirm with legal during P6.**

10. **Marketing-inquiry hardcoded recipients** — should this be per-tenant or stay global (founder inbox)? **Recommend per-tenant config table** `comms.marketing_inquiry_routes (tenant_id, recipient_emails[])` so future tenants get their own routing.

---

## 8. Acceptance criteria

Done when:

- [ ] All OAuth tokens + SMTP/IMAP passwords moved out of `public.email_accounts` plaintext columns into `core.secrets`; columns dropped after 30-day no-direct-read window.
- [ ] Resend webhook receiver live at `/comms/webhooks/resend` with Svix signature verification; writes to `comms.deliveries`.
- [ ] `comms.suppressions` table; send-gateway consults it; every outbound email carries `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` per RFC 8058.
- [ ] One-click unsubscribe page works; adds row to `comms.suppressions` within 1 second.
- [ ] Single send-gateway in `services/comms-api/`; `marketing-inquiry`, `alert-notifier`, `accept-invite`, `send-email` legacy paths all route through it.
- [ ] `send-email` decomposed: each provider in its own adapter file ≤ 250 LOC; orchestrator ≤ 200 LOC.
- [ ] Handlebars template engine wired; all templates auto-escape; XSS test fixture passes.
- [ ] `comms.template_versions`; sent messages reference `template_version_id`, not `template_id`.
- [ ] Daily domain-health cron; degradation fires `comms.domain.health_degraded` event; tenant admin sees alert.
- [ ] `sync-emails` v1 directory deleted; v2 is the only inbound path.
- [ ] Real WhatsApp / SMS / Push provider integrations live (one per provider migration).
- [ ] CI lint forbids direct provider SDK imports (`resend`, `nodemailer`, `@twilio/`, `firebase-admin`) outside `services/comms-api/src/providers/`.
- [ ] In-app notifications use Supabase Realtime; no full-page reload required to see new.

---

## 9. What this changes upstream

The `comms.md` subdoc needs three small additions:
1. `comms.suppressions` table in §3 schema list.
2. `comms.template_versions` table in §3 schema list.
3. §10 acceptance criteria add: "CI lint forbids direct provider SDK imports outside `services/comms-api/src/providers/`".

The master `2026-05-28-platform-modules-redesign.md` §7.4 Phase 1 Slice C list should add three items:
- `core.secrets`
- `comms.suppressions`
- Resend webhook receiver

The master `2026-05-28-platform-modules-redesign.md` §8 should mention this doc in the observability section (G-CR-2 covers deliverability metrics that overlap with observability SLOs).

I'll make those cross-doc updates separately if you approve this audit's findings.

---
