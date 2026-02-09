-- Backfill script to encrypt existing emails
-- Usage: Run this in SQL Editor or via migration

DO $$
DECLARE
    v_batch_size integer := 1000;
    v_count integer;
    v_total_updated integer := 0;
BEGIN
    RAISE NOTICE 'Starting encryption backfill...';
    
    LOOP
        -- Update a batch of emails that are not encrypted but have content
        -- The update trigger 'encrypt_email_body_on_insert' will handle the actual encryption
        WITH batch AS (
            SELECT id
            FROM public.emails
            WHERE body_encrypted IS NULL
            AND (body_html IS NOT NULL OR body_text IS NOT NULL)
            LIMIT v_batch_size
        )
        UPDATE public.emails
        SET updated_at = now() -- Dummy update to fire trigger
        WHERE id IN (SELECT id FROM batch);

        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_total_updated := v_total_updated + v_count;
        
        RAISE NOTICE 'Processed batch of % emails. Total: %', v_count, v_total_updated;

        -- Exit if no more rows to process
        IF v_count < v_batch_size THEN
            EXIT;
        END IF;
        
        -- Optional: Commit implicitly happens in blocks, but for large datasets we might want multiple transactions.
        -- In a DO block, it's one transaction.
    END LOOP;

    RAISE NOTICE 'Backfill complete. Total emails encrypted: %', v_total_updated;
END $$;
