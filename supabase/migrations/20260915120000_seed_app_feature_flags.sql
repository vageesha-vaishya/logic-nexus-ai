-- supabase/migrations/20260915120000_seed_app_feature_flags.sql
--
-- Fixes the feature-flags read path (docs/investigation/
-- FEATURE_FLAGS_READ_PATH_BROKEN.md, docs/superpowers/specs/
-- 2026-09-15-feature-flags-read-path-fix-design.md). Three things:
--
-- 1. platform.feature_flags / platform.feature_flag_overrides have RLS
--    policies but NO table-level GRANTs anywhere in their migration
--    history -- table privileges are checked before RLS, so the existing
--    "anyone_read_flags USING (true)" policy is currently decorative for
--    direct table access, and the admin list/upsert path (which reads/
--    writes the table directly via a service-role client, not through
--    resolve_flags) would hit "permission denied for table feature_flags"
--    without this.
-- 2. platform.resolve_flags is SECURITY DEFINER with a mutable search_path
--    (Supabase's own advisor flags this). It's being promoted to back a
--    public, unauthenticated endpoint by this fix, which is the point at
--    which that gets hardened.
-- 3. None of the app's FEATURE_FLAGS.* keys (src/lib/feature-flags.ts)
--    have rows in platform.feature_flags except ux_feedback_widget
--    (seeded by 20260915000000_create_ux_feedback.sql). Every resolved
--    value below is chosen to exactly match that key's CURRENT real
--    production behavior -- see the design spec's "Two independently-
--    discovered bugs" section for why lead_three_section_layout is `true`
--    and not its nominal `false` default.
--
-- Do not apply this to any database (local or self-hosted) without first
-- running the read-only inventory check in the design spec's "Pre-Deploy
-- Step" section -- if any of these keys already has a row, this
-- migration's ON CONFLICT DO NOTHING is a silent no-op and the existing
-- row wins.

-- DEPLOY ORDER (load-bearing -- two of the three possible orderings cause
-- real production regressions):
--   1. Apply this migration first.
--   2. Deploy the feature-flags edge function second.
--   3. Ship the frontend fix (src/lib/feature-flags.ts, src/hooks/
--      useFeatureFlags.ts, LeadDetail.tsx, LeadNew.tsx) last.
-- Frontend-alone (steps 2-3 skipped): lead_three_section_layout flips OFF
-- (its call-site default is false; only the bug being fixed currently
-- makes it effectively true).
-- Function-before-migration (step 1 skipped): every one of the 10 seeded
-- keys resolves to false via resolve_flags' "not found" fallback, so all
-- four true-behavior flags (amro_rbac_fix_enabled,
-- hybrid_route_configuration_v1, quotation_import_export_v2,
-- lead_three_section_layout) flip OFF simultaneously.

-- ── 1. Grants ─────────────────────────────────────────────────────────────
-- The GET (public resolve) path goes through resolve_flags, which is
-- SECURITY DEFINER and runs as its owner -- it does not need these grants
-- to function. The POST (admin list/upsert) path reads/writes the table
-- directly via a service-role client and does need them. Granted to
-- anon/authenticated too so the RLS policies' stated intent ("anyone can
-- read") is actually true, matching how platform.llm_provider_configs was
-- granted.
GRANT SELECT ON platform.feature_flags TO anon, authenticated, service_role;
GRANT INSERT, UPDATE ON platform.feature_flags TO service_role;
GRANT SELECT ON platform.feature_flag_overrides TO anon, authenticated, service_role;

-- Defense-in-depth: no earlier migration REVOKEs this (grepped the full
-- migration tree), so PUBLIC almost certainly already has EXECUTE by
-- Postgres's default CREATE FUNCTION behavior -- this just removes any
-- doubt for whoever next reads this function's privileges.
GRANT EXECUTE ON FUNCTION platform.resolve_flags(text[], uuid, uuid, uuid)
  TO anon, authenticated, service_role;

-- ── 2. Harden resolve_flags: pin search_path ─────────────────────────────
-- Identical body to 20260516080945_platform_feature_flags.sql's original
-- definition -- only the SET search_path clause is new.
CREATE OR REPLACE FUNCTION platform.resolve_flags(
  p_keys      text[],
  p_tenant_id uuid DEFAULT NULL,
  p_user_id   uuid DEFAULT NULL,
  p_franchise_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = platform, public
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  rec    record;
  val    boolean;
BEGIN
  FOR rec IN
    SELECT f.key, f.enabled, f.rollout_pct,
           (SELECT o.enabled
            FROM platform.feature_flag_overrides o
            WHERE o.flag_key = f.key
              AND (  (p_user_id      IS NOT NULL AND o.scope_type = 'user'      AND o.scope_id = p_user_id)
                  OR (p_tenant_id    IS NOT NULL AND o.scope_type = 'tenant'    AND o.scope_id = p_tenant_id)
                  OR (p_franchise_id IS NOT NULL AND o.scope_type = 'franchise' AND o.scope_id = p_franchise_id)
                  )
            ORDER BY CASE o.scope_type WHEN 'user' THEN 1 WHEN 'franchise' THEN 2 ELSE 3 END
            LIMIT 1
           ) AS override
    FROM platform.feature_flags f
    WHERE f.key = ANY(p_keys)
  LOOP
    IF rec.override IS NOT NULL THEN
      val := rec.override;
    ELSIF rec.enabled AND rec.rollout_pct < 100 THEN
      val := rec.enabled AND
             (abs(hashtext(rec.key || coalesce(p_tenant_id::text, 'global'))) % 100) < rec.rollout_pct;
    ELSE
      val := rec.enabled;
    END IF;
    result := result || jsonb_build_object(rec.key, val);
  END LOOP;

  DECLARE k text;
  BEGIN
    FOREACH k IN ARRAY p_keys LOOP
      IF NOT (result ? k) THEN
        result := result || jsonb_build_object(k, false);
      END IF;
    END LOOP;
  END;

  RETURN result;
END;
$$;

-- ── 3. Seed rows ──────────────────────────────────────────────────────────
-- enabled matches each key's CURRENT real behavior exactly (see file header
-- for the lead_three_section_layout note). rollout_pct=100 explicit on
-- every row -- at 100 the rollout branch above never evaluates, so this is
-- a hard guarantee, not a probabilistic one.
INSERT INTO platform.feature_flags (key, name, description, enabled, rollout_pct, tags) VALUES

  ('amro_rbac_fix_enabled',
   'AMRO RBAC Fix',
   'AMRO role-based access control fix. Consumed by CommandCenterNav.tsx.',
   true, 100, '{amro}'),

  ('hybrid_route_configuration_v1',
   'Hybrid Route Configuration V1',
   'Hybrid route configuration in rate fetching. Consumed by useRateFetching.ts.',
   true, 100, '{routing}'),

  ('quotation_import_export_v2',
   'Quotation Import/Export V2',
   'Quotation import/export v2 UI. Consumed by QuoteDetail.tsx, Quotes.tsx.',
   true, 100, '{quotation}'),

  ('hybrid_route_metrics_dashboard_v1',
   'Hybrid Route Metrics Dashboard V1',
   'Hybrid route metrics dashboard. Consumed by useRateFetching.ts.',
   false, 100, '{routing}'),

  ('domain_grouped_nav',
   'Domain-Grouped Navigation',
   'MV-3: replace legacy CommandCenterNav with domain-grouped sidebar. Consumed by AppSidebar.tsx.',
   false, 100, '{navigation}'),

  ('user_info_header_module',
   'User Info Header Module',
   'User info header module. Consumed by DashboardLayout.tsx.',
   false, 100, '{layout}'),

  ('user_info_header_dual_mode',
   'User Info Header Dual Mode',
   'User info header dual mode. Consumed by DashboardLayout.tsx.',
   false, 100, '{layout}'),

  ('composer_multi_leg_autofill',
   'Composer Multi-Leg Autofill',
   'Quotation composer multi-leg autofill. Consumed by LegsConfigurationStep.tsx.',
   false, 100, '{quotation}'),

  ('quotation_phase2_guards',
   'Quotation Phase 2 Guards',
   'Quotation phase 2 guards. Consumed by useQuoteRepository.ts.',
   false, 100, '{quotation}'),

  ('lead_three_section_layout',
   'Lead Three-Section Layout',
   'Three-section lead workspace layout. Consumed by LeadDetail.tsx, LeadNew.tsx. Seeded true: this has been rendering unconditionally in production due to a read bug fixed in the same change that makes this flag real (see docs/superpowers/specs/2026-09-15-feature-flags-read-path-fix-design.md, "Bug A") -- true preserves that exact current behavior.',
   true, 100, '{leads}')

ON CONFLICT (key) DO NOTHING;
