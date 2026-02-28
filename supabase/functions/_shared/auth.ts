
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Logger } from "./logger.ts";

// @ts-ignore
declare const Deno: any;

interface AuthResult {
  user: { 
    id: string; 
    email?: string;
    app_metadata?: any;
    user_metadata?: any;
  } | null;
  error: string | null;
  supabaseClient: SupabaseClient;
}

/**
 * Validates the Authorization header and returns the authenticated user.
 * Creates a Supabase client scoped to the user's JWT (respects RLS).
 * 
 * Usage:
 *   const { user, error, supabaseClient } = await requireAuth(req);
 *   if (error) return new Response(JSON.stringify({ error }), { status: 401, headers });
 */
export async function requireAuth(req: Request, logger?: Logger): Promise<AuthResult> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
      const msg = '[requireAuth] Missing SUPABASE_URL or SUPABASE_ANON_KEY';
      if (logger) logger.error(msg);
      return { 
        user: null, 
        error: 'Internal Server Error: Missing configuration', 
        supabaseClient: null as any 
      };
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      const msg = '[requireAuth] Missing Authorization header';
      if (logger) logger.error(msg);
      // We cannot create a client without the anon key if it's missing (though we checked above)
      // But more importantly, we shouldn't create a client here if we want to enforce auth.
      // However, the original logic tried to return a client even if auth header is missing? 
      // Actually, if auth header is missing, we can't create a user-scoped client.
      // We could return an admin client or anon client, but requireAuth implies we need a user.
      // The original code created a client with just URL and Anon Key (Anon client).
      // We will assume that if auth is missing, we just fail early or return anon client if that was the intent.
      // But looking at the return type AuthResult, it expects `supabaseClient`.
      // Let's create an anon client if strictly necessary, but preferably just error out.
      // For now, to match previous behavior but avoid console.error:
      const client = createClient(supabaseUrl, supabaseAnonKey);
      return { user: null, error: 'Missing Authorization header', supabaseClient: client };
    }

  // Create client with the user's JWT — this respects RLS policies
  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error } = await supabaseClient.auth.getUser();

  if (error || !user) {
    const msg = `[requireAuth] getUser failed: ${error?.message}`;
    if (logger) logger.error(msg, { error }); else console.error(msg, error);
    return { user: null, error: error?.message || 'Invalid or expired token', supabaseClient };
  }

  if (logger) {
      logger.info(`[requireAuth] User authenticated: ${user.id}`);
  } else {
      console.log('[requireAuth] User authenticated:', user.id);
  }
  return { 
    user: { 
      id: user.id, 
      email: user.email,
      app_metadata: user.app_metadata,
      user_metadata: user.user_metadata
    }, 
    error: null, 
    supabaseClient 
  };
}

/**
 * Creates a Supabase admin client (service role) for operations that need
 * to bypass RLS. Use sparingly and only after validating the user's auth.
 * @deprecated Use `serveWithLogger` which injects `supabase` (admin client) instead.
 */
export function createServiceClient(logger: Logger): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!serviceKey) {
      const msg = '[createServiceClient] Missing SUPABASE_SERVICE_ROLE_KEY';
      logger.error(msg);
      throw new Error(msg);
  }
  return createClient(supabaseUrl, serviceKey);
}
