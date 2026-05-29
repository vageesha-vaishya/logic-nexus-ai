-- Phase 4 Sales Step 1 — sales.* schema + base tables (leads, opportunities, pipelines, forecasts)
-- Per docs/plans/2026-05-28-platform-modules-redesign.md §7.4 Phase 4
--
-- Splits sales lifecycle data out of public.* into a sales.* schema:
--   - sales.leads          — mirror of public.leads (2,534 rows)
--   - sales.opportunities  — mirror of public.opportunities (3,086 rows)
--   - sales.pipelines      — new: pipeline definitions (lead or opportunity)
--   - sales.pipeline_stages — new: ordered stages per pipeline
--   - sales.forecasts      — new: forecast headers for the AI tier
--   - sales.forecast_lines — new: per-period forecast points
--
-- public.leads / public.opportunities stay authoritative for writes during
-- this phase; dual-write triggers mirror live writes into sales.*. Reads
-- can migrate at consumer pace. Scoring tables get their own slice in
-- Sales Step 5 (sales.scoring_*).
--
-- Mirror tables keep verbatim column shape to make the dual-write a
-- trivial INSERT … VALUES (NEW.*) rather than a complex projection.
-- USER-DEFINED enums (lead_status, lead_source, opportunity_stage) are
-- cast to text in sales.* to keep the namespace clean, same convention
-- as crm.activities.

CREATE SCHEMA IF NOT EXISTS sales;
COMMENT ON SCHEMA sales IS 'Phase 4 sales lifecycle — leads, opportunities, pipelines, forecasts, scoring.';

-- ══════════════════════════════════════════════════════════════════════
-- 1. sales.leads
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE sales.leads (
  id                       uuid PRIMARY KEY,
  tenant_id                uuid NOT NULL,
  franchise_id             uuid NOT NULL,
  first_name               text NOT NULL,
  last_name                text NOT NULL,
  company                  text,
  title                    varchar,
  email                    varchar,
  phone                    varchar,
  status                   text,
  source                   text,
  estimated_value          numeric,
  expected_close_date      date,
  description              text,
  notes                    text,
  owner_id                 uuid,
  converted_account_id     uuid,
  converted_contact_id     uuid,
  converted_at             timestamptz,
  created_by               uuid,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  lead_score               integer,
  qualification_status     text,
  last_activity_date       timestamptz,
  conversion_probability   integer,
  custom_fields            jsonb,
  owner_queue_id           uuid,
  name                     text,
  ai_score                 integer,
  ai_score_factors         jsonb,
  -- public.leads.embedding is pgvector; sales.leads holds the same type
  -- so vector-search consumers can read either source identically.
  embedding                public.vector(1536),
  company_name             varchar NOT NULL,
  website                  varchar,
  contact_name             varchar NOT NULL,
  job_position             varchar,
  mobile                   varchar,
  address_line1            varchar,
  address_line2            varchar,
  city                     varchar,
  state                    varchar,
  postal_code              text,
  country                  varchar,
  salesperson_id           uuid,
  sales_team               varchar,
  priority                 varchar,
  tags                     text[],
  legacy_metadata          jsonb
);

COMMENT ON TABLE sales.leads IS
  'Phase 4 Sales Step 1 — mirror of public.leads. Dual-write from the source keeps it current; new readers should target sales.leads.';

