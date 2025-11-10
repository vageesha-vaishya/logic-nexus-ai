-- Align RLS for quotation_version_option_legs with access rules used by options/versions/quotes
-- This resolves scenarios where users can create options (via franchise/tenant rules)
-- but are blocked creating legs due to stricter tenant-only leg policies.

DO $$
BEGIN
  -- Ensure RLS is enabled (idempotent)
  ALTER TABLE public.quotation_version_option_legs ENABLE ROW LEVEL SECURITY;

  -- Create a unified manage policy that allows actions when the parent option/version/quote
  -- is accessible by the current user through tenant membership OR franchise access OR platform admin.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quotation_version_option_legs'
      AND policyname = 'quotation_version_option_legs_manage_alignment'
  ) THEN
    CREATE POLICY quotation_version_option_legs_manage_alignment ON public.quotation_version_option_legs FOR ALL
    USING (
      EXISTS (
        SELECT 1
        FROM public.quotation_version_options qvo
        JOIN public.quotation_versions qv ON qv.id = qvo.quotation_version_id
        JOIN public.quotes q ON q.id = qv.quote_id
        WHERE qvo.id = quotation_version_option_legs.quotation_version_option_id
          AND (
            q.tenant_id = get_user_tenant_id(auth.uid())
            OR q.franchise_id = get_user_franchise_id(auth.uid())
            OR is_platform_admin(auth.uid())
          )
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.quotation_version_options qvo
        JOIN public.quotation_versions qv ON qv.id = qvo.quotation_version_id
        JOIN public.quotes q ON q.id = qv.quote_id
        WHERE qvo.id = quotation_version_option_legs.quotation_version_option_id
          AND (
            q.tenant_id = get_user_tenant_id(auth.uid())
            OR q.franchise_id = get_user_franchise_id(auth.uid())
            OR is_platform_admin(auth.uid())
          )
      )
    );
  END IF;

  -- Optional: read policy aligned to the same access surface (keeps existing policies intact)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quotation_version_option_legs'
      AND policyname = 'quotation_version_option_legs_read_alignment'
  ) THEN
    CREATE POLICY quotation_version_option_legs_read_alignment ON public.quotation_version_option_legs FOR SELECT
    USING (
      EXISTS (
        SELECT 1
        FROM public.quotation_version_options qvo
        JOIN public.quotation_versions qv ON qv.id = qvo.quotation_version_id
        JOIN public.quotes q ON q.id = qv.quote_id
        WHERE qvo.id = quotation_version_option_legs.quotation_version_option_id
          AND (
            q.tenant_id = get_user_tenant_id(auth.uid())
            OR q.franchise_id = get_user_franchise_id(auth.uid())
            OR is_platform_admin(auth.uid())
          )
      )
    );
  END IF;
END $$;