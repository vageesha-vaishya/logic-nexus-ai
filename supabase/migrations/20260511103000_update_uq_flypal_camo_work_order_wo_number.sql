BEGIN;

DO $migration$
DECLARE
  v_server_version_num int := current_setting('server_version_num')::int;
  v_supports_nulls_not_distinct boolean := false;
BEGIN
  IF to_regclass('flypal.flypal_camo_work_order') IS NULL THEN
    RAISE EXCEPTION 'Table flypal.flypal_camo_work_order does not exist';
  END IF;

  v_supports_nulls_not_distinct := v_server_version_num >= 150000;

  EXECUTE 'ALTER TABLE flypal.flypal_camo_work_order ' ||
          'DROP CONSTRAINT IF EXISTS uq_flypal_camo_work_order_wo_number';

  IF v_supports_nulls_not_distinct THEN
    EXECUTE 'ALTER TABLE flypal.flypal_camo_work_order ' ||
            'ADD CONSTRAINT uq_flypal_camo_work_order_wo_number ' ||
            'UNIQUE NULLS NOT DISTINCT (work_order_date, wo_number, reg_no, model, serial_no)';
  ELSE
    EXECUTE 'ALTER TABLE flypal.flypal_camo_work_order ' ||
            'ADD CONSTRAINT uq_flypal_camo_work_order_wo_number ' ||
            'UNIQUE (work_order_date, wo_number, reg_no, model, serial_no)';
  END IF;
END
$migration$;

COMMIT;
