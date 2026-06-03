-- Phase 7 UIM Step 9 Q5 — transaction-type translation.
--
-- Real prod audit:
--   AMRO movement_type values: receipt, issue, adjustment (3 across 92 rows)
--   UIM transaction_type CHECK already covers:
--     RECEIVE, MOVE, RESERVE, RELEASE, CONSUME, ADJUST, SCRAP, RETURN
--
-- Decision: no UIM enum extension needed. Just a case-folding +
-- mapping function used by slice 9e backfill.
--
-- Applied to prod 2026-06-03.

BEGIN;

CREATE OR REPLACE FUNCTION amro.map_txn_type_to_uim(p_amro_movement text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN CASE lower(coalesce(p_amro_movement, ''))
    WHEN 'receipt'    THEN 'RECEIVE'
    WHEN 'issue'      THEN 'CONSUME'
    WHEN 'adjustment' THEN 'ADJUST'
    WHEN 'scrap'      THEN 'SCRAP'
    WHEN 'return'     THEN 'RETURN'
    WHEN 'move'       THEN 'MOVE'
    WHEN 'reserve'    THEN 'RESERVE'
    WHEN 'release'    THEN 'RELEASE'
    ELSE 'ADJUST'  -- unrecognized value defaults to ADJUST
  END;
END;
$$;

COMMENT ON FUNCTION amro.map_txn_type_to_uim IS
  'Step 9 Q5: maps amro_stock_ledger_transactions.movement_type → uim_inventory_ledger.transaction_type. Used by slice 9e backfill. Unknown values default to ADJUST.';

COMMIT;
