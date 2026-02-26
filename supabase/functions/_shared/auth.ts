
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// @ts-ignore
declare const Deno: any;

interface AuthResult {
  user: { id: string; email?: string } | null;
  error: string | null;
  supabaseClient: ReturnType<typeof createClient>;
}

/**
 * Validates the Authorization header and returns the authenticated user.
 * Creates a Supabase client scoped to the user's JWT (respects RLS).
 *
 * Usage:
 *   const { user, error, supabaseClient } = await requireAuth(req);
 *   if (error) return new Response(JSON.stringify({ error }), { status: 401, headers });
 */
export async function requireAuth(req: Request): Promise<AuthResult> {
  const host = (() => {
    try {
      return new URL(req.url).host;
    } catch {
      return '';
    }
  })();
  const defaultUrl = host ? `https://${host}` : '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? defaultUrl;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? (req.headers.get('apikey') ?? '');

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    console.error('[requireAuth] Missing Authorization header');
    const client = createClient(supabaseUrl, supabaseAnonKey);
    return { user: null, error: 'Missing Authorization header', supabaseClient: client };
  }

  // Create client with the user's JWT — this respects RLS policies
  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error } = await supabaseClient.auth.getUser();

  if (error || !user) {
    console.error('[requireAuth] getUser failed:', error);
    return { user: null, error: error?.message || 'Invalid or expired token', supabaseClient };
  }

  console.log('[requireAuth] User authenticated:', user.id);
  return { user: { id: user.id, email: user.email }, error: null, supabaseClient };
}

/**
 * Creates a Supabase admin client (service role) for operations that need
 * to bypass RLS. Use sparingly and only after validating the user's auth.
 */
export function createServiceClient(): ReturnType<typeof createClient> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return createClient(supabaseUrl, serviceKey);
}
