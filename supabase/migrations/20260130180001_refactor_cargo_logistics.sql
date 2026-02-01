-- Add aes_hts_id column to cargo_details table
ALTER TABLE "public"."cargo_details" 
ADD COLUMN IF NOT EXISTS "aes_hts_id" uuid REFERENCES "public"."aes_hts_codes"("id");

-- Create index for performance
CREATE INDEX IF NOT EXISTS "idx_cargo_details_aes_hts_id" ON "public"."cargo_details" ("aes_hts_id");

-- Add comment
COMMENT ON COLUMN "public"."cargo_details"."aes_hts_id" IS 'Foreign key to AES HTS codes table for precise classification';
