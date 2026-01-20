import { supabase } from '@/integrations/supabase/client';

export type InvokeOptions = {
  body?: any;
  headers?: { [key: string]: string };
  method?: 'POST' | 'GET' | 'PUT' | 'DELETE' | 'PATCH';
};

/**
 * Invokes a Supabase Edge Function with automatic 401 retry logic.
 * 
 * If the initial request fails with a 401 Unauthorized, this function
 * attempts to refresh the user session and retry the request once.
 * 
 * @param functionName The name of the Edge Function to invoke.
 * @param options Invocation options (body, headers, method).
 * @returns The response data and error, matching the supabase.functions.invoke signature.
 */
export async function invokeFunction<T = any>(
  functionName: string,
  options: InvokeOptions = {}
): Promise<{ data: T | null; error: any }> {
  try {
    // 1. Initial attempt
    // Note: We intentionally DO NOT manually set the Authorization header here unless explicitly provided.
    // The Supabase client automatically attaches the current session's token.
    
    // Explicitly remove Authorization header from options if it exists to prevent stale tokens
    const cleanOptions = { ...options };
    if (cleanOptions.headers) {
      // Case-insensitive removal
      const authKey = Object.keys(cleanOptions.headers).find(k => k.toLowerCase() === 'authorization');
      if (authKey) {
        console.warn(`[Supabase Function] Removed manual Authorization header from ${functionName} invocation to ensure fresh token usage.`);
        delete cleanOptions.headers[authKey];
      }
    }

    const { data, error } = await supabase.functions.invoke(functionName, cleanOptions);

    if (!error) {
      return { data, error: null };
    }

    // 2. Check for 401 Unauthorized
    // The error object from supabase-js functions invoke usually contains context about the status
    const is401 = (error as any)?.context?.status === 401 || 
                  (error as any)?.status === 401 ||
                  error.message?.includes('401') ||
                  error.message?.includes('Unauthorized');

    if (is401) {
      console.warn(`[Supabase Function] 401 Unauthorized for ${functionName}. Attempting session refresh...`);
      
      // 3. Refresh session
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !refreshData.session) {
        console.error('[Supabase Function] Session refresh failed:', refreshError);
        // Return a clearer error message for the UI to consume
        return { 
          data: null, 
          error: new Error('Session expired. Please log out and log in again.') 
        };
      }

      console.log('[Supabase Function] Session refreshed successfully. Retrying invocation...');

      // 4. Retry invocation
      // Explicitly pass the new token to ensure it's used immediately
      const freshToken = refreshData.session.access_token;
      console.log(`[Supabase Function] Fresh token obtained: ...${freshToken.slice(-5)}`);
      
      // 4. Retry invocation using direct fetch to bypass potential Supabase client header caching
      // We extract the URL and Key from the client instance
      const supabaseUrl = (supabase as any).supabaseUrl || import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = (supabase as any).supabaseKey || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const functionUrl = `${supabaseUrl}/functions/v1/${functionName}`;
      
      // Construct headers from scratch to avoid any pollution
      const retryHeaders: Record<string, string> = {
        "Authorization": `Bearer ${freshToken}`,
        "apikey": supabaseKey,
      };

      // Add custom headers from options if they exist, but skip Authorization
      if (options.headers) {
          Object.entries(options.headers).forEach(([key, value]) => {
              if (key.toLowerCase() !== 'authorization') {
                  retryHeaders[key] = value;
              }
          });
      }
      
      // Ensure Content-Type is set if body is present
      if (options.body && !retryHeaders["Content-Type"]) {
        retryHeaders["Content-Type"] = "application/json";
      }

      console.log(`[Supabase Function] Retrying fetch to ${functionUrl} with headers:`, {
          ...retryHeaders,
          Authorization: `Bearer ...${freshToken.slice(-5)}` // Log safe snippet
      });
      
      try {
        const response = await fetch(functionUrl, {
            method: options.method || 'POST',
            headers: retryHeaders,
            body: options.body ? JSON.stringify(options.body) : undefined,
            cache: 'no-store' // Prevent caching
        });

        // Parse response
        const isJson = response.headers.get('content-type')?.includes('application/json');
        let data = null;
        let error = null;

        if (isJson) {
            data = await response.json();
        } else {
            data = await response.text();
        }

        if (!response.ok) {
            // Reconstruct an error object similar to what supabase-js returns
            error = {
                message: isJson && data.error ? data.error : "Edge Function returned a non-2xx status code",
                status: response.status,
                details: isJson ? data.details : undefined,
                context: response, // Keep context for debug compatibility
                debug: isJson ? data.debug : undefined
            };
            
            // Log the error using our existing logic
            console.error(`[Supabase Function] Retry failed for ${functionName}:`, error);
            if (error.details) {
                 console.error('[Supabase Function] Error Details:', error.details);
            }
            if (error.debug) {
                 console.error('[Supabase Function] Server Debug Info:', error.debug);
            }
            
            return { data: null, error };
        }

        return { data, error: null };

      } catch (fetchError) {
          console.error(`[Supabase Function] Retry fetch failed:`, fetchError);
          return { data: null, error: fetchError };
      }
    }

    return { data, error };
  } catch (err) {
    return { data: null, error: err };
  }
}
