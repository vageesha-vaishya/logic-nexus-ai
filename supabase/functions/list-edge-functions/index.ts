import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
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
