-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260515050246; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--

-- Grant markets domain to the Deccan tenant (which is where bahuguna.vimal@gmail.com
-- actually has roles). Keeps the SOS Services assignment too; both tenants now have markets.
INSERT INTO public.tenant_domain_assignments
  (tenant_id, domain_id, is_active, subscription_status)
SELECT
  'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid,
  (SELECT id FROM public.platform_domains WHERE code = 'markets'),
  true,
  'trialing'
WHERE NOT EXISTS (
  SELECT 1 FROM public.tenant_domain_assignments tda
  WHERE tda.tenant_id = 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid
    AND tda.domain_id = (SELECT id FROM public.platform_domains WHERE code = 'markets')
);