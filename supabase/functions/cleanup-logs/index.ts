import { serveWithLogger } from "../_shared/logger.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

/**
 * Scheduled Function to cleanup old logs.
 * Invoke via Cron (e.g., daily at midnight).
 */
serveWithLogger(async (req, logger, supabase) => {
  const headers = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  // Auth: verify service role key or authenticated user (admin manually triggering)
  const authHeader = req.headers.get('Authorization');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!authHeader || !authHeader.includes(serviceKey)) {
    const { user, error: authError } = await requireAuth(req);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } });
    }
  }

  const retentionDays = 30; // Configurable
  
  logger.info(`Starting log cleanup. Retention: ${retentionDays} days.`);
  
  // Call the Postgres function we created
  const { error } = await supabase.rpc('cleanup_system_logs', { days_to_keep: retentionDays });
  
  if (error) {
    logger.error("Failed to cleanup logs", { error });
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  
  logger.info("Log cleanup completed successfully.");
  
  return new Response(JSON.stringify({ success: true, message: "Cleanup complete" }), {
    headers: { "Content-Type": "application/json" },
  });
}, 'cleanup-logs');
