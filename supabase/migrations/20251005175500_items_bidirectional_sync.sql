-- Bidirectional syncing: reflect opportunity_items changes back to primary quote_items
BEGIN;

CREATE OR REPLACE FUNCTION public.sync_quote_items_from_opportunity(p_opportunity_id UUID)
RETURNS VOID AS $$
DECLARE
  v_quote UUID;
BEGIN
  -- Determine primary quote for the opportunity
  SELECT primary_quote_id INTO v_quote
  FROM public.opportunities
  WHERE id = p_opportunity_id;

  IF v_quote IS NULL THEN
    -- Fallback to any quote marked primary
    SELECT q.id INTO v_quote
    FROM public.quotes q
    WHERE q.opportunity_id = p_opportunity_id AND q.is_primary = TRUE
    ORDER BY q.created_at DESC
    LIMIT 1;
  END IF;

  IF v_quote IS NULL THEN
    RETURN;
  END IF;

  -- Replace quote_items with opportunity_items snapshot
  DELETE FROM public.quote_items qi WHERE qi.quote_id = v_quote;

  INSERT INTO public.quote_items (
    quote_id, line_number, product_name, description, quantity,
    unit_price, discount_percent, discount_amount, tax_amount, line_total
  )
  SELECT v_quote, oi.line_number, oi.product_name, oi.description, oi.quantity,
         oi.unit_price, oi.discount_percent, oi.discount_amount, oi.tax_amount,
         COALESCE(oi.line_total, oi.quantity * oi.unit_price * (1 - COALESCE(oi.discount_percent,0)/100))
  FROM public.opportunity_items oi
  WHERE oi.opportunity_id = p_opportunity_id
  ORDER BY oi.line_number;

  -- Recalculate totals after syncing
  PERFORM public.recalculate_quote_total(v_quote);
END;
$$ LANGUAGE plpgsql;

-- Triggers on opportunity_items to sync to primary quote
DROP TRIGGER IF EXISTS trg_opp_items_sync_ins ON public.opportunity_items;
CREATE TRIGGER trg_opp_items_sync_ins
  AFTER INSERT ON public.opportunity_items
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_quote_items_from_opportunity(NEW.opportunity_id);

DROP TRIGGER IF EXISTS trg_opp_items_sync_upd ON public.opportunity_items;
CREATE TRIGGER trg_opp_items_sync_upd
  AFTER UPDATE ON public.opportunity_items
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_quote_items_from_opportunity(NEW.opportunity_id);

DROP TRIGGER IF EXISTS trg_opp_items_sync_del ON public.opportunity_items;
CREATE TRIGGER trg_opp_items_sync_del
  AFTER DELETE ON public.opportunity_items
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_quote_items_from_opportunity(OLD.opportunity_id);

COMMIT;