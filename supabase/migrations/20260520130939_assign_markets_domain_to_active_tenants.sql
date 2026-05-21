-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260520130939; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--

DO $$
DECLARE
  v_markets_domain_id UUID;
  v_tenant RECORD;
  v_inserted INT := 0;
BEGIN
  SELECT id INTO v_markets_domain_id
  FROM public.platform_domains
  WHERE key = 'markets' OR UPPER(trim(code)) = 'MARKETS'
  LIMIT 1;

  IF v_markets_domain_id IS NULL THEN
    RAISE EXCEPTION 'MARKETS domain not found in platform_domains';
  END IF;

  FOR v_tenant IN
    SELECT t.id AS tenant_id
    FROM public.tenants t
    WHERE t.is_active = true
      AND NOT EXISTS (
        SELECT 1
        FROM public.tenant_domain_assignments tda
        WHERE tda.tenant_id = t.id
          AND tda.domain_id = v_markets_domain_id
          AND tda.is_active = true
      )
  LOOP
    INSERT INTO public.tenant_domain_assignments (
      tenant_id, domain_id, is_active, subscription_status, grace_until, created_at, updated_at
    ) VALUES (
      v_tenant.tenant_id, v_markets_domain_id, true, 'active', NULL, NOW(), NOW()
    )
    ON CONFLICT (tenant_id, domain_id) DO UPDATE SET
      is_active = true,
      subscription_status = 'active',
      updated_at = NOW();
    v_inserted := v_inserted + 1;
  END LOOP;

  RAISE NOTICE 'Added/updated MARKETS assignments for % tenants', v_inserted;
END $$;