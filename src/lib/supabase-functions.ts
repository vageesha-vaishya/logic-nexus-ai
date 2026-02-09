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
     
     let { data, error } = await supabase.functions.invoke(functionName, {
       body: options.body,
       headers: customHeaders,
       method: options.method || 'POST',
     });

    if (error) {
      // Check if it's a "Failed to send a request" error (FunctionsFetchError)
      // This often happens due to Ad Blockers or browser network restrictions
      const isFetchError = error.name === 'FunctionsFetchError' || error.message === 'Failed to send a request to the Edge Function';
      
      if (isFetchError) {
        console.warn(`[Supabase Function] Fetch failed for ${functionName}. Attempting manual fetch fallback...`);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;
            
            // In development, use relative path to trigger Vite proxy which bypasses CORS
            // In production, use full URL
            let functionUrl;
            if (import.meta.env.DEV) {
                functionUrl = `/functions/v1/${functionName}`;
            } else {
                const projectUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '') || "https://gzhxgoigflftharcmdqj.supabase.co";
                functionUrl = `${projectUrl}/functions/v1/${functionName}`;
            }
            
            const response = await fetch(functionUrl, {
                method: options.method || 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    ...(options.headers || {})
                },
                body: options.body ? JSON.stringify(options.body) : undefined
            });
            
            if (!response.ok) {
                const text = await response.text();
                let errorData;
                try { errorData = JSON.parse(text); } catch { errorData = { message: text }; }
                return { data: null, error: new Error(errorData.message || `Function returned ${response.status}`) };
            }
            
            const data = await response.json();
            return { data, error: null };
        } catch (manualError: any) {
             console.error(`[Supabase Function] Manual fetch fallback failed:`, manualError);
             // Enhance the original error message
             error.message = `${error.message} (Check for Ad Blockers or Network Firewall)`;
        }
      }

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
