-- Create directives type master table
-- DB-VERIFICATION: pending-local-migration-apply
-- DB-ARCH-APPROVAL: pending-review
-- Extension assessment:
--   Existing public.directives is a transaction/master table and cannot safely host
--   reusable directive type catalog records without mixing responsibilities.

BEGIN;

CREATE TABLE IF NOT EXISTS public.directives_type (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  directives_type_id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  tenant_id uuid NOT NULL,
  franchise_id uuid NULL,
  code character varying(10) NOT NULL,
  name character varying(100) NOT NULL,
  description text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pk_directives_type PRIMARY KEY (id),
  CONSTRAINT fk_directives_type_tenant
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_directives_type_franchise
    FOREIGN KEY (franchise_id) REFERENCES public.franchises(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_directives_type_tenant_sequence
  ON public.directives_type (tenant_id, directives_type_id);
CREATE INDEX IF NOT EXISTS idx_directives_type_tenant_id
  ON public.directives_type (tenant_id);
CREATE INDEX IF NOT EXISTS idx_directives_type_franchise_id
  ON public.directives_type (franchise_id);
CREATE INDEX IF NOT EXISTS idx_directives_type_code
  ON public.directives_type (code);

COMMENT ON TABLE public.directives_type IS
  'Tenant/franchise scoped directive type catalog.';

COMMIT;
