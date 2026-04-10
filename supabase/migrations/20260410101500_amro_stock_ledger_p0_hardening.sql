BEGIN;

ALTER TABLE public.amro_stock_ledger_transactions
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS is_voided boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS void_reason text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_amro_stock_ledger_txn_tenant_idempotency
  ON public.amro_stock_ledger_transactions (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_amro_stock_ledger_txn_tenant_voided
  ON public.amro_stock_ledger_transactions (tenant_id, is_voided, effective_at DESC);

CREATE OR REPLACE FUNCTION public.amro_stock_ledger_post_transaction(
  p_tenant_id uuid,
  p_franchise_id uuid,
  p_user_id uuid,
  p_part_inventory_id uuid,
  p_movement_type text,
  p_quantity_delta numeric,
  p_unit_cost numeric,
  p_currency text,
  p_effective_at timestamptz,
  p_source_module text,
  p_source_reference text,
  p_notes text,
  p_metadata jsonb,
  p_valuation_method text,
  p_idempotency_key text
)
RETURNS public.amro_stock_ledger_transactions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inventory public.parts_inventory%ROWTYPE;
  v_existing public.amro_stock_ledger_transactions%ROWTYPE;
  v_result public.amro_stock_ledger_transactions%ROWTYPE;
  v_on_hand numeric(18,6);
  v_reserved numeric(18,6);
  v_available numeric(18,6);
BEGIN
  IF p_quantity_delta = 0 THEN
    RAISE EXCEPTION 'quantity_delta cannot be zero';
  END IF;

  IF p_movement_type NOT IN ('receipt','issue','consume','reserve','release','adjustment','transfer_in','transfer_out','return') THEN
    RAISE EXCEPTION 'Invalid movement_type: %', p_movement_type;
  END IF;

  IF p_idempotency_key IS NOT NULL AND btrim(p_idempotency_key) <> '' THEN
    SELECT * INTO v_existing
    FROM public.amro_stock_ledger_transactions
    WHERE tenant_id = p_tenant_id
      AND idempotency_key = p_idempotency_key
    LIMIT 1;
    IF FOUND THEN
      RETURN v_existing;
    END IF;
  END IF;

  SELECT * INTO v_inventory
  FROM public.parts_inventory
  WHERE tenant_id = p_tenant_id
    AND id = p_part_inventory_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid SKU / part_inventory_id: %', p_part_inventory_id;
  END IF;

  v_on_hand := COALESCE(v_inventory.quantity_on_hand, 0);
  v_reserved := COALESCE(v_inventory.quantity_reserved, 0);

  IF p_movement_type = 'reserve' THEN
    v_reserved := v_reserved + p_quantity_delta;
  ELSIF p_movement_type = 'release' THEN
    v_reserved := v_reserved - ABS(p_quantity_delta);
  ELSE
    v_on_hand := v_on_hand + p_quantity_delta;
  END IF;

  v_available := v_on_hand - v_reserved;

  IF v_on_hand < 0 OR v_reserved < 0 OR v_available < 0 THEN
    RAISE EXCEPTION 'Insufficient stock for transaction: on_hand=%, reserved=%, available=%', v_on_hand, v_reserved, v_available;
  END IF;

  UPDATE public.parts_inventory
  SET quantity_on_hand = v_on_hand,
      quantity_reserved = v_reserved,
      quantity_available = v_available,
      updated_at = now()
  WHERE id = v_inventory.id
    AND tenant_id = p_tenant_id;

  INSERT INTO public.amro_stock_ledger_transactions (
    tenant_id, franchise_id, part_inventory_id, movement_type, valuation_method,
    quantity_delta, balance_after, unit_cost, currency, effective_at,
    source_module, source_reference, notes, metadata, created_by, updated_by,
    idempotency_key
  ) VALUES (
    p_tenant_id, p_franchise_id, p_part_inventory_id, p_movement_type,
    COALESCE(NULLIF(p_valuation_method, ''), 'weighted_average'),
    p_quantity_delta, v_available, GREATEST(COALESCE(p_unit_cost, 0), 0),
    COALESCE(NULLIF(p_currency, ''), 'USD'),
    COALESCE(p_effective_at, now()), p_source_module, p_source_reference,
    p_notes, COALESCE(p_metadata, '{}'::jsonb), p_user_id, p_user_id,
    NULLIF(btrim(COALESCE(p_idempotency_key, '')), '')
  )
  RETURNING * INTO v_result;

  INSERT INTO public.amro_stock_audit_timeline (
    tenant_id, franchise_id, actor_user_id, event_type, event_category, reference_id,
    event_payload, immutable_hash
  ) VALUES (
    p_tenant_id, p_franchise_id, p_user_id, 'stock_ledger.transaction.posted',
    'stock-ledger', v_result.id::text,
    jsonb_build_object(
      'movement_type', v_result.movement_type,
      'quantity_delta', v_result.quantity_delta,
      'part_inventory_id', v_result.part_inventory_id,
      'idempotency_key', v_result.idempotency_key
    ),
    encode(digest(
      concat_ws('|', p_tenant_id::text, v_result.id::text, v_result.movement_type, v_result.quantity_delta::text, now()::text),
      'sha256'
    ), 'hex')
  );

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.amro_stock_ledger_void_transaction(
  p_tenant_id uuid,
  p_franchise_id uuid,
  p_user_id uuid,
  p_transaction_id uuid,
  p_reason text
)
RETURNS public.amro_stock_ledger_transactions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_original public.amro_stock_ledger_transactions%ROWTYPE;
  v_reverse public.amro_stock_ledger_transactions%ROWTYPE;
BEGIN
  SELECT * INTO v_original
  FROM public.amro_stock_ledger_transactions
  WHERE tenant_id = p_tenant_id
    AND id = p_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found: %', p_transaction_id;
  END IF;
  IF v_original.is_voided THEN
    RAISE EXCEPTION 'Transaction already voided: %', p_transaction_id;
  END IF;

  v_reverse := public.amro_stock_ledger_post_transaction(
    p_tenant_id,
    p_franchise_id,
    p_user_id,
    v_original.part_inventory_id,
    'adjustment',
    -1 * v_original.quantity_delta,
    v_original.unit_cost,
    v_original.currency,
    now(),
    'stock_ledger_void',
    concat('void:', v_original.id::text),
    COALESCE(NULLIF(p_reason, ''), 'Transaction voided'),
    jsonb_build_object('reversal_of', v_original.id::text),
    v_original.valuation_method,
    concat('void-', v_original.id::text)
  );

  UPDATE public.amro_stock_ledger_transactions
  SET is_voided = true,
      voided_at = now(),
      voided_by = p_user_id,
      void_reason = COALESCE(NULLIF(p_reason, ''), 'Transaction voided'),
      updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND id = p_transaction_id;

  RETURN v_reverse;
END;
$$;

COMMIT;
