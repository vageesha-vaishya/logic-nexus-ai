-- Link International Courier service type to the Courier transport mode
UPDATE service_types 
SET mode_id = (SELECT id FROM transport_modes WHERE code = 'courier')
WHERE code = 'international_courier' AND mode_id IS NULL;