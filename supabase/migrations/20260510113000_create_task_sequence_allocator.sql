-- DB-VERIFICATION: task-sequence-allocator-schema-overlap-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge

BEGIN;

CREATE TABLE IF NOT EXISTS public.task_number_counters (
  tenant_id uuid NOT NULL,
  yyyymm character varying(6) NOT NULL,
  last_value integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT task_number_counters_pkey PRIMARY KEY (tenant_id, yyyymm),
  CONSTRAINT task_number_counters_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants (id) ON DELETE CASCADE,
  CONSTRAINT task_number_counters_yyyymm_ck CHECK ((yyyymm)::text ~ '^[0-9]{6}$'::text),
  CONSTRAINT task_number_counters_last_value_ck CHECK (last_value >= 0)
);

CREATE OR REPLACE FUNCTION public.next_task_seq(p_tenant_id uuid, p_yyyymm text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_yyyymm text;
  v_seq integer;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'next_task_seq requires non-null p_tenant_id';
  END IF;

  v_yyyymm := trim(COALESCE(p_yyyymm, ''));
  IF v_yyyymm !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'next_task_seq requires p_yyyymm in YYYYMM format. Received: %', p_yyyymm;
  END IF;

  INSERT INTO public.task_number_counters (tenant_id, yyyymm, last_value)
  VALUES (p_tenant_id, v_yyyymm, 1)
  ON CONFLICT (tenant_id, yyyymm)
  DO UPDATE
    SET
      last_value = public.task_number_counters.last_value + 1,
      updated_at = now()
  RETURNING last_value INTO v_seq;

  RETURN v_seq;
END;
$$;

REVOKE ALL ON FUNCTION public.next_task_seq(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_task_seq(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_task_seq(uuid, text) TO service_role;

COMMIT;
