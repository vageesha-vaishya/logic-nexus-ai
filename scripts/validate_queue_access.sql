-- Check function existence
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'get_user_queues';

-- Check email policy
SELECT policyname, schemaname, tablename
FROM pg_policies
WHERE tablename = 'emails'
  AND policyname = 'Users can view emails in their queues';

-- Check queue policy
SELECT policyname, schemaname, tablename
FROM pg_policies
WHERE tablename = 'queues'
  AND policyname = 'Users can view tenant queues';

-- Sample: count queues
SELECT COUNT(*) AS queue_count FROM public.queues;

