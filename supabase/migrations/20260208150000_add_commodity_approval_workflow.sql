-- Add approval workflow fields to master_commodities
ALTER TABLE public.master_commodities
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approved_at timestamptz,
ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Add index for status filtering
CREATE INDEX IF NOT EXISTS idx_master_commodities_status ON public.master_commodities(status);

-- Update RLS policies to ensure proper access
-- (Assuming existing policies cover basic CRUD, we might want to restrict approval to admins later, 
-- but for now we rely on UI logic and potentially a trigger if strict enforcement is needed)

-- Comment on columns
COMMENT ON COLUMN public.master_commodities.status IS 'Approval status of the commodity: draft, pending_review, approved, rejected';
COMMENT ON COLUMN public.master_commodities.approved_by IS 'User who approved the commodity';
COMMENT ON COLUMN public.master_commodities.approved_at IS 'Timestamp when the commodity was approved';
