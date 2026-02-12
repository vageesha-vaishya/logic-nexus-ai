DROP POLICY IF EXISTS quote_charges_read_alignment ON public.quote_charges;
DROP POLICY IF EXISTS quote_charges_read ON public.quote_charges;

CREATE POLICY quote_charges_read_alignment ON public.quote_charges FOR SELECT
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  OR
  EXISTS (
    SELECT 1
    FROM public.quotation_version_options qvo
    JOIN public.quotation_versions qv ON qv.id = qvo.quotation_version_id
    JOIN public.quotes q ON q.id = qv.quote_id
    WHERE qvo.id = quote_charges.quote_option_id
      AND (
        q.franchise_id = get_user_franchise_id(auth.uid())
        OR is_platform_admin(auth.uid())
      )
  )
);
