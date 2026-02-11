-- Add schedule details to quotation_version_option_legs
ALTER TABLE "public"."quotation_version_option_legs"
ADD COLUMN IF NOT EXISTS "flight_number" text,
ADD COLUMN IF NOT EXISTS "departure_date" timestamp with time zone,
ADD COLUMN IF NOT EXISTS "arrival_date" timestamp with time zone;

-- Ensure voyage_number exists (it was in previous migrations but good to be safe)
ALTER TABLE "public"."quotation_version_option_legs"
ADD COLUMN IF NOT EXISTS "voyage_number" text;
