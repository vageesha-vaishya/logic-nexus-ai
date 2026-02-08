
-- Add pickup_date and delivery_deadline to quotes table
ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS pickup_date date,
ADD COLUMN IF NOT EXISTS delivery_deadline date;