CREATE INDEX sales_leads_tenant_status_idx   ON sales.leads (tenant_id, status, created_at DESC);
CREATE INDEX sales_leads_owner_idx           ON sales.leads (owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX sales_leads_email_idx           ON sales.leads (tenant_id, lower(email)) WHERE email IS NOT NULL;
CREATE INDEX sales_leads_score_idx           ON sales.leads (tenant_id, lead_score DESC NULLS LAST) WHERE status NOT IN ('converted','lost') OR status IS NULL;

ALTER TABLE sales.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_leads_tenant_select ON sales.leads
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE TRIGGER trg_sales_leads_updated_at
  BEFORE UPDATE ON sales.leads
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT ON sales.leads TO authenticated;
GRANT ALL    ON sales.leads TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 2. sales.opportunities
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE sales.opportunities (
  id                          uuid PRIMARY KEY,
  tenant_id                   uuid NOT NULL,
  franchise_id                uuid NOT NULL,
  name                        text NOT NULL,
  description                 text,
  stage                       text NOT NULL,
  amount                      numeric,
  probability                 integer,
  close_date                  date,
  account_id                  uuid,
  contact_id                  uuid,
  lead_id                     uuid,
  owner_id                    uuid,
  lead_source                 text,
  next_step                   text,
  competitors                 text,
  campaign_id                 uuid,
  type                        text,
  forecast_category           text,
  expected_revenue            numeric,
  created_by                  uuid,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  closed_at                   timestamptz,
  salesforce_opportunity_id   text,
  salesforce_sync_status      text,
  salesforce_last_synced      timestamptz,
  salesforce_error            text,
  primary_quote_id            uuid
);

COMMENT ON TABLE sales.opportunities IS
  'Phase 4 Sales Step 1 — mirror of public.opportunities. Dual-write from the source keeps it current.';

CREATE INDEX sales_opps_tenant_stage_idx     ON sales.opportunities (tenant_id, stage, close_date NULLS LAST);
CREATE INDEX sales_opps_owner_idx            ON sales.opportunities (owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX sales_opps_account_idx          ON sales.opportunities (account_id) WHERE account_id IS NOT NULL;
CREATE INDEX sales_opps_open_pipeline_idx    ON sales.opportunities (tenant_id, owner_id, close_date) WHERE closed_at IS NULL;

ALTER TABLE sales.opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_opps_tenant_select ON sales.opportunities
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE TRIGGER trg_sales_opps_updated_at
  BEFORE UPDATE ON sales.opportunities
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT ON sales.opportunities TO authenticated;
GRANT ALL    ON sales.opportunities TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 3. sales.pipelines + sales.pipeline_stages (NEW)
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE sales.pipelines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  -- 'lead' pipelines run pre-conversion; 'opportunity' pipelines run
  -- post-conversion. Same table to share stage primitives + reordering.
  kind            text NOT NULL CHECK (kind IN ('lead','opportunity')),
  name            text NOT NULL,
  description     text,
  is_default      boolean NOT NULL DEFAULT false,
  active          boolean NOT NULL DEFAULT true,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sales_pipelines_tenant_kind_idx ON sales.pipelines (tenant_id, kind) WHERE active;
CREATE UNIQUE INDEX sales_pipelines_tenant_default_unique
  ON sales.pipelines (tenant_id, kind) WHERE is_default;

ALTER TABLE sales.pipelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_pipelines_tenant_select ON sales.pipelines
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE TRIGGER trg_sales_pipelines_updated_at
  BEFORE UPDATE ON sales.pipelines
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT ON sales.pipelines TO authenticated;
GRANT ALL    ON sales.pipelines TO service_role;

CREATE TABLE sales.pipeline_stages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  pipeline_id     uuid NOT NULL REFERENCES sales.pipelines(id) ON DELETE CASCADE,
  name            text NOT NULL,
  position        integer NOT NULL,
  -- closed_state distinguishes terminal stages so dashboards can filter
  -- "open" vs "won" vs "lost" without hard-coding stage names.
  closed_state    text CHECK (closed_state IN ('won','lost')),
  default_probability  integer CHECK (default_probability BETWEEN 0 AND 100),
  color           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pipeline_id, position)
);

CREATE INDEX sales_pipeline_stages_pipeline_idx ON sales.pipeline_stages (pipeline_id, position);

ALTER TABLE sales.pipeline_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_pipeline_stages_tenant_select ON sales.pipeline_stages
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE TRIGGER trg_sales_pipeline_stages_updated_at
  BEFORE UPDATE ON sales.pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT ON sales.pipeline_stages TO authenticated;
GRANT ALL    ON sales.pipeline_stages TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 4. sales.forecasts + sales.forecast_lines (NEW)
-- ══════════════════════════════════════════════════════════════════════
--
-- forecast headers + per-period rollup lines. The AI-tier forecast_*
-- tables in public.* (forecast_decisions, forecast_features,
-- forecast_outputs) belong to the prediction pipeline and stay where
-- they are for now — sales.forecasts is the human-facing forecast
-- (e.g. "Q3 sales forecast: ₹4.2 Cr").

CREATE TABLE sales.forecasts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  name            text NOT NULL,
  description     text,
  period_kind     text NOT NULL CHECK (period_kind IN ('month','quarter','year','custom')),
  starts_on       date NOT NULL,
  ends_on         date NOT NULL,
  owner_id        uuid,
  currency        text DEFAULT 'INR',
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','archived')),
  total_committed numeric(14,2) NOT NULL DEFAULT 0,
  total_best_case numeric(14,2) NOT NULL DEFAULT 0,
  total_pipeline  numeric(14,2) NOT NULL DEFAULT 0,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on)
);

CREATE INDEX sales_forecasts_tenant_period_idx ON sales.forecasts (tenant_id, starts_on DESC);
CREATE INDEX sales_forecasts_owner_idx ON sales.forecasts (owner_id) WHERE owner_id IS NOT NULL;

