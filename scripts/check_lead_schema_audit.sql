WITH required_columns AS (
  SELECT *
  FROM (
    VALUES
      ('public','leads','company_name','character varying',255,false,NULL::text,NULL::text,NULL::text,NULL::text),
      ('public','leads','address_line1','character varying',255,true,NULL::text,NULL::text,NULL::text,NULL::text),
      ('public','leads','address_line2','character varying',255,true,NULL::text,NULL::text,NULL::text,NULL::text),
      ('public','leads','city','character varying',120,true,NULL::text,NULL::text,NULL::text,NULL::text),
      ('public','leads','state','character varying',120,true,NULL::text,NULL::text,NULL::text,NULL::text),
      ('public','leads','country','character varying',120,true,NULL::text,NULL::text,NULL::text,NULL::text),
      ('public','leads','website','character varying',2048,true,'leads_website_url_check'::text,NULL::text,NULL::text,NULL::text),
      ('public','leads','contact_name','character varying',255,false,NULL::text,NULL::text,NULL::text,NULL::text),
      ('public','leads','title','character varying',120,true,NULL::text,NULL::text,NULL::text,NULL::text),
      ('public','leads','email','character varying',320,true,'leads_email_rfc5322_check'::text,NULL::text,NULL::text,NULL::text),
      ('public','leads','job_position','character varying',120,true,NULL::text,NULL::text,NULL::text,NULL::text),
      ('public','leads','phone','character varying',40,true,'leads_phone_e164_check'::text,NULL::text,NULL::text,NULL::text),
      ('public','leads','mobile','character varying',40,true,'leads_mobile_e164_check'::text,NULL::text,NULL::text,NULL::text),
      ('public','leads','salesperson_id','uuid',NULL::int,true,NULL::text,'public'::text,'res_users'::text,'SET NULL'::text),
      ('public','leads','sales_team','character varying',255,true,NULL::text,'public'::text,'crm_team'::text,'SET NULL'::text),
      ('public','leads','priority','character varying',20,true,'leads_priority_check'::text,NULL::text,NULL::text,NULL::text)
  ) AS t(table_schema,table_name,column_name,data_type,max_length,is_nullable,check_constraint_name,fk_schema,fk_table,fk_delete_rule)
),
actual_columns AS (
  SELECT
    c.table_schema,
    c.table_name,
    c.column_name,
    c.data_type,
    c.character_maximum_length AS max_length,
    c.is_nullable = 'YES' AS is_nullable
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'leads'
),
actual_fk AS (
  SELECT
    kcu.table_schema,
    kcu.table_name,
    kcu.column_name,
    ccu.table_schema AS fk_schema,
    ccu.table_name AS fk_table,
    rc.delete_rule AS fk_delete_rule
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
   AND tc.table_schema = rc.constraint_schema
  JOIN information_schema.constraint_column_usage ccu
    ON rc.unique_constraint_name = ccu.constraint_name
   AND rc.unique_constraint_schema = ccu.constraint_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND tc.table_name = 'leads'
),
actual_checks AS (
  SELECT
    c.conname,
    pg_get_constraintdef(c.oid) AS definition
  FROM pg_constraint c
  JOIN pg_class cl ON cl.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = cl.relnamespace
  WHERE n.nspname = 'public'
    AND cl.relname = 'leads'
    AND c.contype = 'c'
),
audit_rows AS (
  SELECT
    r.column_name,
    CASE
      WHEN a.column_name IS NULL THEN 'missing_column'
      WHEN a.data_type <> r.data_type THEN 'type_mismatch'
      WHEN r.max_length IS NOT NULL AND COALESCE(a.max_length, -1) <> r.max_length THEN 'length_mismatch'
      WHEN a.is_nullable <> r.is_nullable THEN 'nullability_mismatch'
      WHEN r.fk_table IS NOT NULL
           AND NOT EXISTS (
             SELECT 1
             FROM actual_fk f
             WHERE f.column_name = r.column_name
               AND f.fk_schema = r.fk_schema
               AND f.fk_table = r.fk_table
               AND f.fk_delete_rule = r.fk_delete_rule
           ) THEN 'fk_mismatch'
      WHEN r.check_constraint_name IS NOT NULL
           AND NOT EXISTS (
             SELECT 1
             FROM actual_checks ck
             WHERE ck.conname = r.check_constraint_name
           ) THEN 'missing_check'
      ELSE 'ok'
    END AS status,
    a.data_type AS actual_data_type,
    a.max_length AS actual_max_length,
    a.is_nullable AS actual_is_nullable,
    r.data_type AS required_data_type,
    r.max_length AS required_max_length,
    r.is_nullable AS required_is_nullable,
    r.fk_table AS required_fk_table,
    r.fk_delete_rule AS required_fk_delete_rule,
    r.check_constraint_name AS required_check_constraint
  FROM required_columns r
  LEFT JOIN actual_columns a
    ON a.table_schema = r.table_schema
   AND a.table_name = r.table_name
   AND a.column_name = r.column_name
)
SELECT
  column_name,
  status,
  actual_data_type,
  actual_max_length,
  actual_is_nullable,
  required_data_type,
  required_max_length,
  required_is_nullable,
  required_fk_table,
  required_fk_delete_rule,
  required_check_constraint
FROM audit_rows
ORDER BY
  CASE status WHEN 'ok' THEN 1 ELSE 0 END,
  column_name;

SELECT
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'lead_tag_rel'
    ) THEN 'present'
    ELSE 'missing'
  END AS lead_tag_rel_status,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'crm'
        AND table_name = 'tag'
    ) THEN 'present'
    ELSE 'missing'
  END AS crm_tag_status,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
       AND tc.table_schema = rc.constraint_schema
      JOIN information_schema.constraint_column_usage ccu
        ON rc.unique_constraint_name = ccu.constraint_name
       AND rc.unique_constraint_schema = ccu.constraint_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = 'lead_tag_rel'
        AND kcu.column_name = 'lead_id'
        AND ccu.table_schema = 'public'
        AND ccu.table_name = 'leads'
    ) THEN 'present'
    ELSE 'missing'
  END AS lead_tag_rel_lead_fk_status,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
       AND tc.table_schema = rc.constraint_schema
      JOIN information_schema.constraint_column_usage ccu
        ON rc.unique_constraint_name = ccu.constraint_name
       AND rc.unique_constraint_schema = ccu.constraint_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = 'lead_tag_rel'
        AND kcu.column_name = 'tag_id'
        AND ccu.table_schema = 'crm'
        AND ccu.table_name = 'tag'
    ) THEN 'present'
    ELSE 'missing'
  END AS lead_tag_rel_tag_fk_status;
