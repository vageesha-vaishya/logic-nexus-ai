# `comms` — Communications Module

**Date:** 2026-05-28
**Status:** Draft — under review
**Depends on:** `core` (notifications, files, audit, parties)
**Closely related:** Every other module — Comms is the universal delivery layer
**Parent doc:** [`../2026-05-28-platform-modules-redesign.md`](../2026-05-28-platform-modules-redesign.md)

---

## 1. Purpose

`comms` is the **delivery layer for everything the platform says to humans** — customers, vendors, internal staff. It owns inboxes, threads, messages, email accounts, channel accounts, push tokens, templates, and the *delivery* of `core.notifications`. It is **the only module other modules talk *through***, not *to*.

The split with `core` is precise:
- **`core.notifications` holds the *intent*** ("we want to tell user X about event Y").
- **`comms.*` performs the *delivery*** (which channel, when, retries, opens, tracking).

This separation means a module like Finance doesn't know whether its dunning notice went via email, SMS, or in-app — it just emits the intent. Comms decides delivery based on user preferences, channel availability, and tenant config.

---

## 2. Current state (evidence)

### 2.1 Frontend

`src/components/email/` — **13 components, ~11,329 LOC**. Email is the dominant comms surface today.

| Component | LOC | Notes |
|---|---|---|
| `EmailInbox.tsx` | 1,029 | **God component** — inbox list + thread view + filters + bulk actions |
| `EmailClient.tsx` | 761 | Email client shell |
| `EmailComposeDialog.tsx` | 648 | New message composer |
| `EmailToLeadDialog.tsx` | 591 | **Moves to `sales`** (lead capture from email) |
| `EmailClientSettings.tsx` | 581 | Account/preference settings |
| `QueueRulesManager.tsx` | 526 | Outbound queue/throttling rules |
| `EmailTemplates.tsx` | 446 | Template library |
| `EmailDetailDialog.tsx` | 425 | Single-message modal |
| `EmailAccounts.tsx` | 401 | Account management |
| `EmailList.tsx` | 400 | List view |
| `EmailDetailView.tsx` | 400 | Detail view |
| `OAuthSettings.tsx` | 381 | OAuth provider config |
| `DomainHealth.tsx` | 353 | DKIM/SPF/DMARC status |
| `EmailDelegationDialog.tsx` | 349 | Delegate access |

**`src/features/module-communications/`** — already exists with `CommunicationsHubVerticalPage` (App.tsx:129). Phase 0 wiring further than other modules.

No SMS / WhatsApp / Push UI today — those tables exist (`markets.push_tokens`) but no comms-level surface.

### 2.2 Routes (today)

| Route | Notes |
|---|---|
| `/dashboard/communications-hub` | App.tsx:951 — hub page |
| `/dashboard/settings/channel-integrations` | App.tsx:959 — channel account setup |
| `/oauth/callback` | App.tsx:406 region — OAuth landing for email account linking |

### 2.3 Backend

**No dedicated `services/comms-api/`.** Email-account OAuth flows go through whatever's wired into `src/components/email/OAuthSettings.tsx`. Email sync presumably runs as a Supabase edge function or via `email_sync_logs` worker (worth verifying). Mail send happens client-side or via an unspecified path.

### 2.4 Tables (today, public.*)

| Table | Purpose | Action |
|---|---|---|
| `public.email_accounts` | Linked mailboxes (OAuth) | → `comms.email_accounts` |
| `public.email_account_delegations` | Delegated access | → `comms.email_account_delegations` |
| `public.email_audit_log` | Email-specific audit | **Killed** — `core.audit_log` with subject_type='comms.email' |
| `public.email_filters` | Inbound filtering rules | → `comms.inbound_filters` |
| `public.email_sync_logs` | Sync run logs | → `comms.sync_runs` (extends to all channels) |
| `public.email_templates` | Templates | → `comms.templates` (extends to all channels) |
| `public.email_tracking_events` | Opens, clicks, bounces | → `comms.tracking_events` |
| `public.message_attachments` | Message attachments | **Killed** — `core.files` + `core.file_links` |
| `public.notifications` | In-app notifications | **Killed** — `core.notifications` is intent; comms tracks **deliveries** in `comms.deliveries` |
| `public.vendor_notifications` | Vendor-specific notifications | **Killed** — `core.notifications` with `recipient_party_id` set instead of `recipient_user_id` |
| `markets.notifications` | Markets-specific notifications | **Becomes view** over `core.notifications` filtered by subject_type LIKE 'markets.%' |
| `public.channel_accounts` | Generic channel (Slack, WhatsApp, etc.) — 3 policy migrations | → `comms.channel_accounts` — **resolves the schema churn** noted in §1.4 |
| `public.markets.push_tokens` | Push notification tokens (mobile) | → `comms.push_tokens` |
| `public.quote_email_history` | Sent quote emails | **Killed** — `comms.messages` with subject_type='quotation.quote' (per §1B.5 finding) |

