-- RLS policies for quotation_versions to allow tenant-scoped access via parent quotes
ALTER TABLE public.quotation_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quotation_versions_read ON public.quotation_versions;
DROP POLICY IF EXISTS quotation_versions_manage ON public.quotation_versions;

-- Read policy: user can read versions of quotes they can access
CREATE POLICY quotation_versions_read
ON public.quotation_versions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quotation_versions.quote_id
      AND q.tenant_id = get_user_tenant_id(auth.uid())
  )
);

-- Manage policy: user can insert/update/delete versions of quotes they can access
CREATE POLICY quotation_versions_manage
ON public.quotation_versions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quotation_versions.quote_id
      AND q.tenant_id = get_user_tenant_id(auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quotation_versions.quote_id
      AND q.tenant_id = get_user_tenant_id(auth.uid())
  )
);
