import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

/**
 * Wrapper for supabase.functions.invoke that automatically injects
 * the current correlation ID for distributed tracing.
 */
export async function invokeFunction<T = any>(
  functionName: string,
  options: { body?: any; headers?: Record<string, string>; method?: "POST" | "GET" | "PUT" | "PATCH" | "DELETE" } = {}
) {
  const correlationId = logger.getCorrelationId();
  
  const headers = {
    ...options.headers,
    'x-correlation-id': correlationId,
    // Add client version/info if needed
    'x-client-version': '1.0.0',
  };
  
  // Log the invocation
  logger.debug(`Invoking Edge Function: ${functionName}`, { correlation_id: correlationId });
  
  const start = performance.now();
  try {
    const result = await supabase.functions.invoke<T>(functionName, {
      ...options,
      headers,
    });
    
    const duration = performance.now() - start;
    if (result.error) {
      logger.error(`Edge Function ${functionName} failed`, { 
        error: result.error, 
        duration,
        correlation_id: correlationId 
      });
    } else {
      logger.info(`Edge Function ${functionName} success`, { 
        duration,
        correlation_id: correlationId
      });
    }
    
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    logger.critical(`Edge Function ${functionName} exception`, { 
      error, 
      duration,
      correlation_id: correlationId 
    });
    throw error;
  }
}
