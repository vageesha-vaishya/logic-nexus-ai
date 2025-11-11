-- Export Quotes and Shipments Data
-- Run after CRM data

-- Services
COPY (
  SELECT * FROM services ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: services.csv

-- Carrier Rates
COPY (
  SELECT * FROM carrier_rates ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: carrier_rates.csv

-- Carrier Rate Charges
COPY (
  SELECT * FROM carrier_rate_charges ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: carrier_rate_charges.csv

-- Shipping Rates
COPY (
  SELECT * FROM shipping_rates ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: shipping_rates.csv

-- Quotes
COPY (
  SELECT * FROM quotes ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: quotes.csv

-- Quotation Versions
COPY (
  SELECT * FROM quotation_versions ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: quotation_versions.csv

-- Quotation Version Options
COPY (
  SELECT * FROM quotation_version_options ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: quotation_version_options.csv

-- Quote Legs
COPY (
  SELECT * FROM quote_legs ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: quote_legs.csv

-- Quote Charges
COPY (
  SELECT * FROM quote_charges ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: quote_charges.csv

-- Quote Packages
COPY (
  SELECT * FROM quote_packages ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: quote_packages.csv

-- Customer Selections
COPY (
  SELECT * FROM customer_selections ORDER BY selected_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: customer_selections.csv

-- Rate Calculations
COPY (
  SELECT * FROM rate_calculations ORDER BY calculated_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: rate_calculations.csv

-- Cargo Details
COPY (
  SELECT * FROM cargo_details ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: cargo_details.csv

-- Shipments
COPY (
  SELECT * FROM shipments ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: shipments.csv

-- Tracking Events
COPY (
  SELECT * FROM tracking_events ORDER BY event_timestamp
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: tracking_events.csv

-- Documents
COPY (
  SELECT * FROM documents ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: documents.csv
