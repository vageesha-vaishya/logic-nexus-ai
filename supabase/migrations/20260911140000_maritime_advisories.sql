-- ====================================================================
-- Maintained geopolitical/regulatory maritime advisories table.
--
-- Replaces the hardcoded MARITIME_REFERENCE snapshot in
-- supabase/functions/ai-advisor/index.ts with an admin-editable,
-- queryable source of truth for the Smart Quote module's maritime
-- chokepoint context (docs/smart-quote-module-design.md §6/§10 item 2).
--
-- One row = one advisory fact (a toll change, a routing disruption, etc),
-- not one row per chokepoint -- buildMaritimeContext() concatenates every
-- currently-active, currently-effective row for a matched chokepoint, so
-- new advisories can be added over time without a code change, and old
-- ones naturally stop being surfaced once effective_to passes without
-- needing to be deleted (kept for audit history).
--
-- Global/platform-wide reference data, not tenant-owned -- Suez/Panama
-- conditions are the same fact for every tenant, unlike llm_provider_configs
-- or rate_provider_configs which are genuinely per-tenant.
-- ====================================================================

CREATE TABLE public.maritime_advisories (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Free text, not a CHECK-constrained enum: buildMaritimeContext()'s route
  -- detection heuristic today only ever looks up 'suez' or 'panama', but a
  -- future chokepoint (e.g. a Malacca Strait or Bab-el-Mandeb-specific
  -- advisory) shouldn't need a migration to add.
  chokepoint           text NOT NULL,
  region               text,                    -- descriptive only, e.g. "Red Sea / Bab-el-Mandeb" -- not used by the lookup query
  headline             text NOT NULL,
  cost_impact_text     text,
  transit_impact_text  text,
  effective_from       date,                    -- null = already in effect / start date not tracked
  effective_to         date,                     -- null = no known end
  source_url           text,
  is_active            boolean NOT NULL DEFAULT true,
  created_by           uuid REFERENCES auth.users(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from)
);

CREATE INDEX maritime_advisories_chokepoint_idx
  ON public.maritime_advisories (chokepoint, is_active);

CREATE OR REPLACE FUNCTION public.maritime_advisories_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_maritime_advisories_touch_updated_at
  BEFORE UPDATE ON public.maritime_advisories
  FOR EACH ROW EXECUTE FUNCTION public.maritime_advisories_touch_updated_at();

ALTER TABLE public.maritime_advisories ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated user. Not sensitive data (public geopolitical/
-- regulatory facts), and this keeps a future admin UI simple -- no special
-- role check needed just to list current advisories. (ai-advisor's own
-- runtime query uses the service-role admin client and bypasses RLS
-- entirely regardless.)
CREATE POLICY maritime_advisories_select ON public.maritime_advisories
  FOR SELECT TO authenticated
  USING (true);

-- Write: platform_admin only -- these are platform-wide facts, not
-- tenant-owned data, so no tenant_admin/franchise_admin write path.
CREATE POLICY maritime_advisories_admin_insert ON public.maritime_advisories
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role = 'platform_admin'
    )
  );

CREATE POLICY maritime_advisories_admin_update ON public.maritime_advisories
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role = 'platform_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role = 'platform_admin'
    )
  );

CREATE POLICY maritime_advisories_admin_delete ON public.maritime_advisories
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role = 'platform_admin'
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.maritime_advisories TO authenticated;
GRANT ALL                            ON public.maritime_advisories TO service_role;

COMMENT ON TABLE public.maritime_advisories IS
  'Admin-maintained maritime chokepoint advisories (toll changes, routing disruptions) injected as read-only, dated context into the Smart Quote LLM prompt. Never model-invented -- see ai-advisor/index.ts buildMaritimeContext(). One row per fact; buildMaritimeContext concatenates all active, currently-effective rows for a matched chokepoint.';

-- ====================================================================
-- Seed data: the exact facts previously hardcoded in MARITIME_REFERENCE
-- (sourced via live web search 2026-09-11, see
-- docs/smart-quote-module-design.md §6), split into one row per distinct
-- fact so future updates can supersede one without touching the others.
-- ====================================================================

INSERT INTO public.maritime_advisories
  (chokepoint, region, headline, cost_impact_text, transit_impact_text, effective_from, effective_to, source_url)
VALUES
  (
    'suez',
    'Suez Canal',
    'Suez Canal Authority toll increases (2026)',
    'Suez Canal Authority raised transit tolls three times in 2026 (Mar 1, May 1, Jul 15); containership tier surcharge is ~12% on top of the base tariff, which has been unchanged since 2024.',
    NULL,
    '2026-03-01',
    NULL,
    'https://www.bloominglobal.com/media/detail/suez-canal-raises-vessel-surcharges-as-shipping-traffic-recovers'
  ),
  (
    'suez',
    'Red Sea / Bab-el-Mandeb',
    'Red Sea/Houthi disruption keeps most Asia-Europe traffic on Cape of Good Hope diversion',
    'Cape diversion adds ~10-14 days transit and a war-risk/diversion surcharge of roughly $200-800 per container; the per-TEU cost differential between a (rare) Suez transit and the Cape diversion routing most carriers actually use is roughly $200-400/TEU.',
    'Despite the toll increases, most carriers are NOT actually transiting Suez right now. Ongoing Houthi attacks in the Red Sea have kept the large majority of Asia-Europe and Asia-US East Coast services on Cape of Good Hope diversion since late 2023 -- Suez traffic in 2026 remains roughly 60% below pre-crisis levels, and the industry expects this to continue through at least 2027.',
    '2023-11-01',
    NULL,
    'https://themiddleeastinsider.com/2026/04/25/red-sea-shipping-disruption-2026/'
  ),
  (
    'panama',
    'Panama Canal',
    'Panama Canal Authority toll structure frozen through September 30, 2026',
    'Panama Canal Authority has frozen its main toll structure through September 30, 2026. Container vessels are charged per laden TEU, roughly $35-45/TEU (so ~$70-90 per 40ft/2-TEU container), plus a fixed per-transit vessel fee that is not directly allocable to an individual shipper''s container.',
    'Panama routing (used for Asia <-> US East/Gulf Coast and Caribbean lanes) has not seen the same disruption as Suez; it remains the standard routing for those lanes in 2026, subject to normal seasonal draft restrictions.',
    NULL,
    '2026-09-30',
    'https://porteconomicsmanagement.org/pemp/contents/part1/interoceanic-passages/panama-canal-toll-structure/'
  );
