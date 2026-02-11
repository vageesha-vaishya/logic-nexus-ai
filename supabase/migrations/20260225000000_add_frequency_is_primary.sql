ALTER TABLE "public"."quotation_version_options" 
ADD COLUMN IF NOT EXISTS "frequency" text,
ADD COLUMN IF NOT EXISTS "is_primary" boolean DEFAULT false;
