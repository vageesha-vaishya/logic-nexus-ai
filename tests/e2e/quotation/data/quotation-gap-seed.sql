BEGIN;

INSERT INTO public.quotes (
  id,
  tenant_id,
  quote_number,
  status,
  created_at,
  updated_at
) VALUES
  ('41000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', 'QUO-GAP-0001', 'draft', now(), now()),
  ('41000000-0000-4000-8000-000000000002', '51000000-0000-4000-8000-000000000001', 'QUO-GAP-0002', 'draft', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.quotation_versions (
  id,
  quote_id,
  tenant_id,
  version_number,
  major,
  minor,
  kind,
  status,
  is_active,
  is_current,
  metadata,
  created_at,
  updated_at
) VALUES
  (
    '42000000-0000-4000-8000-000000000001',
    '41000000-0000-4000-8000-000000000001',
    '51000000-0000-4000-8000-000000000001',
    1,
    1,
    0,
    'major',
    'draft',
    true,
    true,
    jsonb_build_object('source', 'gap_seed', 'mode', 'air'),
    now(),
    now()
  ),
  (
    '42000000-0000-4000-8000-000000000002',
    '41000000-0000-4000-8000-000000000002',
    '51000000-0000-4000-8000-000000000001',
    1,
    1,
    0,
    'major',
    'draft',
    true,
    true,
    jsonb_build_object('source', 'gap_seed', 'mode', 'ocean'),
    now(),
    now()
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.quotation_version_options (
  id,
  quotation_version_id,
  tenant_id,
  option_name,
  carrier_name,
  total_amount,
  total_sell,
  total_buy,
  margin_amount,
  margin_percentage,
  status,
  source,
  created_at,
  updated_at
) VALUES
  (
    '43000000-0000-4000-8000-000000000001',
    '42000000-0000-4000-8000-000000000001',
    '51000000-0000-4000-8000-000000000001',
    'Air Express + Last Mile',
    'Carrier-X',
    2500,
    2500,
    2000,
    500,
    25,
    'active',
    'smart_quote',
    now(),
    now()
  ),
  (
    '43000000-0000-4000-8000-000000000002',
    '42000000-0000-4000-8000-000000000002',
    '51000000-0000-4000-8000-000000000001',
    'Ocean FCL + Delivery',
    'Carrier-Y',
    3900,
    3900,
    3200,
    700,
    21.88,
    'active',
    'manual',
    now(),
    now()
  )
ON CONFLICT (id) DO NOTHING;

COMMIT;
