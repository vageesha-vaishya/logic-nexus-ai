
ALTER TABLE "public"."quote_options" ADD COLUMN IF NOT EXISTS "is_primary" boolean DEFAULT false;
ALTER TABLE "public"."quote_options" ADD COLUMN IF NOT EXISTS "transport_mode" text;
