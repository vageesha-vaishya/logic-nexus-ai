BEGIN;

-- Deduplicate by tenant + lower(name)
WITH dupes AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id, lower(carrier_name)
      ORDER BY id DESC
    ) AS rn
  FROM public.carriers
)
DELETE FROM public.carriers c
USING dupes d
WHERE c.id = d.id
  AND d.rn > 1;

-- Deduplicate by tenant + code (non-null)
WITH dupes_code AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id, carrier_code
      ORDER BY id DESC
    ) AS rn
  FROM public.carriers
  WHERE carrier_code IS NOT NULL
)
DELETE FROM public.carriers c
USING dupes_code d
WHERE c.id = d.id
  AND d.rn > 1;

-- Enforce uniqueness per tenant
CREATE UNIQUE INDEX IF NOT EXISTS carriers_tenant_name_unique
  ON public.carriers (tenant_id, lower(carrier_name));

CREATE UNIQUE INDEX IF NOT EXISTS carriers_tenant_code_unique
  ON public.carriers (tenant_id, carrier_code)
  WHERE carrier_code IS NOT NULL;

COMMIT;