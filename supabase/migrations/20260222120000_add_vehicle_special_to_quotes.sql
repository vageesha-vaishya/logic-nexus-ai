-- Add vehicle_type and special_handling columns to quotes table
ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS vehicle_type text,
ADD COLUMN IF NOT EXISTS special_handling text;
