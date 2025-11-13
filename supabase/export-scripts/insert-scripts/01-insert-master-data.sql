-- ==========================================
-- PHASE 1: MASTER DATA INSERT STATEMENTS
-- ==========================================
-- Execute this first - no foreign key dependencies
-- Run these queries in Supabase SQL Editor to get INSERT statements

-- ==========================================
-- Tenants
-- ==========================================
SELECT 'INSERT INTO tenants (id, name, slug, domain, logo_url, subscription_tier, is_active, settings, created_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L, %L::jsonb, %L)',
      id, name, slug, domain, logo_url, subscription_tier, is_active, settings::text, created_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM tenants;

-- ==========================================
-- Franchises
-- ==========================================
SELECT 'INSERT INTO franchises (id, tenant_id, name, code, manager_id, is_active, address, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L::jsonb, %L, %L)',
      id, tenant_id, name, code, manager_id, is_active, address::text, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM franchises;

-- ==========================================
-- Profiles
-- ==========================================
SELECT 'INSERT INTO profiles (id, email, first_name, last_name, phone, avatar_url, is_active, must_change_password, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L, %L, %L, %L)',
      id, email, first_name, last_name, phone, avatar_url, is_active, must_change_password, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM profiles;

-- ==========================================
-- User Roles
-- ==========================================
SELECT 'INSERT INTO user_roles (id, user_id, tenant_id, franchise_id, role, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L)',
      id, user_id, tenant_id, franchise_id, role, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM user_roles;

-- ==========================================
-- Continents
-- ==========================================
SELECT 'INSERT INTO continents (id, tenant_id, name, code, is_active, created_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L)',
      id, tenant_id, name, code, is_active, created_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM continents
WHERE EXISTS (SELECT 1 FROM continents LIMIT 1);

-- ==========================================
-- Countries
-- ==========================================
SELECT 'INSERT INTO countries (id, tenant_id, continent_id, name, code_iso2, code_iso3, code_national, phone_code, is_active, created_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L, %L, %L, %L)',
      id, tenant_id, continent_id, name, code_iso2, code_iso3, code_national, phone_code, is_active, created_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM countries
WHERE EXISTS (SELECT 1 FROM countries LIMIT 1);

-- ==========================================
-- Cities
-- ==========================================
SELECT 'INSERT INTO cities (id, tenant_id, country_id, name, state_province, is_active, created_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L)',
      id, tenant_id, country_id, name, state_province, is_active, created_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM cities
WHERE EXISTS (SELECT 1 FROM cities LIMIT 1);

-- ==========================================
-- Ports/Locations
-- ==========================================
SELECT 'INSERT INTO ports_locations (id, tenant_id, city_id, port_name, port_code, port_type, latitude, longitude, is_active, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L)',
      id, tenant_id, city_id, port_name, port_code, port_type, latitude, longitude, is_active, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM ports_locations
WHERE EXISTS (SELECT 1 FROM ports_locations LIMIT 1);

-- ==========================================
-- Currencies
-- ==========================================
SELECT 'INSERT INTO currencies (id, tenant_id, currency_code, currency_name, symbol, exchange_rate, is_active, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L, %L, %L)',
      id, tenant_id, currency_code, currency_name, symbol, exchange_rate, is_active, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM currencies
WHERE EXISTS (SELECT 1 FROM currencies LIMIT 1);

-- ==========================================
-- Service Types
-- ==========================================
SELECT 'INSERT INTO service_types (id, tenant_id, service_type_name, service_type_code, category, is_active, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L, %L)',
      id, tenant_id, service_type_name, service_type_code, category, is_active, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM service_types
WHERE EXISTS (SELECT 1 FROM service_types LIMIT 1);

-- ==========================================
-- Cargo Types
-- ==========================================
SELECT string_agg(
  format(
    'INSERT INTO cargo_types (id, tenant_id, cargo_type_name, cargo_code, requires_special_handling, hazmat_class, temperature_controlled, description, is_active, created_at, updated_at) \
     SELECT %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L \
     WHERE EXISTS (SELECT 1 FROM tenants t WHERE t.id = %L) ON CONFLICT (id) DO NOTHING;',
    id, tenant_id, cargo_type_name, cargo_code, requires_special_handling, hazmat_class, temperature_controlled, description, is_active, created_at, updated_at, tenant_id
  ),
  E'\n'
)
FROM cargo_types
WHERE EXISTS (SELECT 1 FROM cargo_types LIMIT 1);

-- ==========================================
-- Package Categories
-- ==========================================
SELECT 'INSERT INTO package_categories (id, tenant_id, category_name, category_code, is_active, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L)',
      id, tenant_id, category_name, category_code, is_active, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM package_categories
WHERE EXISTS (SELECT 1 FROM package_categories LIMIT 1);

-- ==========================================
-- Package Sizes
-- ==========================================
SELECT 'INSERT INTO package_sizes (id, tenant_id, category_id, size_name, size_code, dimensions, max_weight_kg, is_active, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L::jsonb, %L, %L, %L, %L)',
      id, tenant_id, category_id, size_name, size_code, dimensions::text, max_weight_kg, is_active, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM package_sizes
WHERE EXISTS (SELECT 1 FROM package_sizes LIMIT 1);

