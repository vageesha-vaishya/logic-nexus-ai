import { serveWithLogger } from "../_shared/logger.ts";

// Thresholds
const ERROR_THRESHOLD_5MIN = 10;
const CRITICAL_THRESHOLD_5MIN = 1;

serveWithLogger(async (req, logger, supabase) => {
  logger.info("Starting Anomaly Detection Scan...");

  // Calculate timestamp 5 minutes ago
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  // 1. Check for Spike in ERRORs
  const { count: errorCount, error: dbError } = await supabase
    .from("system_logs")
    .select("*", { count: "exact", head: true })
    .in("level", ["ERROR", "CRITICAL"])
    .gt("created_at", fiveMinutesAgo);

  if (dbError) {
    logger.error("Failed to query system_logs for anomalies", { error: dbError });
    return new Response(JSON.stringify({ error: dbError.message }), { status: 500 });
  }

  const count = errorCount || 0;
  logger.info(`Anomaly Scan Result: ${count} errors in last 5 minutes.`);

  // 2. Trigger Alert if Threshold Exceeded
  if (count >= ERROR_THRESHOLD_5MIN) {
    const message = `Anomaly Detected: High Error Rate (${count} errors in last 5 mins). Threshold: ${ERROR_THRESHOLD_5MIN}`;
    
    logger.warn(message, { count, threshold: ERROR_THRESHOLD_5MIN });

    // Invoke alert-notifier
    // We construct a synthetic log entry
    const alertPayload = {
      level: "CRITICAL",
      component: "AnomalyDetector",
      message: message,
      correlation_id: logger.getCorrelationId(), // Pass current trace
      metadata: {
        error_count: count,
        time_window: "5 minutes",
        threshold: ERROR_THRESHOLD_5MIN
      }
    };

    // We invoke alert-notifier directly
    const { error: invokeError } = await supabase.functions.invoke('alert-notifier', {
      body: alertPayload
    });

    if (invokeError) {
      logger.error("Failed to trigger alert-notifier from anomaly-detector", { error: invokeError });
    } else {
      logger.info("Alert triggered successfully");
    }

    return new Response(JSON.stringify({ 
      detected: true, 
      count, 
      message: "Anomaly detected and alert sent." 
    }), { headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ 
    detected: false, 
    count, 
    message: "No anomalies detected." 
  }), { headers: { "Content-Type": "application/json" } });

}, 'anomaly-detector');
