-- Align quotation_version_options for composer usage
-- Make carrier_rate_id nullable and add totals columns used by UI

DO $$
BEGIN
  -- Drop NOT NULL on carrier_rate_id if present
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotation_version_options' AND column_name = 'carrier_rate_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.quotation_version_options
      ALTER COLUMN carrier_rate_id DROP NOT NULL;
  END IF;

  -- Add currency and totals columns if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotation_version_options' AND column_name = 'quote_currency_id'
  ) THEN
    ALTER TABLE public.quotation_version_options
      ADD COLUMN quote_currency_id uuid REFERENCES public.currencies(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotation_version_options' AND column_name = 'buy_subtotal'
  ) THEN
    ALTER TABLE public.quotation_version_options
      ADD COLUMN buy_subtotal numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotation_version_options' AND column_name = 'sell_subtotal'
  ) THEN
    ALTER TABLE public.quotation_version_options
      ADD COLUMN sell_subtotal numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotation_version_options' AND column_name = 'margin_amount'
  ) THEN
    ALTER TABLE public.quotation_version_options
      ADD COLUMN margin_amount numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotation_version_options' AND column_name = 'total_amount'
  ) THEN
    ALTER TABLE public.quotation_version_options
      ADD COLUMN total_amount numeric NOT NULL DEFAULT 0;
  END IF;
END $$;