-- DB-VERIFICATION: aircraft-operators-schema-overlap-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.aircraft_operators (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  franchise_id uuid NULL,
  operator_code character varying(20) NOT NULL,
  operator_name character varying(255) NOT NULL,
  operator_type character varying(50) NOT NULL DEFAULT 'Corporate'::character varying,
  contact_person character varying(100) NULL,
  contact_email character varying(255) NULL,
  phone_number character varying(20) NULL,
  address text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT aircraft_operators_pkey PRIMARY KEY (id),
  CONSTRAINT aircraft_operators_operator_code_uk UNIQUE (operator_code),
  CONSTRAINT aircraft_operators_franchise_id_fkey FOREIGN KEY (franchise_id) REFERENCES public.franchises (id) ON DELETE SET NULL,
  CONSTRAINT aircraft_operators_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants (id) ON DELETE CASCADE,
  CONSTRAINT aircraft_operators_contact_email_ck CHECK (
    (
      (contact_email IS NULL)
      OR (
        (contact_email)::text ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'::text
      )
    )
  ),
  CONSTRAINT aircraft_operators_operator_code_ck CHECK (((operator_code)::text ~ '^[A-Z0-9_-]+$'::text))
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_aircraft_operators_tenant_id
  ON public.aircraft_operators USING btree (tenant_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_aircraft_operators_franchise_id
  ON public.aircraft_operators USING btree (franchise_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_aircraft_operators_operator_code_upper
  ON public.aircraft_operators USING btree (upper((operator_code)::text)) TABLESPACE pg_default;

DO $$
DECLARE
  v_tenant_id constant uuid := '157b8d12-c115-446e-a4dc-d12077751fe2';
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = v_tenant_id
  ) THEN
    RAISE EXCEPTION 'Tenant % not found in public.tenants. Seed tenant before inserting aircraft_operators.', v_tenant_id;
  END IF;

  INSERT INTO public.aircraft_operators (
    tenant_id,
    franchise_id,
    operator_code,
    operator_name,
    operator_type
  )
  VALUES
    (v_tenant_id, NULL, 'DECCAN', 'Deccan Charters Pvt Ltd', 'Corporate'),
    (v_tenant_id, NULL, 'GLOBAL_OPS_AIR', 'Global Ops Air', 'Corporate'),
    (v_tenant_id, NULL, 'LEASED_FLEET', 'Leased Fleet Holdings', 'Corporate')
  ON CONFLICT (operator_code) DO UPDATE
  SET
    tenant_id = EXCLUDED.tenant_id,
    franchise_id = EXCLUDED.franchise_id,
    operator_name = EXCLUDED.operator_name,
    operator_type = EXCLUDED.operator_type,
    updated_at = now();
END
$$;

COMMIT;
