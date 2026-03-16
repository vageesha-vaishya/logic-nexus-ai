BEGIN;

CREATE SCHEMA IF NOT EXISTS crm;

CREATE TABLE IF NOT EXISTS public.res_users (
  id UUID PRIMARY KEY,
  profile_id UUID UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT res_users_id_profiles_fkey FOREIGN KEY (id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

INSERT INTO public.res_users (id, profile_id)
SELECT p.id, p.id
FROM public.profiles p
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.crm_team (
  id VARCHAR(255) PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_team_tenant_name
  ON public.crm_team (tenant_id, lower(name));

CREATE TABLE IF NOT EXISTS crm.tag (
  id VARCHAR(255) PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_tag_tenant_name
  ON crm.tag (tenant_id, lower(name));

CREATE TABLE IF NOT EXISTS public.lead_tag_rel (
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tag_id VARCHAR(255) NOT NULL REFERENCES crm.tag(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (lead_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_tag_rel_tag_id ON public.lead_tag_rel(tag_id);

ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS company_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS address_line1 VARCHAR(255),
ADD COLUMN IF NOT EXISTS address_line2 VARCHAR(255),
ADD COLUMN IF NOT EXISTS city VARCHAR(120),
ADD COLUMN IF NOT EXISTS state VARCHAR(120),
ADD COLUMN IF NOT EXISTS country VARCHAR(120),
ADD COLUMN IF NOT EXISTS website VARCHAR(2048),
ADD COLUMN IF NOT EXISTS contact_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS title VARCHAR(120),
ADD COLUMN IF NOT EXISTS email VARCHAR(320),
ADD COLUMN IF NOT EXISTS job_position VARCHAR(120),
ADD COLUMN IF NOT EXISTS phone VARCHAR(40),
ADD COLUMN IF NOT EXISTS mobile VARCHAR(40),
ADD COLUMN IF NOT EXISTS salesperson_id UUID,
ADD COLUMN IF NOT EXISTS sales_team VARCHAR(255),
ADD COLUMN IF NOT EXISTS priority VARCHAR(20);

UPDATE public.leads
SET company_name = company
WHERE company_name IS NULL
  AND company IS NOT NULL;

UPDATE public.leads
SET contact_name = NULLIF(trim(concat_ws(' ', first_name, last_name)), '')
WHERE contact_name IS NULL;

UPDATE public.leads
SET job_position = title
WHERE job_position IS NULL
  AND title IS NOT NULL;

UPDATE public.leads
SET salesperson_id = owner_id
WHERE salesperson_id IS NULL
  AND owner_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.res_users ru WHERE ru.id = owner_id);

UPDATE public.leads
SET priority = CASE
  WHEN priority = 'critical' THEN 'urgent'
  WHEN priority NOT IN ('low', 'medium', 'high', 'urgent') THEN 'medium'
  WHEN priority IS NULL THEN 'medium'
  ELSE priority
END;

UPDATE public.leads
SET
  company_name = LEFT(company_name, 255),
  address_line1 = LEFT(address_line1, 255),
  address_line2 = LEFT(address_line2, 255),
  city = LEFT(city, 120),
  state = LEFT(state, 120),
  country = LEFT(country, 120),
  website = LEFT(website, 2048),
  contact_name = LEFT(contact_name, 255),
  title = LEFT(title, 120),
  email = LEFT(email, 320),
  job_position = LEFT(job_position, 120),
  phone = LEFT(phone, 40),
  mobile = LEFT(mobile, 40),
  sales_team = LEFT(sales_team, 255),
  priority = LEFT(priority, 20)
WHERE
  (company_name IS NOT NULL AND char_length(company_name) > 255)
  OR (address_line1 IS NOT NULL AND char_length(address_line1) > 255)
  OR (address_line2 IS NOT NULL AND char_length(address_line2) > 255)
  OR (city IS NOT NULL AND char_length(city) > 120)
  OR (state IS NOT NULL AND char_length(state) > 120)
  OR (country IS NOT NULL AND char_length(country) > 120)
  OR (website IS NOT NULL AND char_length(website) > 2048)
  OR (contact_name IS NOT NULL AND char_length(contact_name) > 255)
  OR (title IS NOT NULL AND char_length(title) > 120)
  OR (email IS NOT NULL AND char_length(email) > 320)
  OR (job_position IS NOT NULL AND char_length(job_position) > 120)
  OR (phone IS NOT NULL AND char_length(phone) > 40)
  OR (mobile IS NOT NULL AND char_length(mobile) > 40)
  OR (sales_team IS NOT NULL AND char_length(sales_team) > 255)
  OR (priority IS NOT NULL AND char_length(priority) > 20);

UPDATE public.leads
SET company_name = COALESCE(
  NULLIF(trim(company_name), ''),
  NULLIF(trim(company), ''),
  NULLIF(trim(concat_ws(' ', first_name, last_name)), ''),
  'Unknown Company'
)
WHERE company_name IS NULL OR trim(company_name) = '';

UPDATE public.leads
SET contact_name = COALESCE(
  NULLIF(trim(contact_name), ''),
  NULLIF(trim(concat_ws(' ', first_name, last_name)), ''),
  'Unknown Contact'
)
WHERE contact_name IS NULL OR trim(contact_name) = '';

INSERT INTO public.crm_team (id, tenant_id, name)
SELECT DISTINCT l.sales_team, l.tenant_id, l.sales_team
FROM public.leads l
WHERE l.sales_team IS NOT NULL
  AND btrim(l.sales_team) <> ''
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'company_name'
      AND data_type <> 'character varying'
  ) THEN
    ALTER TABLE public.leads ALTER COLUMN company_name TYPE VARCHAR(255);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'address_line1'
      AND data_type <> 'character varying'
  ) THEN
    ALTER TABLE public.leads ALTER COLUMN address_line1 TYPE VARCHAR(255);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'address_line2'
      AND data_type <> 'character varying'
  ) THEN
    ALTER TABLE public.leads ALTER COLUMN address_line2 TYPE VARCHAR(255);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'city'
      AND data_type <> 'character varying'
  ) THEN
    ALTER TABLE public.leads ALTER COLUMN city TYPE VARCHAR(120);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'state'
      AND data_type <> 'character varying'
  ) THEN
    ALTER TABLE public.leads ALTER COLUMN state TYPE VARCHAR(120);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'country'
      AND data_type <> 'character varying'
  ) THEN
    ALTER TABLE public.leads ALTER COLUMN country TYPE VARCHAR(120);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'website'
      AND data_type <> 'character varying'
  ) THEN
    ALTER TABLE public.leads ALTER COLUMN website TYPE VARCHAR(2048);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'contact_name'
      AND data_type <> 'character varying'
  ) THEN
    ALTER TABLE public.leads ALTER COLUMN contact_name TYPE VARCHAR(255);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'title'
      AND data_type <> 'character varying'
  ) THEN
    ALTER TABLE public.leads ALTER COLUMN title TYPE VARCHAR(120);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'email'
      AND data_type <> 'character varying'
  ) THEN
    ALTER TABLE public.leads ALTER COLUMN email TYPE VARCHAR(320);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'job_position'
      AND data_type <> 'character varying'
  ) THEN
    ALTER TABLE public.leads ALTER COLUMN job_position TYPE VARCHAR(120);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'phone'
      AND data_type <> 'character varying'
  ) THEN
    ALTER TABLE public.leads ALTER COLUMN phone TYPE VARCHAR(40);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'mobile'
      AND data_type <> 'character varying'
  ) THEN
    ALTER TABLE public.leads ALTER COLUMN mobile TYPE VARCHAR(40);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'sales_team'
      AND data_type <> 'character varying'
  ) THEN
    ALTER TABLE public.leads ALTER COLUMN sales_team TYPE VARCHAR(255);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'priority'
      AND data_type <> 'character varying'
  ) THEN
    ALTER TABLE public.leads ALTER COLUMN priority TYPE VARCHAR(20);
  END IF;
