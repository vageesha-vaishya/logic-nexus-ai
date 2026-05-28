# Parked migrations

Migrations placed in this directory are **not** applied by `npx supabase migration up`. The supabase CLI only walks files directly under `supabase/migrations/`.

Use this folder for migrations that are written and reviewed today but should only run after some external condition has been met — typically a no-direct-read window for column / table drops per the master design doc §7.2 rule #1.

## Lifecycle

1. Write the migration here with a filename that includes the **earliest-apply date** in its prefix: `YYYYMMDDHHMMSS_<name>.sql`. The timestamp is the date the apply window opens.
2. PR review treats it like any other migration.
3. When the gate condition is met, `git mv` the file into `supabase/migrations/`, bumping the timestamp prefix only if needed to maintain ordering relative to migrations that have landed since.
4. Apply normally on local (`npx supabase migration up`) and on prod (`mcp__claude_ai_Supabase__apply_migration`).

## Current parked items

- `20260628000000_drop_email_accounts_plaintext_credentials.sql` — drops the four (now-NULL) plaintext credential columns on `public.email_accounts`. Gated on a 30-day no-direct-read window after the NULL-out migration `20260528260000` is applied to prod. Earliest apply date: 30 days after that prod apply.
