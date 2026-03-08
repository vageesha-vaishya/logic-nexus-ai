
SELECT 
  q.id as quote_id, 
  q.quote_number, 
  q.origin_port_id, 
  q.destination_port_id, 
  t.name as tenant_name
FROM quotes q
JOIN tenants t ON q.tenant_id = t.id
WHERE q.quote_number = 'QUO-MGL-MATRIX-TEST';

SELECT 
  qvo.option_name,
  qvo.total_amount,
  qvo.frequency,
  c.name as carrier_name,
  cs.code as container_code
FROM quotation_version_options qvo
JOIN quotation_versions qv ON qvo.quotation_version_id = qv.id
JOIN quotes q ON qv.quote_id = q.id
LEFT JOIN carriers c ON qvo.carrier_id = c.id
LEFT JOIN container_sizes cs ON qvo.container_size_id = cs.id
WHERE q.quote_number = 'QUO-MGL-MATRIX-TEST';