**Result**: ~12 tables in `comms.*` after consolidation, 5 tables killed in favor of `core.*` or `crm.activities`.

---

## 3. Target schema (`comms.*`)

```sql
-- Accounts (the senders/receivers)
comms.email_accounts (
  id                       uuid PK,
  tenant_id                uuid NOT NULL,
  party_id                 uuid REFERENCES core.parties(id) NULL,   -- if the account belongs to a contact/vendor
  user_id                  uuid REFERENCES core.users(id) NULL,     -- if it belongs to a platform user
  email                    text NOT NULL,
  display_name             text,
  provider                 text,                                     -- 'gmail','outlook','imap','smtp_only','workspace'
  oauth_credential_id      uuid REFERENCES core.secrets(id),
  imap_config              jsonb,
  smtp_config              jsonb,
  health_status            text,                                     -- 'healthy','degraded','failing'
  domain_health            jsonb,                                    -- SPF/DKIM/DMARC snapshots
  last_synced_at           timestamptz,
  is_active                boolean DEFAULT true,
  created_at, updated_at
)
comms.email_account_delegations (
  id, tenant_id, account_id, delegated_to_user_id, delegated_by_user_id, permissions text[], granted_at, revoked_at
)

comms.channel_accounts (
  id                       uuid PK,
  tenant_id                uuid NOT NULL,
  kind                     text NOT NULL,                            -- 'slack','whatsapp','telegram','sms','teams','webhook'
  display_name             text,
  config                   jsonb,
  oauth_credential_id      uuid REFERENCES core.secrets(id),
  is_active                boolean DEFAULT true,
  created_at, updated_at
)

comms.push_tokens (
  id                       uuid PK,
  tenant_id                uuid NOT NULL,
  user_id                  uuid REFERENCES core.users(id),
  device_id                text,
  platform                 text,                                     -- 'ios','android','web'
  token                    text NOT NULL,
  last_seen_at             timestamptz,
  is_active                boolean DEFAULT true
)

-- Threads + messages (the conversation graph)
comms.threads (
  id                       uuid PK,
  tenant_id                uuid NOT NULL,
  channel_kind             text NOT NULL,                            -- 'email','sms','whatsapp','slack','in_app'
  external_thread_id       text,                                     -- gmail thread id, etc.
  subject                  text,
  party_id                 uuid REFERENCES core.parties(id),         -- if associated with a party
  subject_type             text,                                     -- 'sales.lead','quotation.quote','logistics.shipment',...
  subject_id               uuid,                                     -- the linked entity
  last_message_at          timestamptz,
  is_archived              boolean DEFAULT false,
  created_at, updated_at
)

comms.messages (
  id                       uuid PK,
  tenant_id                uuid NOT NULL,
  thread_id                uuid REFERENCES comms.threads(id),
  channel_kind             text NOT NULL,
  direction                text NOT NULL,                            -- 'inbound','outbound'
  external_message_id      text,
  from_address             text,
  to_addresses             text[],
  cc_addresses             text[],
  bcc_addresses            text[],
  body_text                text,
  body_html                text,
  in_reply_to_external_id  text,
  occurred_at              timestamptz,
  delivery_status          text,                                     -- 'pending','sent','delivered','opened','clicked','bounced','failed'
  ai_classification        jsonb,                                    -- {intent:'inquiry', urgency:'high', sentiment:'neutral'}
  created_at, updated_at
)
comms.message_attachments_link (
  id, message_id, file_id REFERENCES core.files(id), filename, inline_cid text
)

-- Templates (multi-channel)
comms.templates (
  id, tenant_id, name, channel_kind text,
  subject_template text, body_template text,
  variables jsonb,                                                    -- {required:[party_name,…]}
  language text DEFAULT 'en',
  is_active boolean, created_at, updated_at
)

-- Inbound filters / routing
comms.inbound_filters (
  id, tenant_id, channel_kind, name,
  criteria jsonb,                                                     -- {from_domain, subject_regex, has_attachment}
  actions jsonb,                                                      -- {route_to_user, mark_read, auto_reply_with_template_id, create_lead}
  priority int, is_active boolean
)

-- Outbound queue + rules
comms.outbound_queue (
  id, tenant_id, channel_kind, from_account_id, to_address,
  template_id, rendered_subject, rendered_body, attachments jsonb,
  scheduled_for timestamptz, priority int,
  status text,                                                        -- 'queued','sending','sent','failed','cancelled'
  attempts int DEFAULT 0, last_error text,
  related_notification_id uuid REFERENCES core.notifications(id),
  created_at, updated_at
)
comms.queue_rules (
  id, tenant_id, name,
  match_criteria jsonb,                                               -- {channel_kind, recipient_type}
  rate_limit_per_hour int, max_retries int, retry_backoff jsonb,
  is_active boolean
)

-- Tracking (opens, clicks, bounces)
comms.tracking_events (
  id, tenant_id, message_id, event_kind text /* 'open','click','bounce','complaint','unsubscribe' */,
  occurred_at timestamptz, payload jsonb
)

-- Sync run logs (for inbound mail fetchers)
comms.sync_runs (
  id, tenant_id, account_id, channel_kind,
  started_at, completed_at, status text,
  messages_fetched int, errors_count int, error_summary text
)

-- Deliveries (per-notification per-channel; the link to core.notifications)
comms.deliveries (
  id, tenant_id, notification_id REFERENCES core.notifications(id),
  channel_kind text, recipient_address text,
  status text,                                                        -- 'pending','sent','delivered','failed','suppressed'
  sent_at, delivered_at, failed_at, error_text,
  related_message_id uuid REFERENCES comms.messages(id)
)
```

