
SELECT 
    column_name, 
    data_type, 
    is_nullable 
FROM information_schema.columns 
WHERE table_name = 'quote_items_extension' AND table_schema = 'logistics';

SELECT 
    tc.constraint_name, 
    tc.constraint_type, 
    kcu.column_name 
FROM information_schema.table_constraints tc 
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name 
WHERE tc.table_name = 'quote_items_extension' AND tc.table_schema = 'logistics';