END $$;

ALTER TABLE public.leads
ALTER COLUMN company_name SET NOT NULL,
ALTER COLUMN contact_name SET NOT NULL,
ALTER COLUMN priority SET DEFAULT 'medium';

UPDATE public.leads
SET priority = CASE
  WHEN priority IS NULL THEN 'medium'
  WHEN lower(trim(priority)) = 'critical' THEN 'urgent'
  WHEN lower(trim(priority)) IN ('low', 'medium', 'high', 'urgent') THEN lower(trim(priority))
  ELSE 'medium'
END;

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_priority_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_priority_check CHECK (priority IN ('low', 'medium', 'high', 'urgent'));

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_website_url_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_website_url_check CHECK (
  website IS NULL OR website ~* '^(https?://)([a-z0-9-]+\.)+[a-z]{2,}(:[0-9]{1,5})?(/.*)?$'
);

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_email_rfc5322_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_email_rfc5322_check CHECK (
  email IS NULL OR email ~* '^[A-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)+$'
);

CREATE OR REPLACE FUNCTION public.normalize_e164_phone(input_value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  cleaned TEXT;
BEGIN
  IF input_value IS NULL OR btrim(input_value) = '' THEN
    RETURN NULL;
  END IF;
  cleaned := regexp_replace(input_value, '[^0-9+]', '', 'g');
  IF left(cleaned, 2) = '00' THEN
    cleaned := '+' || substr(cleaned, 3);
  END IF;
  IF left(cleaned, 1) <> '+' THEN
    cleaned := '+' || regexp_replace(cleaned, '[^0-9]', '', 'g');
  ELSE
    cleaned := '+' || regexp_replace(substr(cleaned, 2), '[^0-9]', '', 'g');
  END IF;
  IF cleaned ~ '^\+[1-9][0-9]{1,14}$' THEN
    RETURN cleaned;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.leads_normalize_e164_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.phone := public.normalize_e164_phone(NEW.phone);
  NEW.mobile := public.normalize_e164_phone(NEW.mobile);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_normalize_e164_fields ON public.leads;
CREATE TRIGGER trg_leads_normalize_e164_fields
BEFORE INSERT OR UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.leads_normalize_e164_fields();

UPDATE public.leads
SET
  phone = public.normalize_e164_phone(phone),
  mobile = public.normalize_e164_phone(mobile)
WHERE phone IS NOT NULL OR mobile IS NOT NULL;

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_phone_e164_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_phone_e164_check CHECK (phone IS NULL OR phone ~ '^\+[1-9][0-9]{1,14}$');

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_mobile_e164_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_mobile_e164_check CHECK (mobile IS NULL OR mobile ~ '^\+[1-9][0-9]{1,14}$');

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_salesperson_id_fkey;
ALTER TABLE public.leads ADD CONSTRAINT leads_salesperson_id_fkey
  FOREIGN KEY (salesperson_id) REFERENCES public.res_users(id) ON DELETE SET NULL;

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_sales_team_fkey;
ALTER TABLE public.leads ADD CONSTRAINT leads_sales_team_fkey
  FOREIGN KEY (sales_team) REFERENCES public.crm_team(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_sales_team ON public.leads(sales_team);
CREATE INDEX IF NOT EXISTS idx_leads_priority ON public.leads(priority);
CREATE INDEX IF NOT EXISTS idx_leads_salesperson_id ON public.leads(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_leads_company_name ON public.leads(company_name);
CREATE INDEX IF NOT EXISTS idx_leads_contact_name ON public.leads(contact_name);

COMMIT;
