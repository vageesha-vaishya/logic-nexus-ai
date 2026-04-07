-- Add franchise scoping support to aircraft_template and backfill with Deccan Fly franchise.

ALTER TABLE public.aircraft_template
  ADD COLUMN IF NOT EXISTS franchise_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'aircraft_template_franchise_id_fkey'
      AND conrelid = 'public.aircraft_template'::regclass
  ) THEN
    ALTER TABLE public.aircraft_template
      ADD CONSTRAINT aircraft_template_franchise_id_fkey
      FOREIGN KEY (franchise_id)
      REFERENCES public.franchises(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_aircraft_template_franchise_id
  ON public.aircraft_template(franchise_id);

DO $$
DECLARE
  v_franchise_id uuid;
  v_tenant_id uuid;
BEGIN
  SELECT f.id, f.tenant_id
    INTO v_franchise_id, v_tenant_id
  FROM public.franchises f
  WHERE lower(f.name) = 'deccan fly'
     OR lower(f.code) IN ('deccan-fly', 'deccan_fly', 'deccanfly', 'deccan')
  ORDER BY f.is_active DESC, f.created_at ASC
  LIMIT 1;

  IF v_franchise_id IS NULL THEN
    SELECT COALESCE(
      (SELECT tenant_id FROM public.aircraft_template WHERE tenant_id IS NOT NULL LIMIT 1),
      (SELECT id FROM public.tenants ORDER BY created_at ASC LIMIT 1)
    )
    INTO v_tenant_id;

    IF v_tenant_id IS NULL THEN
      RAISE EXCEPTION 'Unable to backfill aircraft_template.franchise_id: no tenant found.';
    END IF;

    INSERT INTO public.franchises (tenant_id, name, code, address, is_active)
    VALUES (v_tenant_id, 'Deccan Fly', 'DECCAN-FLY', '{}'::jsonb, true)
    RETURNING id INTO v_franchise_id;
  END IF;

  UPDATE public.aircraft_template t
  SET franchise_id = v_franchise_id
  WHERE t.franchise_id IS NULL
    AND (v_tenant_id IS NULL OR t.tenant_id = v_tenant_id OR t.tenant_id IS NULL);
END $$;
