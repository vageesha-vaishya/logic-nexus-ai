
ALTER TABLE "public"."quote_options" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'USD';
ALTER TABLE "public"."quote_options" ADD COLUMN IF NOT EXISTS "total_amount" numeric DEFAULT 0;
