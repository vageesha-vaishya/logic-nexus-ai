
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'quote_items_legacy';

SELECT count(*) FROM quote_items_legacy;
