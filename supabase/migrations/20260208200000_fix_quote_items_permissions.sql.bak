-- Grant usage on logistics schema
GRANT USAGE ON SCHEMA logistics TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA logistics TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA logistics TO authenticated;

-- Enable RLS on core and extension tables if not already enabled
ALTER TABLE public.quote_items_core ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics.quote_items_extension ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts/duplication
DROP POLICY IF EXISTS "Users can view quote items for accessible quotes" ON public.quote_items_core;
DROP POLICY IF EXISTS "Users can manage quote items for accessible quotes" ON public.quote_items_core;
DROP POLICY IF EXISTS "Users can view quote item extensions" ON logistics.quote_items_extension;
DROP POLICY IF EXISTS "Users can manage quote item extensions" ON logistics.quote_items_extension;

-- Create policies for quote_items_core
CREATE POLICY "Users can view quote items for accessible quotes"
ON public.quote_items_core FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_items_core.quote_id
    AND (
      q.franchise_id = get_user_franchise_id(auth.uid()) 
      OR q.owner_id = auth.uid()
      OR q.tenant_id = get_user_tenant_id(auth.uid())
    )
  )
);

CREATE POLICY "Users can manage quote items for accessible quotes"
ON public.quote_items_core FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_items_core.quote_id
    AND (
      q.franchise_id = get_user_franchise_id(auth.uid()) 
      OR q.owner_id = auth.uid()
      OR q.tenant_id = get_user_tenant_id(auth.uid())
    )
  )
);

-- Create policies for logistics.quote_items_extension
CREATE POLICY "Users can view quote item extensions"
ON logistics.quote_items_extension FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.quote_items_core c
    JOIN public.quotes q ON q.id = c.quote_id
    WHERE c.id = quote_items_extension.quote_item_id
    AND (
      q.franchise_id = get_user_franchise_id(auth.uid()) 
      OR q.owner_id = auth.uid()
      OR q.tenant_id = get_user_tenant_id(auth.uid())
    )
  )
);

CREATE POLICY "Users can manage quote item extensions"
ON logistics.quote_items_extension FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.quote_items_core c
    JOIN public.quotes q ON q.id = c.quote_id
    WHERE c.id = quote_items_extension.quote_item_id
    AND (
      q.franchise_id = get_user_franchise_id(auth.uid()) 
      OR q.owner_id = auth.uid()
      OR q.tenant_id = get_user_tenant_id(auth.uid())
    )
  )
);
