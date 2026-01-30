-- Migration: 20260130141000_log_aes_seeding.sql
-- Description: Log the completion of AES-AESTIR Appendix D seeding to audit_logs

BEGIN;

DO $$
DECLARE
    v_count integer;
    v_details jsonb;
BEGIN
    -- Count the seeded records
    SELECT count(*) INTO v_count FROM public.ports_locations WHERE schedule_d_code IS NOT NULL;
    
    -- Construct audit details
    v_details := jsonb_build_object(
        'event', 'AES_APPENDIX_D_SEEDING_COMPLETE',
        'seeded_count', v_count,
        'description', 'Comprehensive seeding of AES-AESTIR Appendix D Export Port Codes completed. Includes seeding of missing ports and updating existing ones.',
        'timestamp', now()
    );

    -- Insert into audit_logs if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
        INSERT INTO public.audit_logs (action, resource_type, details)
        VALUES ('SEED_DATA', 'ports_locations', v_details);
    END IF;

END $$;

COMMIT;