---

## 4. RLS strategy

- **Email accounts**: visible to the linked user (if user-owned) OR to delegates (via `email_account_delegations`) OR to tenant_admin.
- **Threads/messages**: visible to users with access to the linked subject (e.g., a message linked to a `sales.lead` is visible if the user can see that lead).
- **Tracking events / deliveries**: tenant-admin + the message owner.
- **Templates**: tenant-wide read with role-gated write.
- **Channel accounts**: tenant_admin only — they hold credentials.

```sql
CREATE POLICY view_messages ON comms.messages FOR SELECT USING (
  tenant_id = auth.jwt_tenant_id()
  AND core.has_module_access(tenant_id, 'comms', 'read')
  AND (
    auth.has_role(tenant_id, 'comms_admin')
    OR comms.user_can_see_thread(thread_id, auth.uid())
  )
);
```

`comms.user_can_see_thread()` is a SECURITY DEFINER helper that delegates to the owning module's visibility (`crm.party_visible`, `sales.lead_visible`, `logistics.shipment_visible`, …) based on `subject_type`.

---

## 5. Events

### Published

| Event | When |
|---|---|
| `comms.email.received` | Inbound email synced |
| `comms.email.sent` | Outbound email dispatched |
| `comms.email.delivered` / `.bounced` / `.opened` / `.clicked` / `.complained` | Tracking-event lifecycle |
| `comms.message.received` (kind='sms'/'whatsapp'/'channel') | Inbound on any channel |
| `comms.notification.delivered` | Delivery attempt completed (any channel) |
| `comms.notification.failed` / `.suppressed` | Delivery rejected (bounced address, opt-out, etc.) |
| `comms.thread.created` | New conversation thread |
| `comms.account.health_degraded` | DKIM/SPF/DMARC issues, sync errors |
| `comms.do_not_contact.added` | Opt-out / unsubscribe propagation |

### Subscribed

