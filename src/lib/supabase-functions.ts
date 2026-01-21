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
        
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (!refreshError && refreshData.session) {
           console.log('[Supabase Function] Session refreshed successfully. Retrying invocation with fresh token...');
           
           // Retry once with explicit Authorization header to ensure fresh token is used
           // even if the client singleton hasn't fully propagated the update yet.
           const { Authorization, authorization, ...baseHeaders } = options.headers || {};
           
           return await supabase.functions.invoke(functionName, {
            body: options.body,
            headers: {
              ...baseHeaders,
              Authorization: `Bearer ${refreshData.session.access_token}`
            },
            method: options.method || 'POST',
          });
        }
      }

      // Enhance error message if possible
      let errorMsg = error.message || 'Unknown error';
      if (error && typeof error === 'object' && 'context' in error) {
         try {
            // Try to parse response body from context if available (depends on client version)
            // But usually error.message is populated from the body
         } catch (e) {
            // ignore
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
