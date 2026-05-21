# Status banner runbook

Push or revoke an app-wide notice on Sthira's retail surface without a
rebuild. Audience: solo operator. Companion to closed-beta task #27.

## Visual

The banner appears at the very top of every retail tab (above offline
banner, above page content). Three severities map to colour:

- `info` — sky/blue, neutral notices ("New feature available — pull to refresh")
- `warning` — amber, attention required ("Worker maintenance 8–10 PM IST")
- `error` — red, immediate impact ("Zerodha login refresh required for trades")

## Push a notice

Open Supabase Studio → SQL editor on project `gzhxgoigflftharcmdqj`, paste:

```sql
INSERT INTO markets.app_status_banners (message, severity, ends_at)
VALUES (
  'Worker maintenance 8–10 PM IST — trades and signals paused.',
  'warning',
  now() + interval '3 hours'
);
```

Adjust message, severity, and `ends_at` to taste. `ends_at` NULL keeps
the banner up until you manually deactivate it.

Banner appears for users within ~5 minutes (the hook's staleTime). On
the next refetch the change shows up; no rebuild, no APK push, no
restart.

## Take a notice down

Either let `ends_at` expire, or:

```sql
UPDATE markets.app_status_banners SET is_active = false WHERE is_active = true;
```

(Take the most-recently-active down only when you're sure no other banner
should still be live.)

## See what's currently active

```sql
SELECT id, message, severity, starts_at, ends_at, is_active
FROM markets.app_status_banners
WHERE is_active = true
  AND starts_at <= now()
  AND (ends_at IS NULL OR ends_at > now())
ORDER BY starts_at DESC;
```

## Severity quick guide

| Use | Severity |
|---|---|
| "We just added X" / "FYI Y is rolling out" | `info` |
| "Worker is down for maintenance" / "Brokers behaving oddly" | `warning` |
| "Stop trading now" / "Auth is broken, log in again" | `error` |

## What the banner is NOT for

- Per-user notices. Use push notifications instead.
- Trading recommendations. Compliance gate.
- Marketing. Keep it operational.

## Cap on length

The component wraps with `line-clamp-2`, so anything over ~140 chars
gets visually truncated. Keep messages tight or split into two banners
firing in sequence.
