DO $$
DECLARE
  is_partitioned boolean;
  partition_start date;
  partition_end date;
  next_partition_end date;
  partition_name text;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'system_logs'
      AND c.relkind = 'p'
  )
  INTO is_partitioned;

  IF NOT is_partitioned THEN
    RETURN;
  END IF;

  EXECUTE '
    CREATE TABLE IF NOT EXISTS public.system_logs_default
    PARTITION OF public.system_logs DEFAULT
  ';

  partition_start := (date_trunc('month', now())::date - interval '2 months')::date;
  next_partition_end := (date_trunc('month', now())::date + interval '13 months')::date;

  WHILE partition_start < next_partition_end LOOP
    partition_end := (partition_start + interval '1 month')::date;
    partition_name := format(
      'system_logs_y%sm%s',
      to_char(partition_start, 'YYYY'),
      to_char(partition_start, 'MM')
    );

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.system_logs FOR VALUES FROM (%L) TO (%L)',
      partition_name,
      partition_start,
      partition_end
    );

    partition_start := partition_end;
  END LOOP;
END
$$;
