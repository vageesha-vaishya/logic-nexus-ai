-- Master HTS and Validation Framework Schema
-- 1. Master HTS Table
CREATE TABLE IF NOT EXISTS public.master_hts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    hts_code character varying(15) NOT NULL, -- 10-digit formatted
    statistical_suffix character varying(4), -- 8-digit suffix if applicable
    description text NOT NULL,
    unit_of_measure_primary character varying(50),
    unit_of_measure_secondary character varying(50),
    duty_rate character varying(50),
    
    -- Verification & Metadata
    source_citation text NOT NULL, -- e.g., "Census 2026 Export Concordance"
    is_active boolean DEFAULT true,
    verified_flag boolean DEFAULT false,
    last_verified_at timestamp with time zone,
    checksum_sha256 character varying(64),
    effective_date date,
    
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    
    CONSTRAINT master_hts_code_unique UNIQUE (hts_code),
    CONSTRAINT master_hts_format_check CHECK (hts_code ~ '^[0-9]{4}(\.[0-9]{2}){0,3}$')
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_master_hts_code ON public.master_hts(hts_code);
CREATE INDEX IF NOT EXISTS idx_master_hts_verified ON public.master_hts(verified_flag);
CREATE INDEX IF NOT EXISTS idx_master_hts_active ON public.master_hts(is_active);

-- 2. Discrepancy Logs
CREATE TABLE IF NOT EXISTS public.discrepancy_logs (
    log_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    hts_code character varying(15),
    source_primary text, -- The source considered 'master' (e.g., Census)
    source_secondary text, -- The source being compared (e.g., USITC)
    mismatch_details jsonb, -- e.g., {"field": "description", "val_a": "...", "val_b": "..."}
    root_cause character varying(50), -- 'source_error', 'timing_lag', 'format_change', 'manual_override'
    severity character varying(20), -- 'CRITICAL', 'WARNING', 'INFO'
    status character varying(20) DEFAULT 'OPEN', -- 'OPEN', 'RESOLVED', 'IGNORED'
    
    sla_deadline timestamp with time zone, -- 5 business days from creation
    created_at timestamp with time zone DEFAULT now(),
    resolved_at timestamp with time zone
);

-- 3. Verification Reports (Auditable)
CREATE TABLE IF NOT EXISTS public.hts_verification_reports (
    report_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    report_date timestamp with time zone DEFAULT now(),
    total_codes integer,
    verified_count integer,
    active_count integer,
    discrepancy_count integer,
    
    -- Checksum of the entire dataset state for audit
    master_checksum character varying(64),
    
    report_url text -- Link to generated PDF/XBRL if stored
);

-- 4. Feature Flags for Application Layer
CREATE TABLE IF NOT EXISTS public.app_feature_flags (
    flag_key text PRIMARY KEY,
    is_enabled boolean DEFAULT false,
    description text,
    updated_at timestamp with time zone DEFAULT now()
);

-- Seed default flags
INSERT INTO public.app_feature_flags (flag_key, is_enabled, description)
VALUES 
    ('hts_auto_retire', false, 'Automatically retire deactivated codes without manual review'),
    ('hts_queue_new_codes', true, 'Queue new HTS codes for manual review before activation')
ON CONFLICT (flag_key) DO NOTHING;

-- 5. Trigger for Master HTS History (Reusing similar logic to aes_hts_codes)
CREATE TABLE IF NOT EXISTS public.master_hts_history (
    history_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    original_id uuid,
    hts_code character varying(15),
    description text,
    operation_type text,
    changed_at timestamp with time zone DEFAULT now(),
    checksum_sha256 character varying(64)
);

CREATE OR REPLACE FUNCTION public.handle_master_hts_history()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.master_hts_history (
        original_id, hts_code, description, operation_type, checksum_sha256
    ) VALUES (
        COALESCE(NEW.id, OLD.id),
        COALESCE(NEW.hts_code, OLD.hts_code),
        COALESCE(NEW.description, OLD.description),
        TG_OP,
        COALESCE(NEW.checksum_sha256, OLD.checksum_sha256)
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_master_hts_history ON public.master_hts;
CREATE TRIGGER trg_master_hts_history
AFTER INSERT OR UPDATE OR DELETE ON public.master_hts
FOR EACH ROW EXECUTE FUNCTION public.handle_master_hts_history();
