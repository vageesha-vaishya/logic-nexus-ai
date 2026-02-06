
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('shipment_cargo_configurations', 'shipment_containers')
ORDER BY table_name, column_name;
