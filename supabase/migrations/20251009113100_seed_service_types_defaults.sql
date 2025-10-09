-- Seed default service types (idempotent)
BEGIN;

INSERT INTO public.service_types (name, description, is_active)
VALUES
  ('ocean', 'Ocean freight', true),
  ('air', 'Air freight', true),
  ('trucking', 'Inland trucking', true),
  ('courier', 'Courier/Express', true),
  ('moving', 'Movers & Packers', true),
  ('railway_transport', 'Railway transport', true)
ON CONFLICT (name)
DO UPDATE SET is_active = EXCLUDED.is_active;

COMMIT;