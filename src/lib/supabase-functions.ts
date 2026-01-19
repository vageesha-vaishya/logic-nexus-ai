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
    const { data, error } = await supabase.functions.invoke(functionName, options);

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
      // The Supabase client will now use the new token from the refreshed session
      return await supabase.functions.invoke(functionName, options);
    }

    return { data, error };
  } catch (err) {
    return { data: null, error: err };
  }
}
