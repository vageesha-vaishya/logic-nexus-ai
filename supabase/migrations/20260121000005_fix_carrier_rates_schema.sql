-- Rename customer_id to account_id in carrier_rates table
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'carrier_rates' AND column_name = 'customer_id') THEN
        ALTER TABLE carrier_rates RENAME COLUMN customer_id TO account_id;
    END IF;
END $$;
