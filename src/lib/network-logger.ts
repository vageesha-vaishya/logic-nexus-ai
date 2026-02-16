import { logger } from './logger';
import { debugStore } from './debug-store';

/**
 * Initialize network logger to intercept and log API requests.
 * Filters out requests to the logging endpoint itself to prevent infinite loops.
 */
export const initNetworkLogger = () => {
  const originalFetch = window.fetch;

  window.fetch = async (...args) => {
    const [resource, config] = args;
    const url = resource.toString();
    const debugConfig = debugStore.getConfig();

    // CRITICAL: Avoid infinite loops by not logging requests to system_logs
    // Also skip PostHog and Sentry to reduce noise
    // Check ignoredUrls from debug config
    const isIgnored = debugConfig.network.ignoredUrls.some(ignore => url.includes(ignore));

    if (
      url.includes('system_logs') || 
      url.includes('ingest.sentry.io') || 
      url.includes('app.posthog.com') ||
      isIgnored
    ) {
      return originalFetch(...args);
    }

    // Inject Correlation ID into headers for distributed tracing
    // SKIP Supabase Edge Functions to avoid CORS preflight errors (X-Correlation-ID not allowed)
    const isSupabaseFunction = url.includes('/functions/v1/');
    const correlationId = logger.getCorrelationId();
    let newArgs = args;
    let requestHeaders: HeadersInit = {};
    
    if (!isSupabaseFunction) {
      // Handle different fetch arguments (resource, init)
      if (args.length > 1 && typeof args[1] === 'object') {
        const init = args[1] as RequestInit;
        const headers = new Headers(init.headers);
        headers.set('X-Correlation-ID', correlationId);
        newArgs = [args[0], { ...init, headers }];
        requestHeaders = init.headers || {};
      } else if (args.length === 1 && typeof args[0] === 'object' && args[0] instanceof Request) {
          // Clone the request to modify headers
          const req = args[0] as Request;
          const headers = new Headers(req.headers);
          headers.set('X-Correlation-ID', correlationId);
          newArgs = [new Request(req, { headers })];
          requestHeaders = req.headers;
      } else {
          // Simple url string case, add init object
          newArgs = [args[0], { headers: { 'X-Correlation-ID': correlationId } }];
      }
    }

    // --- Request Capture ---
    let requestBody: any = null;
    if (debugConfig.enabled && debugConfig.network.captureRequestBody) {
      const init = newArgs[1] as RequestInit;
      if (init && init.body) {
        requestBody = init.body;
      }
    }

    const startTime = performance.now();
    
    try {
      const response = await originalFetch(...newArgs);
      const duration = performance.now() - startTime;

      // --- Response Capture ---
      let responseBody: any = null;
      const responseHeaders: any = {};
      
      // Always read response if error or if debug enabled and capture requested
      const shouldCaptureBody = !response.ok || (debugConfig.enabled && debugConfig.network.captureResponseBody);
      
      if (shouldCaptureBody) {
        const contentType = response.headers.get('content-type') || '';
        const isBinary = contentType.includes('application/octet-stream') || 
                         contentType.includes('image/') || 
                         contentType.includes('application/pdf') ||
                         contentType.includes('video/') ||
                         contentType.includes('audio/');

        if (isBinary) {
           responseBody = '[Binary Data]';
        } else {
            try {
               const clone = response.clone();
               // Try JSON first, then text
               const text = await clone.text();
               try {
                 responseBody = JSON.parse(text);
               } catch {
                 responseBody = text;
               }
            } catch (e) {
               responseBody = '[Could not read body]';
            }
        }
      }

      if (debugConfig.enabled && debugConfig.network.captureResponseHeaders) {
        response.headers.forEach((val, key) => {
          responseHeaders[key] = val;
        });
      }

      // --- Debug Store Logging (Full Detail) ---
      if (debugConfig.enabled) {
        // Check URL patterns
        const matchesPattern = debugConfig.network.urlPatterns.some(pattern => new RegExp(pattern).test(url));
        
        if (matchesPattern) {
          const maxPayloadSize = debugConfig.network.maxPayloadSize || 5000;
          
          // Helper to safely truncate
          const safeTruncate = (data: any) => {
             if (!data) return data;
             if (typeof data === 'string' && data.length > maxPayloadSize) {
                 return data.slice(0, maxPayloadSize) + ` ... [Truncated: ${data.length} chars]`;
             }
             if (typeof data === 'object') {
                 const str = JSON.stringify(data);
                 if (str.length > maxPayloadSize) {
                     return str.slice(0, maxPayloadSize) + ` ... [Truncated: ${str.length} chars]`;
                 }
             }
             return data;
          };

          // Detect Supabase/Database requests
          let isDatabase = false;
          let dbTable = '';
          let dbOperation = '';
          
          if (url.includes('.supabase.co/rest/v1/')) {
             isDatabase = true;
             // Extract table: .../rest/v1/tablename?params
             const match = url.match(/\/rest\/v1\/([^\?]+)/);
             if (match) {
                 const path = match[1];
                 if (path.startsWith('rpc/')) {
                     dbTable = path.replace('rpc/', '');
                     dbOperation = 'RPC';
                 } else {
                     dbTable = path;
                     // Map HTTP method to DB operation
                     const method = config?.method || 'GET';
                     if (method === 'GET') dbOperation = 'SELECT';
                     else if (method === 'POST') dbOperation = 'INSERT';
                     else if (method === 'PATCH') dbOperation = 'UPDATE';
                     else if (method === 'DELETE') dbOperation = 'DELETE';
                     else dbOperation = method;
                 }
             }
          }

          debugStore.addLog({
            type: isDatabase ? 'data-flow' : 'network',
            flowType: isDatabase ? (['GET'].includes(config?.method || 'GET') ? 'inbound' : 'outbound') : undefined,
            source: isDatabase ? 'database' : 'api',
            operation: isDatabase ? dbOperation : (config?.method || 'GET'),
            target: isDatabase ? dbTable : url,
            timestamp: new Date().toISOString(),
            method: config?.method || 'GET',
            url,
            status: response.status, // Keep numerical status for compatibility
            statusCode: response.status,
            duration: Math.round(duration),
            request: {
              headers: debugConfig.network.captureRequestHeaders ? requestHeaders : undefined,
              body: safeTruncate(requestBody)
            },
            response: {
              headers: responseHeaders,
              body: safeTruncate(responseBody)
            },
            correlationId,
            payload: isDatabase ? safeTruncate(responseBody) : undefined
          });
        }
      }

      // --- Standard System Logging (Summary/Error) ---

      // Log all API requests at DEBUG level for traceability (Summary only)
      if (!url.includes('heartbeat')) {
         logger.debug(`API Request: ${config?.method || 'GET'} ${url}`, {
            url,
            method: config?.method || 'GET',
            status: response.status,
            duration: Math.round(duration),
            component: 'NetworkLogger'
         });
      }

      // Log HTTP errors (4xx, 5xx)
      if (!response.ok) {
        logger.error(`API Error: ${response.status} ${url}`, {
          url,
          method: config?.method || 'GET',
          status: response.status,
          statusText: response.statusText,
          duration: Math.round(duration),
          responseBody: typeof responseBody === 'string' ? responseBody.slice(0, 1000) : JSON.stringify(responseBody).slice(0, 1000), 
          component: 'NetworkLogger'
        });
      } else {
          // Log slow requests (> 1000ms)
          if (duration > 1000) {
             logger.warn(`Slow API Request: ${url}`, {
                 url,
                 method: config?.method || 'GET',
                 duration: Math.round(duration),
                 status: response.status,
                 component: 'NetworkLogger'
             });
          }
      }

      return response;
    } catch (error) {
      const duration = performance.now() - startTime;
      logger.error(`Network Exception: ${url}`, {
        url,
        error,
        duration: Math.round(duration),
        component: 'NetworkLogger'
      });
      throw error;
    }
  };
};
