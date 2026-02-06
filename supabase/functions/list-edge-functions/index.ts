import { getCorsHeaders } from '../_shared/cors.ts';
import { requireAuth, createServiceClient } from '../_shared/auth.ts';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response> | Response): void;
  readDir(path: string): AsyncIterable<{ name: string; isDirectory: boolean }>;
  stat(path: string): Promise<unknown>;
};

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth validation
  const { user, error: authError } = await requireAuth(req);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Verify platform_admin role
  const serviceClient = createServiceClient();
  const { data: roleData } = await serviceClient.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'platform_admin').maybeSingle();
  if (!roleData) {
    return new Response(JSON.stringify({ error: 'Forbidden: platform_admin required' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
// Environment variables are available in Edge runtime; no Supabase client is needed here.
    
    // List all edge functions by reading the functions directory
    const functionsDir = new URL('../', import.meta.url).pathname;
    const functions: Array<{
      name: string;
      path: string;
      has_index: boolean;
    }> = [];

    try {
      for await (const dirEntry of Deno.readDir(functionsDir)) {
        if (dirEntry.isDirectory && dirEntry.name !== '_shared') {
          const indexPath = `${functionsDir}${dirEntry.name}/index.ts`;
          let hasIndex = false;
          try {
            await Deno.stat(indexPath);
            hasIndex = true;
          } catch {
            // index.ts doesn't exist
          }
          
          functions.push({
            name: dirEntry.name,
            path: dirEntry.name,
            has_index: hasIndex,
          });
        }
      }
    } catch (error) {
      console.error('Error reading functions directory:', error);
    }

    // Get list of secret names (not values)
    const secrets = [
      'DB_PASSWORD',
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_DB_URL',
      'SUPABASE_PUBLISHABLE_KEY'
    ];

    return new Response(
      JSON.stringify({
        edge_functions: functions,
        secrets: secrets,
        exported_at: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in list-edge-functions:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
