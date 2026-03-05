import { createClient, SupabaseClient } from '@supabase/supabase-js';

let singletonClient: SupabaseClient | null = null;

/**
 * Returns a singleton admin client to reuse HTTP connections across requests.
 */
export function getSupabaseAdminClient(): SupabaseClient {
  if (singletonClient) return singletonClient;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  singletonClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return singletonClient;
}
