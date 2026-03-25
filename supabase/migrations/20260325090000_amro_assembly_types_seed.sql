BEGIN;
INSERT INTO public.assembly_types (
  tenant_id,
  franchise_id,
  assembly_code,
  name,
  description,
  is_active,
  metadata
)
VALUES
  (
    'e42ec6fd-6b88-4721-befe-4443d9743120',
    NULL,
    'AIRFRAME',
    'Airframe',
    'The main structure of the aircraft, including fuselage, wings, and control surfaces.',
    true,
    jsonb_build_object('source', 'seed_list')
  ),
  (
    'e42ec6fd-6b88-4721-befe-4443d9743120',
    NULL,
    'ENGINE',
    'Engine',
    'The primary propulsion unit (Turbofan, Turboprop, or Piston).',
    true,
    jsonb_build_object('source', 'seed_list')
  ),
  (
    'e42ec6fd-6b88-4721-befe-4443d9743120',
    NULL,
    'PROPELLER',
    'Propeller',
    'Specific to turboprop or piston aircraft; includes blades and hubs.',
    true,
    jsonb_build_object('source', 'seed_list')
  ),
  (
    'e42ec6fd-6b88-4721-befe-4443d9743120',
    NULL,
    'APU',
    'Auxiliary Power Unit (APU)',
    'The small gas turbine engine usually located in the tail for ground power/starting.',
    true,
    jsonb_build_object('source', 'seed_list')
  ),
  (
    'e42ec6fd-6b88-4721-befe-4443d9743120',
    NULL,
    'LANDING_GEAR',
    'Landing Gear',
    'The complete assembly of struts, wheels, and braking systems.',
    true,
    jsonb_build_object('source', 'seed_list')
  ),
  (
    'e42ec6fd-6b88-4721-befe-4443d9743120',
    NULL,
    'AIR_CONDITIONING',
    'Air Conditioning',
    'The Environmental Control System (ECS), including packs and pressurization.',
    true,
    jsonb_build_object('source', 'seed_list')
  ),
  (
    'e42ec6fd-6b88-4721-befe-4443d9743120',
    NULL,
    'AVIONICS',
    'Avionics',
    'Electronic systems like navigation, communication, and flight management.',
    true,
    jsonb_build_object('source', 'seed_list')
  ),
  (
    'e42ec6fd-6b88-4721-befe-4443d9743120',
    NULL,
    'INTERIOR_CABIN',
    'Interior/Cabin',
    'Seats, galleys, and emergency equipment.',
    true,
    jsonb_build_object('source', 'seed_list')
  )
ON CONFLICT (tenant_id, assembly_code) DO NOTHING;
COMMIT;
