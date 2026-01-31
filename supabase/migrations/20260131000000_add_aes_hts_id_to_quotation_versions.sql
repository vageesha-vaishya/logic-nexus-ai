-- Add aes_hts_id column to quotation_versions table
ALTER TABLE "public"."quotation_versions" 
ADD COLUMN "aes_hts_id" uuid REFERENCES "public"."aes_hts_codes"("id");

-- Create index for performance
CREATE INDEX "idx_quotation_versions_aes_hts_id" ON "public"."quotation_versions" ("aes_hts_id");

-- Add comment
COMMENT ON COLUMN "public"."quotation_versions"."aes_hts_id" IS 'Foreign key to AES HTS codes table for precise classification';
