WITH seed_quote AS (
  SELECT
    q.id AS quote_id,
    q.tenant_id,
    q.current_version_id,
    q.quote_number,
    q.transport_mode,
    q.origin_port_id,
    q.destination_port_id,
    q.pickup_date,
    q.delivery_deadline,
    q.incoterms,
    q.billing_address,
    q.cargo_details,
    t.name AS tenant_name
  FROM public.quotes q
  JOIN public.tenants t ON t.id = q.tenant_id
  WHERE q.quote_number = 'QUO-260309-00001'
  ORDER BY q.updated_at DESC NULLS LAST, q.created_at DESC NULLS LAST
  LIMIT 1
)
SELECT
  sq.quote_id,
  sq.quote_number,
  sq.tenant_name,
  sq.transport_mode,
  sq.origin_port_id,
  sq.destination_port_id,
  sq.pickup_date,
  sq.delivery_deadline,
  sq.incoterms,
  (sq.billing_address ->> 'company') AS guest_company,
  (sq.billing_address ->> 'name') AS guest_name,
  (sq.billing_address ->> 'email') AS guest_email,
  (sq.billing_address ->> 'phone') AS guest_phone,
  (sq.billing_address -> 'billing_address' ->> 'street') AS billing_street,
  (sq.billing_address -> 'billing_address' ->> 'city') AS billing_city,
  (sq.billing_address -> 'billing_address' ->> 'country') AS billing_country,
  (sq.billing_address ->> 'tax_id') AS tax_id,
  (sq.billing_address ->> 'customer_po') AS customer_po,
  (sq.billing_address ->> 'vendor_ref') AS vendor_ref,
  (sq.billing_address ->> 'project_code') AS project_code,
  (sq.cargo_details ->> 'commodity') AS commodity,
  (sq.cargo_details -> 'commodity_details' ->> 'hts_code') AS hts_code,
  (sq.cargo_details -> 'commodity_details' ->> 'schedule_b') AS schedule_b,
  (sq.cargo_details -> 'commodity_details' ->> 'aes_hts_id') AS aes_hts_id,
  (sq.cargo_details -> 'temperature_range' ->> 'min_c') AS temperature_min_c,
  (sq.cargo_details -> 'temperature_range' ->> 'max_c') AS temperature_max_c,
  jsonb_array_length(COALESCE(sq.cargo_details -> 'container_combos', '[]'::jsonb)) AS container_combo_count
FROM seed_quote sq;

WITH seed_quote AS (
  SELECT id AS quote_id, tenant_id, current_version_id
  FROM public.quotes
  WHERE quote_number = 'QUO-260309-00001'
  ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
  LIMIT 1
),
option_counts AS (
  SELECT
    (SELECT COUNT(*) FROM public.rate_options ro JOIN seed_quote sq ON sq.quote_id = ro.quote_id WHERE ro.standalone_mode = true) AS rate_option_count,
    (SELECT COUNT(*) FROM public.quotation_version_options qvo JOIN seed_quote sq ON sq.current_version_id = qvo.quotation_version_id) AS qvo_count,
    (SELECT COUNT(*) FROM public.quotation_version_option_legs qvol WHERE qvol.quotation_version_option_id IN (
      SELECT qvo.id FROM public.quotation_version_options qvo JOIN seed_quote sq ON sq.current_version_id = qvo.quotation_version_id
    )) AS qvo_leg_count,
    (SELECT COUNT(*) FROM public.quote_charges qc WHERE qc.quote_option_id IN (
      SELECT qvo.id FROM public.quotation_version_options qvo JOIN seed_quote sq ON sq.current_version_id = qvo.quotation_version_id
    )) AS quote_charge_count,
    (SELECT COUNT(*) FROM public.leg_connections lc WHERE lc.rate_option_id IN (
      SELECT ro.id FROM public.rate_options ro JOIN seed_quote sq ON sq.quote_id = ro.quote_id
    )) AS leg_connection_count,
    (SELECT COUNT(*) FROM public.rate_charge_rows rr WHERE rr.rate_option_id IN (
      SELECT ro.id FROM public.rate_options ro JOIN seed_quote sq ON sq.quote_id = ro.quote_id
    )) AS rate_charge_row_count,
    (SELECT COUNT(*) FROM public.rate_charge_cells rc WHERE rc.charge_row_id IN (
      SELECT rr.id FROM public.rate_charge_rows rr WHERE rr.rate_option_id IN (
        SELECT ro.id FROM public.rate_options ro JOIN seed_quote sq ON sq.quote_id = ro.quote_id
      )
    )) AS rate_charge_cell_count
)
SELECT
  rate_option_count,
  qvo_count,
  qvo_leg_count,
  quote_charge_count,
  leg_connection_count,
  rate_charge_row_count,
  rate_charge_cell_count,
  (rate_option_count = 4) AS ok_rate_options,
  (qvo_count = 4) AS ok_qvo,
  (qvo_leg_count >= 8) AS ok_qvo_legs,
  (quote_charge_count >= 40) AS ok_quote_charges,
  (leg_connection_count >= 4) AS ok_leg_connections,
  (rate_charge_row_count >= 12) AS ok_charge_rows,
  (rate_charge_cell_count >= 24) AS ok_charge_cells
FROM option_counts;

WITH seed_quote AS (
  SELECT id AS quote_id, tenant_id, current_version_id
  FROM public.quotes
  WHERE quote_number = 'QUO-260309-00001'
  ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
  LIMIT 1
)
SELECT
  qvo.option_name,
  qvo.carrier_name,
  qvo.total_amount,
  qvo.total_transit_days,
  COUNT(DISTINCT qvol.id) AS leg_count,
  COUNT(DISTINCT qc.id) AS charge_count,
  MIN(qvol.mode) AS first_mode,
  MAX(qvol.mode) AS last_mode
FROM public.quotation_version_options qvo
JOIN seed_quote sq ON sq.current_version_id = qvo.quotation_version_id
LEFT JOIN public.quotation_version_option_legs qvol ON qvol.quotation_version_option_id = qvo.id
LEFT JOIN public.quote_charges qc ON qc.quote_option_id = qvo.id
GROUP BY qvo.id, qvo.option_name, qvo.carrier_name, qvo.total_amount, qvo.total_transit_days
ORDER BY qvo.option_name;