-- ==========================================
-- Container Types
-- ==========================================
SELECT 'INSERT INTO container_types (id, tenant_id, name, code, is_active, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L)',
      id, tenant_id, name, code, is_active, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM container_types
WHERE EXISTS (SELECT 1 FROM container_types LIMIT 1);

-- ==========================================
-- Container Sizes
-- ==========================================
SELECT 'INSERT INTO container_sizes (id, tenant_id, container_type_id, size_name, size_code, length_cm, width_cm, height_cm, capacity_cbm, max_weight_kg, is_active, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L)',
      id, tenant_id, container_type_id, size_name, size_code, length_cm, width_cm, height_cm, capacity_cbm, max_weight_kg, is_active, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM container_sizes
WHERE EXISTS (SELECT 1 FROM container_sizes LIMIT 1);

-- ==========================================
-- Carriers
-- ==========================================
SELECT string_agg(
  format(
    'INSERT INTO carriers (id, tenant_id, carrier_name, carrier_code, carrier_type, contact_person, contact_email, contact_phone, website, address, service_routes, rating, notes, mode, scac, iata, mc_dot, is_active, created_at, updated_at) \
     SELECT %L, %L, %L, %L, %L, %L, %L, %L, %L, %L::jsonb, %L::jsonb, %L, %L, %L, %L, %L, %L, %L, %L, %L \
     WHERE EXISTS (SELECT 1 FROM tenants t WHERE t.id = %L) ON CONFLICT (id) DO NOTHING;',
    id, tenant_id, carrier_name, carrier_code, carrier_type, contact_person, contact_email, contact_phone, website, address::text, service_routes::text, rating, notes, mode, scac, iata, mc_dot, is_active, created_at, updated_at, tenant_id
  ),
  E'\n'
)
FROM carriers
WHERE EXISTS (SELECT 1 FROM carriers LIMIT 1);

-- ==========================================
-- Consignees
-- ==========================================
SELECT 'INSERT INTO consignees (id, tenant_id, company_name, contact_person, contact_email, contact_phone, address, tax_id, customs_id, notes, is_active, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L::jsonb, %L, %L, %L, %L, %L, %L)',
      id, tenant_id, company_name, contact_person, contact_email, contact_phone, address::text, tax_id, customs_id, notes, is_active, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM consignees
WHERE EXISTS (SELECT 1 FROM consignees LIMIT 1);

-- ==========================================
-- Incoterms
-- ==========================================
SELECT 'INSERT INTO incoterms (id, tenant_id, incoterm_code, incoterm_name, description, is_active, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L, %L)',
      id, tenant_id, incoterm_code, incoterm_name, description, is_active, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM incoterms
WHERE EXISTS (SELECT 1 FROM incoterms LIMIT 1);

-- ==========================================
-- Vehicles
-- ==========================================
SELECT 'INSERT INTO vehicles (id, tenant_id, vehicle_type, registration_number, make, model, year, capacity_kg, capacity_cbm, driver_name, driver_contact, is_active, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L)',
      id, tenant_id, vehicle_type, registration_number, make, model, year, capacity_kg, capacity_cbm, driver_name, driver_contact, is_active, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM vehicles
WHERE EXISTS (SELECT 1 FROM vehicles LIMIT 1);

-- ==========================================
-- Warehouses
-- ==========================================
SELECT 'INSERT INTO warehouses (id, tenant_id, warehouse_name, warehouse_code, city_id, address, contact_person, contact_phone, contact_email, capacity_cbm, is_active, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L::jsonb, %L, %L, %L, %L, %L, %L, %L)',
      id, tenant_id, warehouse_name, warehouse_code, city_id, address::text, contact_person, contact_phone, contact_email, capacity_cbm, is_active, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM warehouses
WHERE EXISTS (SELECT 1 FROM warehouses LIMIT 1);

-- ==========================================
-- Charge Sides
-- ==========================================
SELECT 'INSERT INTO charge_sides (id, tenant_id, side_name, side_code, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L)',
      id, tenant_id, side_name, side_code, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM charge_sides
WHERE EXISTS (SELECT 1 FROM charge_sides LIMIT 1);

-- ==========================================
-- Charge Categories
-- ==========================================
SELECT 'INSERT INTO charge_categories (id, tenant_id, category_name, category_code, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L)',
      id, tenant_id, category_name, category_code, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM charge_categories
WHERE EXISTS (SELECT 1 FROM charge_categories LIMIT 1);

-- ==========================================
-- Charge Bases
-- ==========================================
SELECT 'INSERT INTO charge_bases (id, tenant_id, basis_name, basis_code, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L)',
      id, tenant_id, basis_name, basis_code, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM charge_bases
WHERE EXISTS (SELECT 1 FROM charge_bases LIMIT 1);

-- ==========================================
-- Services
-- ==========================================
SELECT 'INSERT INTO services (id, tenant_id, service_type_id, service_code, service_name, service_type, description, base_price, pricing_unit, transit_time_days, is_active, metadata, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L::jsonb, %L, %L)',
      id, tenant_id, service_type_id, service_code, service_name, service_type, description, base_price, pricing_unit, transit_time_days, is_active, metadata::text, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM services
WHERE EXISTS (SELECT 1 FROM services LIMIT 1);
