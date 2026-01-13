-- Verify if the get_user_queues function exists and returns data for the current user

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Check if function exists
    SELECT COUNT(*) INTO v_count
    FROM pg_proc
    WHERE proname = 'get_user_queues';

    IF v_count = 0 THEN
        RAISE EXCEPTION 'Function get_user_queues does NOT exist!';
    ELSE
        RAISE NOTICE 'Function get_user_queues exists.';
    END IF;

    -- Note: We cannot easily call the function here and see results in output without a more complex script,
    -- but existence is the first step.
    
    -- Check permissions
    -- (This part is harder to verify in a DO block for a specific user without context, 
    -- but we can check if the public schema has the function)
END $$;
