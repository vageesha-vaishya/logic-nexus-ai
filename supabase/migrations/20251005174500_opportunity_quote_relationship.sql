-- Opportunity ↔ Quote relationship, primary quote, and syncing
BEGIN;

-- Ensure quotes table has opportunity linkage and primary flag
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS opportunity_id UUID,
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;

-- Add foreign key for opportunity linkage if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.quotes'::regclass
      AND conname = 'quotes_opportunity_id_fkey'
  ) THEN
    ALTER TABLE public.quotes
      ADD CONSTRAINT quotes_opportunity_id_fkey
      FOREIGN KEY (opportunity_id)
      REFERENCES public.opportunities(id)
      ON DELETE SET NULL;
  END IF;
END$$;

-- Enforce only one primary quote per opportunity
CREATE UNIQUE INDEX IF NOT EXISTS uq_quotes_primary_per_opportunity
  ON public.quotes(opportunity_id)
  WHERE is_primary IS TRUE;

-- Add primary_quote_id on opportunities for fast access
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS primary_quote_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.opportunities'::regclass
      AND conname = 'opportunities_primary_quote_id_fkey'
  ) THEN
    ALTER TABLE public.opportunities
      ADD CONSTRAINT opportunities_primary_quote_id_fkey
      FOREIGN KEY (primary_quote_id)
      REFERENCES public.quotes(id)
      ON DELETE SET NULL;
  END IF;
END$$;

-- Function: when making a quote primary, demote any existing primary for the same opportunity
CREATE OR REPLACE FUNCTION public.ensure_single_primary_quote()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary IS TRUE AND NEW.opportunity_id IS NOT NULL THEN
    -- Demote other primary quotes for this opportunity
    UPDATE public.quotes q
      SET is_primary = FALSE
    WHERE q.opportunity_id = NEW.opportunity_id
      AND q.id <> NEW.id
      AND q.is_primary IS TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: update opportunity amount and primary_quote_id from the primary quote
CREATE OR REPLACE FUNCTION public.sync_opportunity_from_primary_quote()
RETURNS TRIGGER AS $$
DECLARE
  v_total NUMERIC;
  v_other_primary UUID;
BEGIN

  IF NEW.opportunity_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- If deleting a primary quote, clear or switch primary on the opportunity
    IF OLD.is_primary IS TRUE THEN
      SELECT q.id INTO v_other_primary
      FROM public.quotes q
      WHERE q.opportunity_id = OLD.opportunity_id
        AND q.is_primary IS TRUE
      ORDER BY q.updated_at DESC
      LIMIT 1;

      UPDATE public.opportunities o
        SET primary_quote_id = v_other_primary,
            amount = COALESCE((SELECT q.total_amount FROM public.quotes q WHERE q.id = v_other_primary), 0),
            updated_at = now()
      WHERE o.id = OLD.opportunity_id;
    END IF;
    RETURN OLD;
  END IF;

  -- Determine total from quotes table to avoid referencing absent columns
  SELECT COALESCE(q.total_amount, 0)
    INTO v_total
  FROM public.quotes q
  WHERE q.id = NEW.id;

  -- INSERT/UPDATE path
  IF NEW.is_primary IS TRUE THEN
    UPDATE public.opportunities o
      SET primary_quote_id = NEW.id,
          amount = COALESCE(v_total, 0),
          updated_at = now()
    WHERE o.id = NEW.opportunity_id;
  ELSIF NEW.is_primary IS FALSE THEN
    -- If this quote was primary and is now demoted, select another primary or clear
    IF OLD IS NOT NULL AND OLD.is_primary IS TRUE THEN
      SELECT q.id INTO v_other_primary
      FROM public.quotes q
      WHERE q.opportunity_id = NEW.opportunity_id
        AND q.is_primary IS TRUE
      ORDER BY q.updated_at DESC
      LIMIT 1;

      UPDATE public.opportunities o
        SET primary_quote_id = v_other_primary,
            amount = COALESCE((SELECT q.total_amount FROM public.quotes q WHERE q.id = v_other_primary), 0),
            updated_at = now()
      WHERE o.id = NEW.opportunity_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: ensure single primary on insert/update
DROP TRIGGER IF EXISTS trg_quotes_ensure_single_primary ON public.quotes;
CREATE TRIGGER trg_quotes_ensure_single_primary
  BEFORE INSERT OR UPDATE OF is_primary, opportunity_id ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_primary_quote();

-- Trigger: sync opportunity amount and primary quote on insert/update/delete
DROP TRIGGER IF EXISTS trg_quotes_sync_opportunity ON public.quotes;
CREATE TRIGGER trg_quotes_sync_opportunity
  AFTER INSERT OR UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_opportunity_from_primary_quote();

-- Recalculate quote totals when items change and cascade to opportunity via above trigger
CREATE OR REPLACE FUNCTION public.recalculate_quote_total_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_total NUMERIC;
  v_quote_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_quote_id := OLD.quote_id;
  ELSE
    v_quote_id := NEW.quote_id;
  END IF;

  -- Supports both schemas of quote_items
  SELECT COALESCE(SUM(COALESCE(qi.line_total, qi.total, 0)), 0)
    INTO v_total
  FROM public.quote_items qi
  WHERE qi.quote_id = v_quote_id;

  -- Always update total_amount
  UPDATE public.quotes q
    SET total_amount = v_total,
        updated_at = now()
  WHERE q.id = v_quote_id;

  -- Conditionally update total if the column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = 'total'
  ) THEN
    UPDATE public.quotes q
      SET total = v_total,
          updated_at = now()
    WHERE q.id = v_quote_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Triggers on quote_items to recalc totals
DROP TRIGGER IF EXISTS trg_quote_items_recalc_total_ins ON public.quote_items;
CREATE TRIGGER trg_quote_items_recalc_total_ins
  AFTER INSERT ON public.quote_items
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_quote_total_trigger();

DROP TRIGGER IF EXISTS trg_quote_items_recalc_total_upd ON public.quote_items;
CREATE TRIGGER trg_quote_items_recalc_total_upd
  AFTER UPDATE ON public.quote_items
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_quote_total_trigger();

DROP TRIGGER IF EXISTS trg_quote_items_recalc_total_del ON public.quote_items;
CREATE TRIGGER trg_quote_items_recalc_total_del
  AFTER DELETE ON public.quote_items
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_quote_total_trigger();

COMMIT;