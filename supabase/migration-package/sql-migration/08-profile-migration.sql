-- ==========================================
-- PROFILE DATA MIGRATION (legacy -> new)
-- ==========================================
-- Purpose: Copy user profiles from legacy table `public.profile` into
--          new table `public.profiles`, aligning `profiles.id` to
--          `auth.users.id` via email match.
--
-- How to run:
-- - Open Supabase Dashboard → SQL editor for your project
-- - Paste this script and execute
-- - Review the summary output
--
-- Notes:
-- - Only profiles with a matching `auth.users.email` will be inserted.
-- - If your legacy table is named differently, adjust `SOURCE_TABLE`
--   below (e.g., `public.user_profile`, `public.profiles_old`).
-- - This script uses idempotent upserts; re-running is safe.

DO $$
DECLARE
  SOURCE_TABLE constant text := 'public.profile'; -- change if needed
  s_schema text := split_part(SOURCE_TABLE, '.', 1);
  s_table  text := split_part(SOURCE_TABLE, '.', 2);
  inserted_count integer := 0;
  updated_count integer := 0;
  unmatched_count integer := 0;
BEGIN
  -- Ensure target table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    RAISE EXCEPTION 'Target table public.profiles does not exist. Create schema first.';
  END IF;

  -- Ensure source table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = s_schema AND table_name = s_table
  ) THEN
    RAISE EXCEPTION 'Source table % not found. Adjust SOURCE_TABLE and retry.', SOURCE_TABLE;
  END IF;

  -- Basic column presence checks on source
  PERFORM 1 FROM information_schema.columns
    WHERE table_schema = s_schema AND table_name = s_table AND column_name = 'email';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source table % must have column "email" to match auth.users.', SOURCE_TABLE;
  END IF;

  -- Temporary table to hold matched rows
  CREATE TEMP TABLE IF NOT EXISTS tmp_profile_matched (
    user_id uuid,
    email text,
    first_name text,
    last_name text,
    phone text,
    avatar_url text,
    is_active boolean,
    must_change_password boolean,
    created_at timestamptz
  ) ON COMMIT DROP;

  TRUNCATE tmp_profile_matched;

  -- Fill matched rows using dynamic SQL
  EXECUTE format(
    'INSERT INTO tmp_profile_matched (user_id, email, first_name, last_name, phone, avatar_url, is_active, must_change_password, created_at)
     SELECT u.id, s.email, s.first_name, s.last_name, s.phone, s.avatar_url,
            COALESCE(s.is_active, true), COALESCE(s.must_change_password, false), COALESCE(s.created_at, now())
     FROM %I.%I s
     JOIN auth.users u ON LOWER(u.email) = LOWER(s.email)'
    , s_schema, s_table
  );

  -- Insert new profiles
  INSERT INTO public.profiles AS p (
    id, email, first_name, last_name, phone, avatar_url,
    is_active, must_change_password, created_at, updated_at
  )
  SELECT 
    t.user_id, t.email, t.first_name, t.last_name, t.phone, t.avatar_url,
    t.is_active, t.must_change_password, t.created_at, now()
  FROM tmp_profile_matched t
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p2 WHERE p2.id = t.user_id
  );
  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  -- Update existing profiles
  UPDATE public.profiles p
  SET 
    email = t.email,
    first_name = t.first_name,
    last_name = t.last_name,
    phone = t.phone,
    avatar_url = t.avatar_url,
    is_active = t.is_active,
    must_change_password = t.must_change_password,
    updated_at = now()
  FROM tmp_profile_matched t
  WHERE p.id = t.user_id;
  GET DIAGNOSTICS updated_count = ROW_COUNT;

  -- Count unmatched source rows (no auth.users)
  EXECUTE format(
    'SELECT COUNT(*) FROM %I.%I s WHERE NOT EXISTS (
       SELECT 1 FROM auth.users u WHERE LOWER(u.email) = LOWER(s.email)
     )'
    , s_schema, s_table
  ) INTO unmatched_count;

  RAISE NOTICE 'Profiles inserted: %', COALESCE(inserted_count, 0);
  RAISE NOTICE 'Profiles updated: %', COALESCE(updated_count, 0);
  RAISE NOTICE 'Source profiles without matching auth.users: %', COALESCE(unmatched_count, 0);

  IF unmatched_count > 0 THEN
    RAISE NOTICE 'Review unmatched with:\n  SELECT s.* FROM % s WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE LOWER(u.email)=LOWER(s.email));', SOURCE_TABLE;
  END IF;

END $$;

-- Optional: quick verification queries
-- SELECT COUNT(*) FROM public.profiles;
-- SELECT COUNT(*) FROM public.profile;
-- SELECT p.id, p.email FROM public.profiles p LEFT JOIN auth.users u ON u.id = p.id WHERE u.id IS NULL; -- should be 0