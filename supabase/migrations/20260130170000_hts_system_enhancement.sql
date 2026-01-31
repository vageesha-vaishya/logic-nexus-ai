-- AES HTS Codes System Enhancement
-- 1. Ensure Indexes Exist
CREATE INDEX IF NOT EXISTS idx_aes_hts_codes_category ON public.aes_hts_codes USING btree (category);
CREATE INDEX IF NOT EXISTS idx_aes_hts_codes_description_tsv ON public.aes_hts_codes USING gin (to_tsvector('english'::regconfig, description));
CREATE INDEX IF NOT EXISTS idx_aes_hts_codes_hts_code ON public.aes_hts_codes USING btree (hts_code);

-- 2. Version Control System (History Table)
CREATE TABLE IF NOT EXISTS public.aes_hts_codes_history (
    history_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    original_id uuid NOT NULL,
    hts_code character varying(15),
    schedule_b character varying(15),
    category character varying(100),
    description text,
    unit_of_measure character varying(50),
    duty_rate character varying(50),
    special_provisions text,
    uom1 character varying,
    uom2 character varying,
    operation_type text NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    changed_at timestamp with time zone DEFAULT now(),
    changed_by uuid -- Optional link to auth.users if available via context
);

CREATE INDEX IF NOT EXISTS idx_aes_hts_history_original_id ON public.aes_hts_codes_history(original_id);
CREATE INDEX IF NOT EXISTS idx_aes_hts_history_hts_code ON public.aes_hts_codes_history(hts_code);

-- 3. Trigger Function for Version Control and Audit
CREATE OR REPLACE FUNCTION public.handle_hts_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO public.aes_hts_codes_history (
            original_id, hts_code, schedule_b, category, description, 
            unit_of_measure, duty_rate, special_provisions, uom1, uom2, 
            operation_type, changed_at
        ) VALUES (
            OLD.id, OLD.hts_code, OLD.schedule_b, OLD.category, OLD.description,
            OLD.unit_of_measure, OLD.duty_rate, OLD.special_provisions, OLD.uom1, OLD.uom2,
            'DELETE', now()
        );
        
        -- Also log to central audit_logs if needed
        INSERT INTO public.audit_logs (
            action, resource_type, resource_id, details, created_at
        ) VALUES (
            'DELETE_HTS_CODE', 'aes_hts_codes', OLD.id, row_to_json(OLD), now()
        );
        
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO public.aes_hts_codes_history (
            original_id, hts_code, schedule_b, category, description, 
            unit_of_measure, duty_rate, special_provisions, uom1, uom2, 
            operation_type, changed_at
        ) VALUES (
            NEW.id, NEW.hts_code, NEW.schedule_b, NEW.category, NEW.description,
            NEW.unit_of_measure, NEW.duty_rate, NEW.special_provisions, NEW.uom1, NEW.uom2,
            'UPDATE', now()
        );
        
        INSERT INTO public.audit_logs (
            action, resource_type, resource_id, details, created_at
        ) VALUES (
            'UPDATE_HTS_CODE', 'aes_hts_codes', NEW.id, 
            jsonb_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW)), 
            now()
        );
        
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO public.aes_hts_codes_history (
            original_id, hts_code, schedule_b, category, description, 
            unit_of_measure, duty_rate, special_provisions, uom1, uom2, 
            operation_type, changed_at
        ) VALUES (
            NEW.id, NEW.hts_code, NEW.schedule_b, NEW.category, NEW.description,
            NEW.unit_of_measure, NEW.duty_rate, NEW.special_provisions, NEW.uom1, NEW.uom2,
            'INSERT', now()
        );
        
        INSERT INTO public.audit_logs (
            action, resource_type, resource_id, details, created_at
        ) VALUES (
            'CREATE_HTS_CODE', 'aes_hts_codes', NEW.id, row_to_json(NEW), now()
        );
        
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_aes_hts_changes ON public.aes_hts_codes;
CREATE TRIGGER trg_aes_hts_changes
AFTER INSERT OR UPDATE OR DELETE ON public.aes_hts_codes
FOR EACH ROW EXECUTE FUNCTION public.handle_hts_changes();

-- 4. Stored Procedures for Validation and Queries

-- Validate HTS Code Format
CREATE OR REPLACE FUNCTION public.validate_hts_code(p_code text)
RETURNS boolean AS $$
BEGIN
    RETURN p_code ~ '^[0-9]{4}(\.[0-9]{2}){0,3}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Search HTS Codes (Full Text)
CREATE OR REPLACE FUNCTION public.search_hts_codes(p_search_term text, p_limit int DEFAULT 20)
RETURNS SETOF public.aes_hts_codes AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.aes_hts_codes
    WHERE 
        hts_code ILIKE p_search_term || '%' OR
        description ILIKE '%' || p_search_term || '%' OR
        to_tsvector('english', description) @@ plainto_tsquery('english', p_search_term)
    ORDER BY 
        CASE WHEN hts_code = p_search_term THEN 0 ELSE 1 END,
        ts_rank(to_tsvector('english', description), plainto_tsquery('english', p_search_term)) DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get HTS Details with History
CREATE OR REPLACE FUNCTION public.get_hts_code_details(p_code text)
RETURNS TABLE (
    current_record jsonb,
    history jsonb
) AS $$
DECLARE
    v_id uuid;
BEGIN
    SELECT id INTO v_id FROM public.aes_hts_codes WHERE hts_code = p_code;
    
    RETURN QUERY
    SELECT 
        (SELECT row_to_json(c) FROM public.aes_hts_codes c WHERE c.id = v_id)::jsonb as current_record,
        (SELECT jsonb_agg(h ORDER BY h.changed_at DESC) FROM public.aes_hts_codes_history h WHERE h.original_id = v_id) as history;
END;
$$ LANGUAGE plpgsql STABLE;
