-- ==============================================================================
-- CONTEXT-AWARE ROUTING ENHANCEMENT
-- 1. Add metadata column to emails
-- 2. Update routing trigger for advanced criteria (Headers, Metadata, AI, Domain)
-- ==============================================================================

-- 1. Add metadata column if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'emails' AND column_name = 'metadata') THEN
        ALTER TABLE public.emails ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 2. Update Routing Trigger
CREATE OR REPLACE FUNCTION public.process_email_queue_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    rule RECORD;
    criteria JSONB;
    match_found BOOLEAN;
    header_key TEXT;
    header_val TEXT;
BEGIN
    -- Only process if queue is not already set
    IF NEW.queue IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Iterate through active rules for this tenant, ordered by priority
    FOR rule IN 
        SELECT * FROM public.queue_rules 
        WHERE tenant_id = NEW.tenant_id 
        AND is_active = true 
        ORDER BY priority DESC
    LOOP
        criteria := rule.criteria;
        match_found := TRUE;

        -- 1. Subject Check
        IF match_found AND criteria ? 'subject_contains' AND 
           NOT (NEW.subject ILIKE '%' || (criteria->>'subject_contains') || '%') THEN
            match_found := FALSE;
        END IF;

        -- 2. From Email Check (Exact)
        IF match_found AND criteria ? 'from_email' AND 
           NOT (NEW.from_email ILIKE (criteria->>'from_email')) THEN
            match_found := FALSE;
        END IF;
        
        -- 3. From Domain Check (Suffix)
        IF match_found AND criteria ? 'from_domain' AND 
           NOT (NEW.from_email ILIKE '%@' || (criteria->>'from_domain')) THEN
            match_found := FALSE;
        END IF;

        -- 4. Body Check
        IF match_found AND criteria ? 'body_contains' AND 
           NOT (COALESCE(NEW.body_text, '') ILIKE '%' || (criteria->>'body_contains') || '%') THEN
            match_found := FALSE;
        END IF;

        -- 5. AI Category Check
        IF match_found AND criteria ? 'ai_category' AND (criteria->>'ai_category' != '') AND
           NOT (COALESCE(NEW.ai_category, '') = (criteria->>'ai_category')) THEN
            match_found := FALSE;
        END IF;

        -- 6. AI Sentiment Check
        IF match_found AND criteria ? 'ai_sentiment' AND (criteria->>'ai_sentiment' != '') AND
           NOT (COALESCE(NEW.ai_sentiment, '') = (criteria->>'ai_sentiment')) THEN
            match_found := FALSE;
        END IF;

        -- 7. Header Contains (Map check)
        -- criteria->'header_contains' is expected to be a JSON object like {"X-Priority": "High"}
        IF match_found AND criteria ? 'header_contains' THEN
            FOR header_key, header_val IN SELECT * FROM jsonb_each_text(criteria->'header_contains')
            LOOP
                -- Check if raw_headers contains this key/value (case-insensitive value match)
                IF NOT (COALESCE(NEW.raw_headers->>header_key, '') ILIKE '%' || header_val || '%') THEN
                    match_found := FALSE;
                    EXIT; -- Break inner loop, fail match
                END IF;
            END LOOP;
        END IF;

        -- 8. Metadata Flags (Check existence of keys)
        -- criteria->'metadata_flags' is expected to be an array of keys that must exist in metadata
        IF match_found AND criteria ? 'metadata_flags' THEN
             IF NOT (NEW.metadata ?& (
                 SELECT array_agg(value) 
                 FROM jsonb_array_elements_text(criteria->'metadata_flags')
             )) THEN
                match_found := FALSE;
             END IF;
        END IF;

        -- If all criteria match, assign queue and exit
        IF match_found THEN
            NEW.queue := rule.target_queue_name;
            RETURN NEW;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$;