ALTER TABLE sales.forecasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_forecasts_tenant_select ON sales.forecasts
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE TRIGGER trg_sales_forecasts_updated_at
  BEFORE UPDATE ON sales.forecasts
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT ON sales.forecasts TO authenticated;
GRANT ALL    ON sales.forecasts TO service_role;

CREATE TABLE sales.forecast_lines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_id     uuid NOT NULL REFERENCES sales.forecasts(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL,
  -- Bucket-level fields. opportunity_id or owner_id may be NULL for
  -- aggregate roll-up lines.
  opportunity_id  uuid,
  owner_id        uuid,
  bucket          text NOT NULL CHECK (bucket IN ('committed','best_case','pipeline','omitted')),
  period_start    date NOT NULL,
  period_end      date NOT NULL,
  amount          numeric(14,2) NOT NULL DEFAULT 0,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start)
);

CREATE INDEX sales_forecast_lines_forecast_idx ON sales.forecast_lines (forecast_id, bucket, period_start);

ALTER TABLE sales.forecast_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_forecast_lines_tenant_select ON sales.forecast_lines
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE TRIGGER trg_sales_forecast_lines_updated_at
  BEFORE UPDATE ON sales.forecast_lines
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT ON sales.forecast_lines TO authenticated;
GRANT ALL    ON sales.forecast_lines TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 5. Backfill leads + opportunities
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO sales.leads
SELECT
  id, tenant_id, franchise_id,
  first_name, last_name, company, title, email, phone,
  status::text, source::text,
  estimated_value, expected_close_date, description, notes,
  owner_id, converted_account_id, converted_contact_id, converted_at,
  created_by, COALESCE(created_at, now()), COALESCE(updated_at, now()),
  lead_score, qualification_status, last_activity_date, conversion_probability,
  custom_fields, owner_queue_id, name, ai_score, ai_score_factors, embedding,
  company_name, website, contact_name, job_position, mobile,
  address_line1, address_line2, city, state, postal_code, country,
  salesperson_id, sales_team, priority, tags, legacy_metadata
FROM public.leads
ON CONFLICT (id) DO NOTHING;

INSERT INTO sales.opportunities
SELECT
  id, tenant_id, franchise_id, name, description,
  stage::text, amount, probability, close_date,
  account_id, contact_id, lead_id, owner_id,
  lead_source::text, next_step, competitors, campaign_id, type,
  forecast_category, expected_revenue, created_by,
  COALESCE(created_at, now()), COALESCE(updated_at, now()), closed_at,
  salesforce_opportunity_id, salesforce_sync_status, salesforce_last_synced,
  salesforce_error, primary_quote_id
