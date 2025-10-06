-- Opportunity items table and syncing from primary quote items
BEGIN;

-- Create opportunity_items table mirroring quote_items (commerce schema)
CREATE TABLE IF NOT EXISTS public.opportunity_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  discount_amount NUMERIC(15,2) DEFAULT 0,
  tax_amount NUMERIC(15,2) DEFAULT 0,
  line_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.opportunity_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_opportunity_items_opportunity_id ON public.opportunity_items(opportunity_id);

-- Minimal RLS policies aligned with quotes access
CREATE POLICY IF NOT EXISTS "Platform admins manage all opportunity items"
  ON public.opportunity_items FOR ALL
  USING (is_platform_admin(auth.uid()));

-- Function: sync opportunity_items from a primary quote's items
CREATE OR REPLACE FUNCTION public.sync_opportunity_items_from_quote(p_quote_id UUID)
RETURNS VOID AS $$
DECLARE
  v_opportunity UUID;
  v_is_primary BOOLEAN;
BEGIN
  SELECT q.opportunity_id, q.is_primary INTO v_opportunity, v_is_primary
  FROM public.quotes q
  WHERE q.id = p_quote_id;

  IF v_opportunity IS NULL OR v_is_primary IS NOT TRUE THEN
    RETURN;
  END IF;

  -- Replace all items for the opportunity with the quote's items
  DELETE FROM public.opportunity_items oi WHERE oi.opportunity_id = v_opportunity;

  INSERT INTO public.opportunity_items (
    opportunity_id, line_number, product_name, description, quantity,
    unit_price, discount_percent, discount_amount, tax_amount, line_total
  )
  SELECT v_opportunity, qi.line_number, qi.product_name, qi.description, qi.quantity,
         qi.unit_price, qi.discount_percent, qi.discount_amount, qi.tax_amount, 
         COALESCE(qi.line_total, qi.quantity * qi.unit_price * (1 - COALESCE(qi.discount_percent,0)/100))
  FROM public.quote_items qi
  WHERE qi.quote_id = p_quote_id
  ORDER BY qi.line_number;
END;
$$ LANGUAGE plpgsql;

-- Extend quote_items triggers to also run syncing after recalculation
CREATE OR REPLACE FUNCTION public.recalculate_and_sync_quote(p_quote_id UUID)
RETURNS VOID AS $$
BEGIN
  PERFORM public.recalculate_quote_total(p_quote_id);
  PERFORM public.sync_opportunity_items_from_quote(p_quote_id);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_quote_items_recalc_total_ins ON public.quote_items;
CREATE TRIGGER trg_quote_items_recalc_total_ins
  AFTER INSERT ON public.quote_items
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_and_sync_quote(NEW.quote_id);

DROP TRIGGER IF EXISTS trg_quote_items_recalc_total_upd ON public.quote_items;
CREATE TRIGGER trg_quote_items_recalc_total_upd
  AFTER UPDATE ON public.quote_items
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_and_sync_quote(NEW.quote_id);

DROP TRIGGER IF EXISTS trg_quote_items_recalc_total_del ON public.quote_items;
CREATE TRIGGER trg_quote_items_recalc_total_del
  AFTER DELETE ON public.quote_items
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_and_sync_quote(OLD.quote_id);

COMMIT;