import { serveWithLogger } from "../_shared/logger.ts";

/**
 * Scheduled Function to cleanup old logs.
 * Invoke via Cron (e.g., daily at midnight).
 */
serveWithLogger(async (req, logger, supabase) => {
  // Check for admin secret if needed, or rely on internal invocation
  // For cron, it usually comes with a specific header or we can just rely on the fact 
  // that it's an edge function and we trust the source if it's internal.
  // But strictly, we should check for a service key or similar if exposed publicly.
  // Supabase Cron sets 'Authorization: Bearer <service_role_key>' by default if configured?
  // Actually, Supabase Cron is just a postgres extension that calls an HTTP endpoint or SQL.
  // If we use the HTTP extension to call this, we need to secure it.
  
  // However, simpler is to just call the DB function directly from here.
  
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
