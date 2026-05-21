-- Closed-beta seed: one shared "Sthira Retail" tenant + "Sthira Default"
-- franchise. Every friend provisioned via scripts/provision-sthira-friend.mjs
-- gets a public.user_roles row binding them to this tenant + franchise so
-- useActiveScope() resolves and the existing tenant-scoped flows
-- (useCreatePortfolio, etc.) work without code changes.
--
-- Idempotent — re-running this migration is safe.

DO $$
DECLARE
  v_tenant_id    UUID;
  v_franchise_id UUID;
  v_markets_dom  UUID := 'd127c2d9-91f0-4b71-bc44-3697efec92e8'; -- public.platform_domains where code = 'markets'
BEGIN
  -- 1. Tenant
  SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = 'sthira-retail';
  IF v_tenant_id IS NULL THEN
    INSERT INTO public.tenants (name, slug, domain_id)
    VALUES ('Sthira Retail', 'sthira-retail', v_markets_dom)
    RETURNING id INTO v_tenant_id;
    RAISE NOTICE 'Created Sthira Retail tenant: %', v_tenant_id;
  ELSE
    RAISE NOTICE 'Sthira Retail tenant already exists: %', v_tenant_id;
  END IF;

  -- 2. Franchise
  SELECT id INTO v_franchise_id
  FROM public.franchises
  WHERE tenant_id = v_tenant_id AND code = 'sthira-default';
  IF v_franchise_id IS NULL THEN
    INSERT INTO public.franchises (tenant_id, name, code)
    VALUES (v_tenant_id, 'Sthira Default', 'sthira-default')
    RETURNING id INTO v_franchise_id;
    RAISE NOTICE 'Created Sthira Default franchise: %', v_franchise_id;
  ELSE
    RAISE NOTICE 'Sthira Default franchise already exists: %', v_franchise_id;
  END IF;
END $$;
