-- Add parent_account_id column to accounts table
ALTER TABLE public.accounts
ADD COLUMN parent_account_id uuid;

-- Add foreign key constraint (self-referencing)
ALTER TABLE public.accounts
ADD CONSTRAINT fk_parent_account
FOREIGN KEY (parent_account_id)
REFERENCES public.accounts(id)
ON DELETE SET NULL;

-- Add check constraint to prevent self-reference
ALTER TABLE public.accounts
ADD CONSTRAINT chk_not_self_parent
CHECK (id != parent_account_id);

-- Add index for performance on parent lookups
CREATE INDEX idx_accounts_parent_id ON public.accounts(parent_account_id);

-- Add index for tenant + parent queries
CREATE INDEX idx_accounts_tenant_parent ON public.accounts(tenant_id, parent_account_id);