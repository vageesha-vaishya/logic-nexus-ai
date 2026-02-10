
ALTER TABLE "public"."quote_option_legs" ADD COLUMN IF NOT EXISTS "transport_mode" text;
ALTER TABLE "public"."quote_option_legs" ADD COLUMN IF NOT EXISTS "sequence_number" integer;
ALTER TABLE "public"."quote_option_legs" ADD COLUMN IF NOT EXISTS "origin_location_id" uuid REFERENCES public.ports_locations(id);
ALTER TABLE "public"."quote_option_legs" ADD COLUMN IF NOT EXISTS "destination_location_id" uuid REFERENCES public.ports_locations(id);
ALTER TABLE "public"."quote_option_legs" ADD COLUMN IF NOT EXISTS "carrier_id" uuid REFERENCES public.carriers(id);
ALTER TABLE "public"."quote_option_legs" ADD COLUMN IF NOT EXISTS "arrival_date" timestamptz;
ALTER TABLE "public"."quote_option_legs" ADD COLUMN IF NOT EXISTS "departure_date" timestamptz;
