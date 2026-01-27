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
    // Use the official client's invoke method which handles auth headers and token refresh automatically
     // We filter out Authorization header to ensure we rely on the client's auth handling
     const { Authorization, authorization, ...customHeaders } = options.headers || {};
     
     const { data, error } = await supabase.functions.invoke(functionName, {
       body: options.body,
       headers: customHeaders,
       method: options.method || 'POST',
     });

    if (error) {
      // Check if it's a 401 and we haven't retried yet (though supabase-js usually handles this)
      // We can add a layer of safety here if needed, but usually the client is sufficient.
      // If the error is a FunctionsHttpError, it has a context property
      const is401 = (error as any)?.context?.status === 401 || 
                    error.message?.includes('Invalid JWT') || 
                    error.message?.includes('jwt expired');

      if (is401) {
        console.warn(`[Supabase Function] 401/Invalid JWT for ${functionName}. Attempting manual session refresh...`);
        
        let retryData = null;
        let retryError = error;

        // Step 1: Try refreshing session
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (!refreshError && refreshData.session) {
           console.log('[Supabase Function] Session refreshed successfully. Retrying invocation with fresh token...');
           
           const { Authorization, authorization, ...baseHeaders } = options.headers || {};
           
           const result = await supabase.functions.invoke(functionName, {
            body: options.body,
            headers: {
              ...baseHeaders,
              Authorization: `Bearer ${refreshData.session.access_token}`
            },
            method: options.method || 'POST',
          });
          retryData = result.data;
          retryError = result.error;
        }

        // Check if retry is still 401 (or if refresh failed)
        const isStill401 = retryError && ((retryError as any)?.context?.status === 401 || 
                    retryError.message?.includes('Invalid JWT') || 
                    retryError.message?.includes('jwt expired'));

        // Step 2: Fallback to ANON key if User Token fails
        if (isStill401) {
            console.warn(`[Supabase Function] Still 401 after refresh. Fallback to ANON key for ${functionName}...`);
            const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
            
            if (anonKey) {
                 const { Authorization, authorization, ...baseHeaders } = options.headers || {};
                 const anonResult = await supabase.functions.invoke(functionName, {
                    body: options.body,
                    headers: {
                      ...baseHeaders,
                      Authorization: `Bearer ${anonKey}`
                    },
                    method: options.method || 'POST',
                 });
                 retryData = anonResult.data;
                 retryError = anonResult.error;
            }
        }

        // If we have a successful retry (or a different error), return it
        if (!retryError) {
            return { data: retryData, error: null };
        }
        
        // Update the main error to be the retry error so we can parse it below
        error = retryError;
      }

      // Enhance error message if possible
      if (error && typeof error === 'object' && 'context' in error) {
         try {
            const response = (error as any).context;
            // Check if context is a Response-like object and has not been consumed
            if (response && typeof response.text === 'function' && !response.bodyUsed) {
                const text = await response.text();
                try {
                    const data = JSON.parse(text);
                    if (data && data.error) {
                        error.message = data.error;
                    } else if (data && data.message) {
                        error.message = data.message;
                    } else {
                         // If it's a valid JSON but unknown structure, use stringified
                         error.message = text;
                    }
                } catch {
                    // Not JSON, use raw text
                    if (text) error.message = text;
                }
            }
         } catch (e) {
            console.warn('[Supabase Function] Failed to parse error response body:', e);
         }
      }
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err: any) {
    console.error(`[Supabase Function] Unexpected error invoking ${functionName}:`, err);
    return { data: null, error: err };
  }
}
