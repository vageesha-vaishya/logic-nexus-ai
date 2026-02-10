import { supabase } from '@/integrations/supabase/client';

/**
 * Invokes a Supabase Edge Function anonymously (using the ANON/Public key).
 * 
 * This bypasses the Supabase Client's auth state and User Session, ensuring
 * that "Invalid JWT" errors do not occur for public functions.
 * 
 * @param functionName The name of the Edge Function to invoke.
 * @param body The body of the request.
 * @returns The response data.
 * @throws Error if the request fails.
 */
export async function invokeAnonymous<T = any>(functionName: string, body: any): Promise<T> {
    const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "https://gzhxgoigflftharcmdqj.supabase.co").replace(/\/$/, '');
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    // Use relative URL in development to leverage Vite proxy (avoids CORS)
    // Use absolute URL in production
    let functionUrl;
    if (import.meta.env.DEV) {
        functionUrl = `/functions/v1/${functionName}`;
    } else {
        functionUrl = `${supabaseUrl}/functions/v1/${functionName}`;
    }

    console.log(`[invokeAnonymous] Calling ${functionName} at ${functionUrl}`);

    try {
        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseAnonKey}`
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const text = await response.text();
            let errorMsg = text;
            try { 
                const json = JSON.parse(text);
                errorMsg = json.error || json.message || text;
            } catch {}
            console.error(`[invokeAnonymous] Failed: ${errorMsg}`);
            throw new Error(errorMsg);
        }

        return response.json();
    } catch (error: any) {
        console.error(`[invokeAnonymous] Fetch error:`, error);
        // If we failed with relative URL in dev, maybe try absolute as fallback? 
        // Or just return clearer error.
        if (error.message === 'Failed to fetch' && import.meta.env.DEV) {
             throw new Error("Network error. Check if Supabase Edge Functions are running or if CORS is blocking requests.");
        }
        throw error;
    }
}

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
        const isStill401 = (retryError || error) && (
            (retryError || error)?.context?.status === 401 || 
            (retryError || error).message?.includes('Invalid JWT') || 
            (retryError || error).message?.includes('jwt expired')
        );

          // Step 2: Fallback to ANON key if User Token fails
          if (isStill401) {
              console.warn(`[Supabase Function] Still 401 after refresh. Fallback to ANON key for ${functionName}...`);
              // Try VITE_SUPABASE_ANON_KEY first, then VITE_SUPABASE_PUBLISHABLE_KEY
              const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
              
              if (anonKey) {
                   // Use direct fetch to ensure we control the Authorization header completely
                   // avoiding any potential interference from the supabase client's auto-auth
                   
                   // ALWAYS use the absolute URL to avoid local proxy issues and ensure we hit the correct project
                   const projectUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '') || "https://gzhxgoigflftharcmdqj.supabase.co";
                   const functionUrl = `${projectUrl}/functions/v1/${functionName}`;

                   console.log(`[Supabase Function] Fallback fetching: ${functionUrl}`);

                   const { Authorization, authorization, ...baseHeaders } = options.headers || {};
                   
                   try {
                       const response = await fetch(functionUrl, {
                           method: options.method || 'POST',
                           headers: {
                               'Content-Type': 'application/json',
                               'Authorization': `Bearer ${anonKey}`,
                               ...baseHeaders
                           },
                           body: options.body ? JSON.stringify(options.body) : undefined
                       });

                       if (!response.ok) {
                           const text = await response.text();
                           let errorData;
                           try { errorData = JSON.parse(text); } catch { errorData = { message: text }; }
                           console.error(`[Supabase Function] Fallback failed with ${response.status}:`, text);
                           retryData = null;
                           retryError = new Error(errorData.message || `Function returned ${response.status}`);
                       } else {
                           retryData = await response.json();
                           retryError = null;
                       }
                   } catch (fetchErr) {
                       console.error(`[Supabase Function] Fallback fetch error:`, fetchErr);
                       retryError = fetchErr;
                   }
              } else {
                  console.warn("[Supabase Function] No ANON key found for fallback.");
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
