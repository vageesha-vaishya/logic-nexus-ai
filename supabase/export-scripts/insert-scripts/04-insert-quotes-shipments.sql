-- ==========================================
-- PHASE 4: QUOTES & SHIPMENTS INSERT STATEMENTS
-- ==========================================
-- Execute this after Phase 3 (CRM data)
-- Depends on: services, carriers, opportunities, accounts, contacts

-- ==========================================
-- Carrier Rates
-- ==========================================
SELECT 'INSERT INTO carrier_rates (id, tenant_id, carrier_id, service_type, origin, destination, valid_from, valid_to, rate_type, base_rate, currency, min_charge, transit_days, notes, is_active, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L)',
      id, tenant_id, carrier_id, service_type, origin, destination, valid_from, valid_to, rate_type, base_rate, currency, min_charge, transit_days, notes, is_active, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM carrier_rates
WHERE EXISTS (SELECT 1 FROM carrier_rates LIMIT 1);

-- ==========================================
-- Carrier Rate Charges
-- ==========================================
SELECT 'INSERT INTO carrier_rate_charges (id, tenant_id, carrier_rate_id, charge_type, basis, quantity, amount, currency, notes, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L)',
      id, tenant_id, carrier_rate_id, charge_type, basis, quantity, amount, currency, notes, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM carrier_rate_charges
WHERE EXISTS (SELECT 1 FROM carrier_rate_charges LIMIT 1);

-- ==========================================
-- Shipping Rates
-- ==========================================
SELECT 'INSERT INTO shipping_rates (id, tenant_id, shipment_type, origin_country, origin_zone, destination_country, destination_zone, service_level, min_weight_kg, max_weight_kg, rate_per_kg, base_rate, currency, effective_from, effective_to, is_active, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L)',
      id, tenant_id, shipment_type, origin_country, origin_zone, destination_country, destination_zone, service_level, min_weight_kg, max_weight_kg, rate_per_kg, base_rate, currency, effective_from, effective_to, is_active, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM shipping_rates
WHERE EXISTS (SELECT 1 FROM shipping_rates LIMIT 1);

-- ==========================================
-- Quotes
-- ==========================================
SELECT 'INSERT INTO quotes (id, tenant_id, franchise_id, quote_number, title, description, status, opportunity_id, account_id, contact_id, owner_id, valid_until, subtotal, discount_amount, discount_percent, tax_amount, tax_percent, shipping_amount, total_amount, currency, billing_address, shipping_address, terms_conditions, notes, carrier_id, service_id, consignee_id, origin_port_id, destination_port_id, origin_location, destination_location, cargo_details, incoterms, incoterm_id, service_type_id, cost_price, sell_price, margin_amount, margin_percentage, additional_costs, special_handling, regulatory_data, compliance_status, payment_terms, created_by, created_at, updated_at, accepted_at, rejected_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L::jsonb, %L::jsonb, %L, %L, %L, %L, %L, %L, %L, %L::jsonb, %L::jsonb, %L::jsonb, %L, %L, %L, %L, %L, %L, %L, %L::jsonb, %L::jsonb, %L::jsonb, %L, %L, %L, %L, %L, %L, %L)',
      id, tenant_id, franchise_id, quote_number, title, description, status, opportunity_id, account_id, contact_id, owner_id, valid_until, subtotal, discount_amount, discount_percent, tax_amount, tax_percent, shipping_amount, total_amount, currency, billing_address::text, shipping_address::text, terms_conditions, notes, carrier_id, service_id, consignee_id, origin_port_id, destination_port_id, origin_location::text, destination_location::text, cargo_details::text, incoterms, incoterm_id, service_type_id, cost_price, sell_price, margin_amount, margin_percentage, additional_costs::text, special_handling::text, regulatory_data::text, compliance_status, payment_terms, created_by, created_at, updated_at, accepted_at, rejected_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM quotes
WHERE EXISTS (SELECT 1 FROM quotes LIMIT 1);

-- ==========================================
-- Quotation Versions
-- ==========================================
SELECT 'INSERT INTO quotation_versions (id, tenant_id, quote_id, version_number, version_notes, created_by, created_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L)',
      id, tenant_id, quote_id, version_number, version_notes, created_by, created_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM quotation_versions
WHERE EXISTS (SELECT 1 FROM quotation_versions LIMIT 1);

-- ==========================================
-- Quotation Version Options
-- ==========================================
SELECT 'INSERT INTO quotation_version_options (id, tenant_id, quotation_version_id, option_name, total_cost, total_price, margin, is_selected, created_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L, %L, %L)',
      id, tenant_id, quotation_version_id, option_name, total_cost, total_price, margin, is_selected, created_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM quotation_version_options
WHERE EXISTS (SELECT 1 FROM quotation_version_options LIMIT 1);

