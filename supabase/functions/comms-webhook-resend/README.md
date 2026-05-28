# `comms-webhook-resend`

Receives webhook events from Resend (the platform's primary outbound-email provider) and writes them to `comms.deliveries` + `comms.delivery_events`. Auto-adds to `comms.suppressions` on hard bounces and complaints.

Per [`docs/plans/2026-05-28-modules/comms-infrastructure.md §4.3`](../../../docs/plans/2026-05-28-modules/comms-infrastructure.md). Closes **G-CR-2** (no bounce / complaint ingestion → silent sender-reputation collapse).

## Configuration

Set in the Supabase project's edge-function secrets:

| Variable | Source |
|---|---|
| `RESEND_WEBHOOK_SECRET` | Resend dashboard → Webhooks → Signing Secret (starts with `whsec_`) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected by Supabase edge runtime |

## Webhook URL to register in Resend dashboard

```
https://<project-ref>.supabase.co/functions/v1/comms-webhook-resend
```

Optional **custom header** (Resend supports custom headers per webhook since 2024-06):

```
x-platform-tenant-id: <fallback-tenant-uuid>
```

This is used **only as a fallback** when a webhook event arrives for an `email_id` we don't have a `comms.deliveries` row for (which shouldn't happen once the send-gateway in Phase 6 is wired). Set it to a sentinel tenant for the platform itself.

## Event handling

| Resend event | Effect on `comms.deliveries` | Side-effect |
|---|---|---|
| `email.sent` | `status='sent'`, `sent_at=t` | — |
| `email.delivered` | `status='delivered'`, `delivered_at=t` | — |
| `email.delivery_delayed` | status unchanged | — |
| `email.opened` | `opened_at=t` (if NULL); status `'opened'` if not terminal | — |
| `email.clicked` | `clicked_at=t` (if NULL); status `'clicked'` if not terminal | — |
| `email.bounced` (hard) | `status='bounced'`, `bounce_kind='hard'`, `bounced_at=t` | **Inserts `comms.suppressions` row** (reason='bounce_hard') |
| `email.bounced` (soft) | `status='bounced'`, `bounce_kind='soft'`, `bounced_at=t` | No suppression (soft retries are recoverable) |
| `email.complained` | `status='complained'`, `complained_at=t` | **Inserts `comms.suppressions` row** (reason='complaint') |
| `email.failed` | `status='failed'`, `failed_at=t` | — |

Terminal statuses (`bounced`, `complained`, `failed`, `suppressed`) are **sticky** — once set, later events update timestamps but do not regress status.

## Security

- **Svix signature verification** on every request. The function rejects with HTTP 401 if `svix-id`, `svix-timestamp`, `svix-signature` headers are missing or the signature doesn't match.
- **Replay protection**: rejects requests where `svix-timestamp` is more than 5 minutes off the server clock.
- **Idempotency**: inserts `core.idempotency_keys` keyed by `comms-webhook-resend:<svix-id>` before processing. Duplicate deliveries (Svix retries on 5xx) are ack'd with `200 OK` + `{deduped: true}`.
- **`comms.delivery_events.provider_event_id`** is `UNIQUE` — second layer of dedup if the idempotency table is bypassed somehow.

## Testing

Send a test event from the Resend dashboard. Confirm:

1. `comms.delivery_events` has the new row
2. `comms.deliveries.status` updates correctly
3. Hard bounces / complaints add to `comms.suppressions`
4. Replay of the same event returns `200 OK` without duplicate rows

## Phase 1 Slice C scope

This function is the **MVP webhook receiver**. The full `services/comms-api/` build in Phase 6 will extend with:

- Multi-provider abstraction (SendGrid, Postmark, AWS SES) via adapter pattern
- Outcome propagation to `core.notifications` (mark notification as `delivered`)
- Email-event emission to Kafka (`comms.email.bounced` etc. per master §5.1)
- Per-tenant delivery dashboards
- Bounce-rate / complaint-rate SLO monitoring

For now: bounces are ingested, suppression list grows, sender reputation is preserved.