| Event | Consumer logic |
|---|---|
| **All `core.notifications` inserts** | The primary trigger — poll/listen `core.notifications` and fan out per recipient preferences |
| `sales.lead.created` / `.qualified` | Optional welcome / follow-up template send (rule-driven) |
| `quotation.quote.sent` | Compose + dispatch the actual outbound email; record `quotation.quote.sent` ↔ `comms.messages` link |
| `quotation.quote.viewed` | Fired when portal opens — passes through to `crm.activities` (a Comms→CRM ACL) |
| `finance.invoice.finalized` | Compose + dispatch invoice email |
| `finance.invoice.overdue` | Trigger dunning email per `finance.dunning_policies` step |
| `logistics.shipment.exception` | Notify shipper + ops team |
| `logistics.shipment.milestone_recorded` (selective) | Customer notifications per shipment-tier |
| `core.user.invited` | Welcome email |
| `crm.do_not_contact.set` | Update `comms.deliveries.status='suppressed'` for matching addresses |

ACL location: `services/comms-api/src/acl/{core,crm,sales,quotation,finance,logistics,amro,markets}.ts`. Comms has the most ACL files of any module.

---

## 6. UI surface

Reorganised under `src/features/module-communications/components/`. The 13 `src/components/email/*` files move here.

| Route | Notes |
|---|---|
| `/dashboard/comms` | Communications hub (was `/dashboard/communications-hub`) — unified inbox |
| `/dashboard/comms/inbox` | Email inbox (split from EmailInbox 1029 LOC) |
| `/dashboard/comms/inbox/:thread_id` | Thread view |
| `/dashboard/comms/compose` | New message |
| `/dashboard/comms/templates` | Template library |
| `/dashboard/comms/accounts` | Email + channel accounts management |
| `/dashboard/comms/settings/queue-rules` | Outbound queue rules |
| `/dashboard/comms/settings/inbound-filters` | Inbound filters |
| `/dashboard/comms/settings/channels` | Channel integrations (was `/dashboard/settings/channel-integrations`) |
| `/dashboard/comms/settings/domains` | DKIM/SPF/DMARC health |
| `/dashboard/comms/notifications` | Notification preferences (per-user) |
| `/dashboard/comms/tracking` | Outbound tracking dashboard |

**`EmailInbox.tsx` split plan (1,029 LOC):**

| New component | LOC target | Owns |
|---|---|---|
| `inbox/InboxLayout.tsx` | ≤150 | Page shell, three-pane layout |
| `inbox/InboxSidebar.tsx` | ≤200 | Folder list, accounts, labels |
| `inbox/MessageList.tsx` | ≤300 | Paginated message list, filters |
| `inbox/MessagePreview.tsx` | ≤200 | Right-pane message view |
| `inbox/InboxToolbar.tsx` | ≤150 | Bulk actions, search |
| `inbox/hooks/useInboxQuery.ts` | ≤100 | Data fetching |

Total ~1,100 LOC across 6 files, none over 300.

---

## 7. LLM hooks (specific to Comms)

| Rank | Feature | Mechanism | Cost notes |
|---|---|---|---|
| 1 | **Inbound classification** | Every received email/SMS → `{intent, urgency, sentiment, language, suggested_label, related_entity_guess}`. Drives routing, auto-replies, lead creation. | Per inbound; ~$0.0005 |
| 2 | **Reply drafting** | "Suggest a reply" button. LLM reads thread + context, drafts response in user's voice. | Per draft; ~$0.002 |
| 3 | **Template variable filling** | Given a template + party context, auto-fill variables; flag missing data. | Per send |
| 4 | **Thread summarisation** | Long thread (>10 messages) → 3-line summary. | On-demand |
| 5 | **Send-time prediction** | Best time to send to a recipient based on their open history. | Daily batch per recipient |
| 6 | **Subject-line A/B suggester** | Two-variant suggestions with predicted open rate. | Per campaign send |
| 7 | **Translation** | Inbound non-English → translation + display; outbound English → recipient's language. | Per relevant message |
| 8 | **Spam/phishing pre-filter** | Pre-classify inbound to flag suspicious before showing in inbox. | Per inbound |
| 9 | **Notification batching/digest** | Multiple low-priority intents in `core.notifications` for the same user → single digest email instead of N pings. | Hourly batch per user |

All routed through `packages/llm-client` → `core.llm_usage`.

---

## 8. Migration sequence

