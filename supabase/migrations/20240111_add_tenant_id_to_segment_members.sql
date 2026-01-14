-- Add tenant_id to segment_members
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'segment_members'
  ) THEN
    EXECUTE 'ALTER TABLE public.segment_members ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id)';

    EXECUTE 'UPDATE public.segment_members sm
      SET tenant_id = s.tenant_id
      FROM public.segments s
      WHERE sm.segment_id = s.id
        AND sm.tenant_id IS NULL';

    EXECUTE 'DELETE FROM public.segment_members WHERE tenant_id IS NULL';

    EXECUTE 'ALTER TABLE public.segment_members ALTER COLUMN tenant_id SET NOT NULL';

    EXECUTE 'ALTER TABLE public.segment_members ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "Users can view segment members via segment" ON public.segment_members';

    EXECUTE '' ||
      'CREATE POLICY "Users can view segment members based on tenant" ON public.segment_members ' ||
      'FOR SELECT ' ||
      'USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))';

    EXECUTE '' ||
      'CREATE POLICY "Users can insert segment members based on tenant" ON public.segment_members ' ||
      'FOR INSERT ' ||
      'WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))';

    EXECUTE '' ||
      'CREATE POLICY "Users can update segment members based on tenant" ON public.segment_members ' ||
      'FOR UPDATE ' ||
      'USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))';

    EXECUTE '' ||
      'CREATE POLICY "Users can delete segment members based on tenant" ON public.segment_members ' ||
      'FOR DELETE ' ||
      'USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))';
  END IF;
END $$;