FROM public.opportunities
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════
-- 6. Dual-write triggers — public.leads → sales.leads
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION sales.dual_write_from_leads()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = sales, pg_catalog AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO sales.leads VALUES (
      NEW.id, NEW.tenant_id, NEW.franchise_id,
      NEW.first_name, NEW.last_name, NEW.company, NEW.title, NEW.email, NEW.phone,
      NEW.status::text, NEW.source::text,
      NEW.estimated_value, NEW.expected_close_date, NEW.description, NEW.notes,
      NEW.owner_id, NEW.converted_account_id, NEW.converted_contact_id, NEW.converted_at,
      NEW.created_by, COALESCE(NEW.created_at, now()), COALESCE(NEW.updated_at, now()),
      NEW.lead_score, NEW.qualification_status, NEW.last_activity_date, NEW.conversion_probability,
      NEW.custom_fields, NEW.owner_queue_id, NEW.name, NEW.ai_score, NEW.ai_score_factors, NEW.embedding,
      NEW.company_name, NEW.website, NEW.contact_name, NEW.job_position, NEW.mobile,
      NEW.address_line1, NEW.address_line2, NEW.city, NEW.state, NEW.postal_code, NEW.country,
      NEW.salesperson_id, NEW.sales_team, NEW.priority, NEW.tags, NEW.legacy_metadata
    ) ON CONFLICT (id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE sales.leads SET
      tenant_id = NEW.tenant_id, franchise_id = NEW.franchise_id,
      first_name = NEW.first_name, last_name = NEW.last_name,
      company = NEW.company, title = NEW.title, email = NEW.email, phone = NEW.phone,
      status = NEW.status::text, source = NEW.source::text,
      estimated_value = NEW.estimated_value, expected_close_date = NEW.expected_close_date,
      description = NEW.description, notes = NEW.notes,
      owner_id = NEW.owner_id, converted_account_id = NEW.converted_account_id,
      converted_contact_id = NEW.converted_contact_id, converted_at = NEW.converted_at,
      created_by = NEW.created_by, updated_at = COALESCE(NEW.updated_at, now()),
      lead_score = NEW.lead_score, qualification_status = NEW.qualification_status,
      last_activity_date = NEW.last_activity_date, conversion_probability = NEW.conversion_probability,
      custom_fields = NEW.custom_fields, owner_queue_id = NEW.owner_queue_id, name = NEW.name,
      ai_score = NEW.ai_score, ai_score_factors = NEW.ai_score_factors, embedding = NEW.embedding,
      company_name = NEW.company_name, website = NEW.website, contact_name = NEW.contact_name,
      job_position = NEW.job_position, mobile = NEW.mobile,
      address_line1 = NEW.address_line1, address_line2 = NEW.address_line2,
      city = NEW.city, state = NEW.state, postal_code = NEW.postal_code, country = NEW.country,
      salesperson_id = NEW.salesperson_id, sales_team = NEW.sales_team,
      priority = NEW.priority, tags = NEW.tags, legacy_metadata = NEW.legacy_metadata
    WHERE id = NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM sales.leads WHERE id = OLD.id;
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dual_write_from_leads (op=%, id=%) failed: %', TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_leads_dual_write_to_sales
  AFTER INSERT OR UPDATE OR DELETE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION sales.dual_write_from_leads();

-- ══════════════════════════════════════════════════════════════════════
-- 7. Dual-write triggers — public.opportunities → sales.opportunities
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION sales.dual_write_from_opportunities()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = sales, pg_catalog AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO sales.opportunities VALUES (
      NEW.id, NEW.tenant_id, NEW.franchise_id, NEW.name, NEW.description,
      NEW.stage::text, NEW.amount, NEW.probability, NEW.close_date,
      NEW.account_id, NEW.contact_id, NEW.lead_id, NEW.owner_id,
      NEW.lead_source::text, NEW.next_step, NEW.competitors, NEW.campaign_id, NEW.type,
      NEW.forecast_category, NEW.expected_revenue, NEW.created_by,
      COALESCE(NEW.created_at, now()), COALESCE(NEW.updated_at, now()), NEW.closed_at,
      NEW.salesforce_opportunity_id, NEW.salesforce_sync_status, NEW.salesforce_last_synced,
      NEW.salesforce_error, NEW.primary_quote_id
    ) ON CONFLICT (id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE sales.opportunities SET
      tenant_id = NEW.tenant_id, franchise_id = NEW.franchise_id,
      name = NEW.name, description = NEW.description,
      stage = NEW.stage::text, amount = NEW.amount,
      probability = NEW.probability, close_date = NEW.close_date,
      account_id = NEW.account_id, contact_id = NEW.contact_id,
      lead_id = NEW.lead_id, owner_id = NEW.owner_id,
      lead_source = NEW.lead_source::text, next_step = NEW.next_step,
      competitors = NEW.competitors, campaign_id = NEW.campaign_id,
      type = NEW.type, forecast_category = NEW.forecast_category,
      expected_revenue = NEW.expected_revenue, created_by = NEW.created_by,
      updated_at = COALESCE(NEW.updated_at, now()), closed_at = NEW.closed_at,
      salesforce_opportunity_id = NEW.salesforce_opportunity_id,
      salesforce_sync_status = NEW.salesforce_sync_status,
      salesforce_last_synced = NEW.salesforce_last_synced,
      salesforce_error = NEW.salesforce_error,
      primary_quote_id = NEW.primary_quote_id
    WHERE id = NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM sales.opportunities WHERE id = OLD.id;
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dual_write_from_opportunities (op=%, id=%) failed: %', TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_opportunities_dual_write_to_sales
  AFTER INSERT OR UPDATE OR DELETE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION sales.dual_write_from_opportunities();

-- ══════════════════════════════════════════════════════════════════════
-- 8. Drift monitor
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION sales.base_drift_check()
RETURNS TABLE (metric text, delta bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = sales, public, pg_catalog AS $$
  SELECT 'leads_minus_sales_leads',
         (SELECT count(*) FROM public.leads) - (SELECT count(*) FROM sales.leads)
  UNION ALL
  SELECT 'opportunities_minus_sales_opportunities',
         (SELECT count(*) FROM public.opportunities) - (SELECT count(*) FROM sales.opportunities);
$$;

COMMENT ON FUNCTION sales.base_drift_check IS
  'Phase 4 Sales Step 1 drift monitor. Both deltas should remain 0.';

GRANT EXECUTE ON FUNCTION sales.base_drift_check TO service_role;