| Phase | What | Risk |
|---|---|---|
| 0 | Wait for `core.notifications` + `core.files` + `core.audit_log` + `core.secrets`. | — |
| 1 | Create `comms.*` schema + all tables. RLS + helpers. | Zero — additive. |
| 2 | Build `services/comms-api/` — start with the `core.notifications` → `comms.deliveries` poller (the most-important consumer). | High — net-new service; touches every module's notifications. |
| 3 | Backfill `comms.email_accounts` from `public.email_accounts`. Migrate OAuth credentials to `core.secrets`. | Medium. |
| 4 | Backfill `comms.threads` + `comms.messages` from existing email rows; map filters to `comms.inbound_filters`; templates to `comms.templates`. | Medium. |
| 5 | Migrate `channel_accounts` (consolidate the 3 policy migrations). | Medium. |
| 6 | Build outbound queue + worker. | Medium. |
| 7 | Move `EmailToLeadDialog.tsx` to sales module (already in sales subdoc §2.1). | Low. |
| 8 | Split `EmailInbox.tsx` per §6. | Low — refactor. |
| 9 | Move `src/components/email/*` → `src/features/module-communications/components/`. | Low. |
| 10 | Subscribe to first cross-module event (`quotation.quote.sent` → outbound email). End-to-end test. | Medium — first real event chain. |
| 11 | Subscribe to remaining events per §5 (sales, finance, logistics, amro). | Medium. |
| 12 | Ship LLM features #1, #2, #3. | Low. |
| 13 | Drop `public.email_*`, `public.message_*`, `public.notifications`, `public.vendor_notifications` after 30-day window. | Low. |

---

## 9. Open decisions

1. **Push vs pull for `core.notifications` → comms** — Two models: (a) Comms polls `core.notifications WHERE delivered_at IS NULL` every 5s, (b) `core.notifications` insert fires a Kafka event Comms consumes. **Recommend (b)** — already have outbox infra; consistent with rest of platform.
2. **Inbound mail fetching architecture** — IMAP polling vs OAuth-push (Gmail Watch, Microsoft Graph subscriptions). **Recommend OAuth-push where available**, IMAP fallback for generic providers. Decisions encapsulated in `comms.email_accounts.provider`.
3. **`quote_email_history` migration** — duplicates a row in `comms.messages`. **Recommend migrate as `comms.messages` with `subject_type='quotation.quote'`** and discard the standalone history table.
4. **Notification digest threshold** — when to batch vs send immediately. **Recommend tenant-level config** with sensible defaults (immediate for `exception`/`overdue`; digest for `info`-level).
5. **Anti-spam suppression list** — global per tenant or per channel-account? **Recommend per tenant** (a customer who unsubscribes should be globally suppressed).
6. **WhatsApp Business API** — first-class or via channel_account integration? **Recommend channel_account** — keeps the schema generic; WhatsApp-specific concerns are config.
7. **`EmailToLeadDialog` boundary** — lives where? **Owned by `sales`** (since it produces a lead). Comms provides the event (`comms.email.received`); Sales subscribes via ACL and creates the lead. The dialog UI lives in sales module, consuming `comms.threads` / `comms.messages` as read-models.

---

## 10. Acceptance criteria

Done when:

- [ ] `comms` schema exists with ~12 tables from §3.
- [ ] `services/comms-api/` exists; hosts inbound fetchers, outbound worker, `core.notifications` → `comms.deliveries` dispatcher, OAuth callbacks.
- [ ] `EmailInbox.tsx` split per §6; no file > 300 LOC.
- [ ] All `public.email_*`, `public.notifications`, `public.vendor_notifications` dropped (after 30-day window).
- [ ] `core.notifications` inserts trigger exactly one `comms.deliveries` row per channel-preference per recipient.
- [ ] At least 3 cross-module event chains tested end-to-end: `quotation.quote.sent` → email; `finance.invoice.overdue` → dunning email; `logistics.shipment.exception` → multi-channel notify.
- [ ] At least 3 of §7 LLM features shipped (recommend #1 inbound classification, #2 reply drafting, #4 thread summarisation).
- [ ] DKIM/SPF/DMARC health visible in `/dashboard/comms/settings/domains`.
- [ ] Per-tenant suppression list works; respects `crm.do_not_contact.set` events.

---
