-- RLS policies for quote_versions to allow tenant-scoped access via parent quotes
ALTER TABLE public.quote_versions ENABLE ROW LEVEL SECURITY;

-- Read policy: user can read versions of quotes they can access
CREATE POLICY quote_versions_read
ON public.quote_versions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_versions.quote_id
      AND q.tenant_id = get_user_tenant_id(auth.uid())
  )
);

-- Manage policy: user can insert/update/delete versions of quotes they can access
CREATE POLICY quote_versions_manage
ON public.quote_versions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_versions.quote_id
      AND q.tenant_id = get_user_tenant_id(auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_versions.quote_id
      AND q.tenant_id = get_user_tenant_id(auth.uid())
  )
);