-- Add use_enhanced_template feature flag to tenant_profile
ALTER TABLE public.tenant_profile 
ADD COLUMN IF NOT EXISTS use_enhanced_template BOOLEAN DEFAULT false;

-- Comment on column
COMMENT ON COLUMN public.tenant_profile.use_enhanced_template IS 'Feature flag to enable the enhanced quotation template system (Template Builder, Selector, etc.)';