-- ==========================================
-- Quote Legs
-- ==========================================
SELECT 'INSERT INTO quote_legs (id, tenant_id, quote_option_id, leg_number, mode, carrier_id, origin, destination, estimated_departure, estimated_arrival, created_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L)',
      id, tenant_id, quote_option_id, leg_number, mode, carrier_id, origin, destination, estimated_departure, estimated_arrival, created_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM quote_legs
WHERE EXISTS (SELECT 1 FROM quote_legs LIMIT 1);

-- ==========================================
-- Quote Charges
-- ==========================================
SELECT 'INSERT INTO quote_charges (id, tenant_id, quote_option_id, leg_id, charge_side_id, category_id, basis_id, unit, quantity, rate, amount, currency_id, note, sort_order, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L)',
      id, tenant_id, quote_option_id, leg_id, charge_side_id, category_id, basis_id, unit, quantity, rate, amount, currency_id, note, sort_order, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM quote_charges
WHERE EXISTS (SELECT 1 FROM quote_charges LIMIT 1);

-- ==========================================
-- Quote Packages
-- ==========================================
SELECT 'INSERT INTO quote_packages (id, tenant_id, quote_option_id, package_type, quantity, weight, volume, dimensions, description, created_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L, %L::jsonb, %L, %L)',
      id, tenant_id, quote_option_id, package_type, quantity, weight, volume, dimensions::text, description, created_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM quote_packages
WHERE EXISTS (SELECT 1 FROM quote_packages LIMIT 1);

-- ==========================================
-- Customer Selections
-- ==========================================
SELECT 'INSERT INTO customer_selections (id, tenant_id, quote_id, quotation_version_id, quotation_version_option_id, reason, selected_by, selected_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L, %L)',
      id, tenant_id, quote_id, quotation_version_id, quotation_version_option_id, reason, selected_by, selected_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM customer_selections
WHERE EXISTS (SELECT 1 FROM customer_selections LIMIT 1);

-- ==========================================
-- Rate Calculations
-- ==========================================
SELECT 'INSERT INTO rate_calculations (id, quote_id, service_id, carrier_rate_id, calculation_breakdown, applied_surcharges, applied_discounts, final_rate, calculated_at, calculated_by) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L::jsonb, %L::jsonb, %L::jsonb, %L, %L, %L)',
      id, quote_id, service_id, carrier_rate_id, calculation_breakdown::text, applied_surcharges::text, applied_discounts::text, final_rate, calculated_at, calculated_by
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM rate_calculations
WHERE EXISTS (SELECT 1 FROM rate_calculations LIMIT 1);

-- ==========================================
-- Shipments
-- ==========================================
SELECT 'INSERT INTO shipments (id, tenant_id, franchise_id, shipment_number, quote_id, account_id, contact_id, status, shipment_type, carrier_id, service_id, origin_location, destination_location, estimated_departure, estimated_arrival, actual_departure, actual_arrival, total_weight_kg, total_volume_cbm, insurance_value, customs_value, currency, tracking_number, awb_number, notes, owner_id, created_by, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L::jsonb, %L::jsonb, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L)',
      id, tenant_id, franchise_id, shipment_number, quote_id, account_id, contact_id, status, shipment_type, carrier_id, service_id, origin_location::text, destination_location::text, estimated_departure, estimated_arrival, actual_departure, actual_arrival, total_weight_kg, total_volume_cbm, insurance_value, customs_value, currency, tracking_number, awb_number, notes, owner_id, created_by, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM shipments
WHERE EXISTS (SELECT 1 FROM shipments LIMIT 1);

-- ==========================================
-- Cargo Details
-- ==========================================
SELECT 'INSERT INTO cargo_details (id, tenant_id, service_id, service_type, cargo_type_id, commodity_description, hs_code, weight_kg, volume_cbm, dimensions_cm, value_amount, value_currency, is_hazardous, hazmat_un_number, hazmat_class, temperature_controlled, temperature_range, special_requirements, notes, created_by, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L, %L, %L, %L::jsonb, %L, %L, %L, %L, %L, %L, %L::jsonb, %L, %L, %L, %L, %L)',
      id, tenant_id, service_id, service_type, cargo_type_id, commodity_description, hs_code, weight_kg, volume_cbm, dimensions_cm::text, value_amount, value_currency, is_hazardous, hazmat_un_number, hazmat_class, temperature_controlled, temperature_range::text, special_requirements, notes, created_by, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM cargo_details
WHERE EXISTS (SELECT 1 FROM cargo_details LIMIT 1);

-- ==========================================
-- Tracking Events
-- ==========================================
SELECT 'INSERT INTO tracking_events (id, shipment_id, event_timestamp, event_type, location, status, description, created_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L, %L)',
      id, shipment_id, event_timestamp, event_type, location, status, description, created_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM tracking_events
WHERE EXISTS (SELECT 1 FROM tracking_events LIMIT 1);
