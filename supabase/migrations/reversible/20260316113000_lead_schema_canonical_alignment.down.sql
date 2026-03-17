BEGIN;

DROP TRIGGER IF EXISTS trg_leads_normalize_e164_fields ON public.leads;
DROP FUNCTION IF EXISTS public.leads_normalize_e164_fields();
DROP FUNCTION IF EXISTS public.normalize_e164_phone(TEXT);

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_phone_e164_check;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_mobile_e164_check;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_email_rfc5322_check;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_website_url_check;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_sales_team_fkey;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_salesperson_id_fkey;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_priority_check;

ALTER TABLE public.leads
ALTER COLUMN company_name DROP NOT NULL,
ALTER COLUMN contact_name DROP NOT NULL,
ALTER COLUMN company_name TYPE TEXT,
ALTER COLUMN address_line1 TYPE TEXT,
ALTER COLUMN address_line2 TYPE TEXT,
ALTER COLUMN city TYPE TEXT,
ALTER COLUMN state TYPE TEXT,
ALTER COLUMN country TYPE TEXT,
ALTER COLUMN website TYPE TEXT,
ALTER COLUMN contact_name TYPE TEXT,
ALTER COLUMN title TYPE TEXT,
ALTER COLUMN email TYPE TEXT,
ALTER COLUMN job_position TYPE TEXT,
ALTER COLUMN phone TYPE TEXT,
ALTER COLUMN mobile TYPE TEXT,
ALTER COLUMN sales_team TYPE TEXT,
ALTER COLUMN priority TYPE TEXT,
ALTER COLUMN priority DROP DEFAULT;

UPDATE public.leads l
SET sales_team = t.name
FROM public.crm_team t
WHERE l.sales_team IS NOT NULL
  AND l.sales_team = t.id;

ALTER TABLE public.leads ADD CONSTRAINT leads_salesperson_id_fkey
  FOREIGN KEY (salesperson_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

UPDATE public.leads
SET priority = CASE
  WHEN priority = 'urgent' THEN 'critical'
  WHEN priority IN ('low', 'medium', 'high', 'critical') THEN priority
  ELSE 'medium'
END;

ALTER TABLE public.leads ADD CONSTRAINT leads_priority_check
  CHECK (priority IN ('low', 'medium', 'high', 'critical'));

DROP INDEX IF EXISTS public.idx_lead_tag_rel_tag_id;
DROP INDEX IF EXISTS public.idx_leads_sales_team;
DROP INDEX IF EXISTS public.idx_leads_priority;
DROP INDEX IF EXISTS public.idx_leads_salesperson_id;
DROP INDEX IF EXISTS public.idx_leads_company_name;
DROP INDEX IF EXISTS public.idx_leads_contact_name;
DROP INDEX IF EXISTS public.uq_crm_team_tenant_name;
DROP INDEX IF EXISTS crm.uq_crm_tag_tenant_name;

DROP TABLE IF EXISTS public.lead_tag_rel;
DROP TABLE IF EXISTS crm.tag;
DROP TABLE IF EXISTS public.crm_team;
DROP TABLE IF EXISTS public.res_users;
DROP SCHEMA IF EXISTS crm;

COMMIT;
