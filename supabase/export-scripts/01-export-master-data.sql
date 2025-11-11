-- Export Master Data (No Dependencies)
-- Run these exports first as other tables depend on this data

-- Tenants
COPY (
  SELECT * FROM tenants ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: tenants.csv

-- Franchises
COPY (
  SELECT * FROM franchises ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: franchises.csv

-- Profiles
COPY (
  SELECT * FROM profiles ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: profiles.csv

-- User Roles
COPY (
  SELECT * FROM user_roles ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: user_roles.csv

-- Currencies
COPY (
  SELECT * FROM currencies ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: currencies.csv

-- Continents
COPY (
  SELECT * FROM continents ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: continents.csv

-- Countries
COPY (
  SELECT * FROM countries ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: countries.csv

-- Cities
COPY (
  SELECT * FROM cities ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: cities.csv

-- Ports/Locations
COPY (
  SELECT * FROM ports_locations ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: ports_locations.csv

-- Service Types
COPY (
  SELECT * FROM service_types ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: service_types.csv

-- Service Type Mappings
COPY (
  SELECT * FROM service_type_mappings ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: service_type_mappings.csv

-- Cargo Types
COPY (
  SELECT * FROM cargo_types ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: cargo_types.csv

-- Package Categories
COPY (
  SELECT * FROM package_categories ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: package_categories.csv

-- Package Sizes
COPY (
  SELECT * FROM package_sizes ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: package_sizes.csv

-- Container Types
COPY (
  SELECT * FROM container_types ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: container_types.csv

-- Container Sizes
COPY (
  SELECT * FROM container_sizes ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: container_sizes.csv

-- Carriers
COPY (
  SELECT * FROM carriers ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: carriers.csv

-- Consignees
COPY (
  SELECT * FROM consignees ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: consignees.csv

-- Incoterms
COPY (
  SELECT * FROM incoterms ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: incoterms.csv

-- Vehicles
COPY (
  SELECT * FROM vehicles ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: vehicles.csv

-- Warehouses
COPY (
  SELECT * FROM warehouses ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: warehouses.csv

-- Charge Sides
COPY (
  SELECT * FROM charge_sides ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: charge_sides.csv

-- Charge Categories
COPY (
  SELECT * FROM charge_categories ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: charge_categories.csv

-- Charge Bases
COPY (
  SELECT * FROM charge_bases ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: charge_bases.csv
