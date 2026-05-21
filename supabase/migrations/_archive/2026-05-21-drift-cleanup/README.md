# Archived 2026-05-21 — Supabase migration drift cleanup

These 20 local-only `.sql` files were moved out of `supabase/migrations/` so the
local migrations directory matches the prod migration history on
`gzhxgoigflftharcmdqj`. Memory: `project_supabase_migration_drift.md`.

## What happened

A prior workflow applied migrations to prod directly via the Supabase MCP /
dashboard, then committed local `.sql` files **with mismatched timestamps** to
record the work. The local files were duplicates of remote-applied migrations
under different version numbers. Running `supabase db push` would have tried to
re-apply duplicates (best case: errors; worst case: silent divergence).

Audit (2026-05-21):

| Local file | Prod state |
|---|---|
| `20260514051000_public_user_roles_compat.sql` | `public.user_roles` exists — already applied under a different timestamp |
| `20260515100000_markets_ingest_prices_cron.sql` | matches prod `20260515102954_markets_ingest_prices_cron` |
| `20260515200000_platform_schema_bootstrap.sql` | matches prod `20260515161737_platform_schema_bootstrap` |
| `20260515210000_p0_hierarchy_franchise_id.sql` | matches prod `20260515164404_p0_hierarchy_franchise_id` |
| `20260515220000_markets_t2_schema_enhancements.sql` | matches prod `20260515165150_markets_t2_schema_enhancements` |
| `20260516090000_p0_franchise_id_remaining.sql` | matches prod `20260516143912_p0_franchise_id_remaining` |
| `20260516120000_markets_broker_connectivity.sql` | matches prod `20260516155002_markets_broker_connectivity` |
| `20260517100000_t3_subscriptions_and_consents.sql` | header says "Applied directly via Supabase MCP on 2026-05-17" — already on prod |
| `20260517120000_markets_gtt_orders.sql` | matches prod `20260517051254_markets_gtt_orders` |
| `20260517140000_markets_push_tokens.sql` | matches prod `20260517113345_20260517140000_markets_push_tokens` |
| `20260517160000_markets_ai_briefs.sql` | matches prod `20260517132743_markets_ai_briefs` |
| `20260518100000_markets_notifications.sql` | matches prod `20260518142408_markets_notifications` |
| `20260518120000_markets_retail_profile.sql` | matches prod `20260518143312_markets_retail_profile` |
| `20260518130000_markets_behavioral_events.sql` | matches prod `20260518163219_markets_behavioral_events` |
| `20260519165336_markets_portfolio_templates.sql` | matches prod `20260519112753_markets_portfolio_templates` |
| `20260519170000_markets_portfolio_risk_history.sql` | matches prod `20260519113410_markets_portfolio_risk_history` |
| `20260519180000_markets_rebalance_recommendations.sql` | matches prod `20260519131459_markets_rebalance_recommendations` |
| `20260519190000_markets_push_tokens.sql` | `markets.push_tokens.last_seen_at` exists — covered by prod `20260519142244_markets_push_tokens_last_seen` |
| `20260520150000_seed_markets_domain_and_assignments.sql` | matches prod `20260520130939_assign_markets_domain_to_active_tenants` |

## The one outlier: `20260514050000_platform_enforce_tenant_franchise_hierarchy.sql`

This file is genuinely *not* on prod — `trg_franchises_prevent_last_delete` and
`trg_user_roles_validate_scope` don't exist there. It installs hierarchy
enforcement (every tenant must have ≥1 franchise; `user_roles` scope must
match role type).

It was archived anyway because **installing strict-enforcement triggers needs
a separate, planned migration pass**:

1. Audit existing prod data for violations (tenants without franchises,
   `user_roles` rows with mismatched scope/role).
2. Backfill or delete the offending rows in a separate migration.
3. Then install the triggers.

Doing all of that as part of the drift-cleanup commit conflates two concerns.
When revisited, copy this file out of the archive and apply it as a fresh
migration (with the data-audit migration ahead of it).

## How to bring this back

If a specific archived file turns out to be something prod actually needs,
move it back to `supabase/migrations/` **with a new timestamp matching the
current date** and apply via MCP `apply_migration` after verifying the change
isn't already on prod under a different name.
