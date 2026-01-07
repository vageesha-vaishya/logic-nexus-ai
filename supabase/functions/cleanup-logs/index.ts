import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Logger } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  const logger = new Logger({ function: 'cleanup-logs' });

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get retention days from query param or env var, default to 90
    const url = new URL(req.url);
    const retentionDays = parseInt(url.searchParams.get('days') || Deno.env.get('LOG_RETENTION_DAYS') || '90');

    logger.info(`Starting log cleanup for retention period: ${retentionDays} days`);

    const { error } = await supabase.rpc('cleanup_old_logs', { days_to_keep: retentionDays });

    if (error) {
      logger.error('Error cleaning up logs', { error });
      throw error;
    }

    logger.info('Log cleanup completed successfully');

    return new Response(
      JSON.stringify({ message: 'Log cleanup completed successfully', retentionDays }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Exception during log cleanup', { error });
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
