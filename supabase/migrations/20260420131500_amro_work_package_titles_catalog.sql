BEGIN;

-- DB-VERIFICATION: Added tenant-scoped work package title catalog for AMRO work order creation flow and deterministic numbering suffix resolution.
-- DB-ARCH-APPROVAL: Pending architecture board review for additive table + non-breaking FK extension to public.work_packages.

CREATE TABLE IF NOT EXISTS public.work_packages_title (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  franchise_id uuid NULL,
  title text NOT NULL,
  wp_title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_work_packages_title PRIMARY KEY (id),
  CONSTRAINT uq_work_packages_title_tenant_title UNIQUE (tenant_id, title),
  CONSTRAINT ck_work_packages_title_wp_title_not_blank CHECK (length(trim(wp_title)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_work_packages_title_tenant_id
  ON public.work_packages_title(tenant_id);

CREATE INDEX IF NOT EXISTS idx_work_packages_title_franchise_id
  ON public.work_packages_title(franchise_id);

ALTER TABLE public.work_packages
  ADD COLUMN IF NOT EXISTS work_package_title_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_work_packages_work_package_title_id'
      AND conrelid = 'public.work_packages'::regclass
  ) THEN
    ALTER TABLE public.work_packages
      ADD CONSTRAINT fk_work_packages_work_package_title_id
      FOREIGN KEY (work_package_title_id)
      REFERENCES public.work_packages_title(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_work_packages_work_package_title_id
  ON public.work_packages(work_package_title_id);

INSERT INTO public.work_packages_title (tenant_id, franchise_id, title, wp_title)
VALUES
  ('157b8d12-c115-446e-a4dc-d12077751fe2', NULL, 'Hot section intervention planning', 'HOTSEC'),
  ('157b8d12-c115-446e-a4dc-d12077751fe2', NULL, 'LLP cycle projection and replacement prep', 'LLPAUDIT'),
  ('157b8d12-c115-446e-a4dc-d12077751fe2', NULL, 'Oil consumption exceedance corrective action', 'OILANALYSIS'),
  ('157b8d12-c115-446e-a4dc-d12077751fe2', NULL, 'Starter Work Package', 'STARTER'),
  ('157b8d12-c115-446e-a4dc-d12077751fe2', NULL, 'Engine borescope inspection package', 'BORESCOPE'),
  ('157b8d12-c115-446e-a4dc-d12077751fe2', NULL, 'Engine warranty status review', 'WARRANTTY'),
  ('157b8d12-c115-446e-a4dc-d12077751fe2', NULL, 'A-Check Deccan Fly', 'ACHECK'),
  ('157b8d12-c115-446e-a4dc-d12077751fe2', NULL, 'pre_docking', 'PREDOCKING'),
  ('157b8d12-c115-446e-a4dc-d12077751fe2', NULL, 'C-Check Deccan Fly Heavy', 'CCHECK'),
  ('157b8d12-c115-446e-a4dc-d12077751fe2', NULL, 'WiFi System Upgrade', 'WIFI'),
  ('157b8d12-c115-446e-a4dc-d12077751fe2', NULL, 'A-Check Inspection', 'ACHECK'),
  ('157b8d12-c115-446e-a4dc-d12077751fe2', NULL, 'Engine Overhaul - CFM56', 'EOVERHAUL'),
  ('157b8d12-c115-446e-a4dc-d12077751fe2', NULL, 'slotting', 'SLOTTING'),
  ('157b8d12-c115-446e-a4dc-d12077751fe2', NULL, 'Verify post-fix path', 'VERIFYFIX'),
  ('157b8d12-c115-446e-a4dc-d12077751fe2', NULL, 'Annual Airworthiness Review', 'ANNUALREV'),
  ('157b8d12-c115-446e-a4dc-d12077751fe2', NULL, 'Cabin Refurbishment - Deferred', 'CABINREF'),
  ('157b8d12-c115-446e-a4dc-d12077751fe2', NULL, 'Pre-Flight Inspection', 'PREFLIGHT'),
  ('157b8d12-c115-446e-a4dc-d12077751fe2', NULL, 'Landing Gear Inspection', 'LANDGEAR'),
  ('157b8d12-c115-446e-a4dc-d12077751fe2', NULL, 'Runtime path retry package', 'PATHRETRY'),
  ('157b8d12-c115-446e-a4dc-d12077751fe2', NULL, 'APU Repair', 'APUREPAIR')
ON CONFLICT (tenant_id, title) DO UPDATE
SET wp_title = EXCLUDED.wp_title,
    updated_at = now();

COMMIT;
