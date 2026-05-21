-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260514122035; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--

-- =========================================================================
-- Green cleanup #1: drop confirmed-duplicate plain indexes + add 2 PKs
-- Skipped: indexes with DESC ordering (still useful for ORDER BY DESC),
-- expression-index "duplicates" caught by indkey-only grouping (false positives),
-- and groups where both indexes back UNIQUE constraints (need design decision).
-- =========================================================================

-- ---- Drops: plain idx that duplicates a unique-constraint-backed index ----
DROP INDEX IF EXISTS module_amro.module_amro_aircraft_serial_number_idx;
DROP INDEX IF EXISTS module_uim.module_uim_catalog_items_tenant_id_sku_idx;
DROP INDEX IF EXISTS module_uim.module_uim_inventory_projection_tenant_id_inventory_item_id_idx;
DROP INDEX IF EXISTS public.idx_aes_hts_codes_hts_code;
DROP INDEX IF EXISTS public.idx_aircraft_serial_number;
DROP INDEX IF EXISTS public.aircraft_duplicate_serial_number_idx;
DROP INDEX IF EXISTS public.idx_carrier_alliances_code;
DROP INDEX IF EXISTS public.idx_container_types_code;
DROP INDEX IF EXISTS public.idx_dashboard_preferences_user_id;
DROP INDEX IF EXISTS public.idx_global_hs_roots_hs6_code;
DROP INDEX IF EXISTS public.idx_invitations_token;
DROP INDEX IF EXISTS public.idx_master_commodities_tenant_sku;
DROP INDEX IF EXISTS public.idx_oauth_configurations_user_provider;
DROP INDEX IF EXISTS public.idx_portal_tokens_token;
DROP INDEX IF EXISTS public.idx_mgl_rate_charge_cells_row;
DROP INDEX IF EXISTS public.idx_mgl_rate_option_legs_option;
DROP INDEX IF EXISTS public.idx_rps_name;
DROP INDEX IF EXISTS public.idx_self_service_onboarding_requests_admin_email;
DROP INDEX IF EXISTS public.idx_subscription_invoices_stripe;
DROP INDEX IF EXISTS public.idx_tenant_subscriptions_stripe;
DROP INDEX IF EXISTS public.idx_uim_catalog_items_tenant_sku;
DROP INDEX IF EXISTS public.idx_uim_projection_snapshots_tenant_item;
DROP INDEX IF EXISTS public.idx_service_types_name;

-- ---- Drops: plain idx pairs (both non-constraint); keep more descriptive name ----
DROP INDEX IF EXISTS module_crm.module_crm_accounts_parent_account_id_idx1;
DROP INDEX IF EXISTS public.idx_accounts_parent_id;
DROP INDEX IF EXISTS public.idx_cargo_details_aes_hts;
DROP INDEX IF EXISTS public.idx_carrier_rate_charges_rate;
DROP INDEX IF EXISTS public.idx_carrier_rates_carrier;
DROP INDEX IF EXISTS public.idx_import_history_details_import;
DROP INDEX IF EXISTS public.idx_lead_activities_lead;
DROP INDEX IF EXISTS public.idx_lead_score_logs_lead;
DROP INDEX IF EXISTS public.idx_quote_legs_option_id;
DROP INDEX IF EXISTS public.idx_qvo_version;
DROP INDEX IF EXISTS public.quote_charges_option_idx;
DROP INDEX IF EXISTS public.quote_items_quote_idx;
DROP INDEX IF EXISTS public.idx_quote_templates_tenant;
DROP INDEX IF EXISTS public.idx_stm_tenant;
DROP INDEX IF EXISTS public.idx_shipment_attachments_shipment;
DROP INDEX IF EXISTS public.idx_territory_geographies_territory;
DROP INDEX IF EXISTS public.idx_territory_geographies_continent;
DROP INDEX IF EXISTS public.idx_territory_geographies_country;
DROP INDEX IF EXISTS public.idx_territory_geographies_state;
DROP INDEX IF EXISTS public.idx_wpt_task_temlates_tenant_id;
DROP INDEX IF EXISTS public.idx_wpt_task_temlates_franchise_id;
DROP INDEX IF EXISTS public.idx_wpt_task_temlates_work_package_template_id;
DROP INDEX IF EXISTS public.idx_wpt_task_temlates_model_id;
DROP INDEX IF EXISTS public.idx_wpt_task_temlates_task_template_id;

-- ---- Drops: plain unique indexes that duplicate a constraint ----
DROP INDEX IF EXISTS public.service_types_code_unique;        -- dup of service_types_code_key (constraint)
DROP INDEX IF EXISTS public.idx_service_types_code;            -- dup of service_types_code_key
DROP INDEX IF EXISTS public.uq_quote_version;                  -- dup of uq_quote_major_minor (constraint)
DROP INDEX IF EXISTS public.uq_work_orders_tenant_work_order_number;  -- dup of uq_work_orders_tenant_number_active

-- =========================================================================
-- Add primary keys to verified-safe tables
-- =========================================================================
ALTER TABLE module_crm.module_crm_quote_items
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ADD CONSTRAINT module_crm_quote_items_pkey PRIMARY KEY (id);

ALTER TABLE public.import_overrides
  ADD CONSTRAINT import_overrides_pkey PRIMARY KEY (id);