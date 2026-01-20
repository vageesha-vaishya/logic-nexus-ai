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
    // 1. Initial attempt using direct fetch to ensure we can parse errors correctly
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      console.warn(`[Supabase Function] No active session found for ${functionName}. Invoking without Authorization header.`);
    }

    const supabaseUrl = (supabase as any).supabaseUrl || import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = (supabase as any).supabaseKey || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const functionUrl = `${supabaseUrl}/functions/v1/${functionName}`;

    // Extract headers from options but exclude Authorization to prevent conflicts
    // We want to strictly control the Authorization header based on the current session
    const { Authorization, authorization, ...customHeaders } = options.headers || {};

    const headers: Record<string, string> = {
      "apikey": supabaseKey,
      ...customHeaders
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Ensure Content-Type is set if body is present
    if (options.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    try {
      const response = await fetch(functionUrl, {
        method: options.method || 'POST',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      if (!response.ok) {
        // Handle non-2xx responses
        
        // Try to parse error body first to check for specific error messages
        let errorMsg = `Edge Function returned a non-2xx status code: ${response.status}`;
        let errorBody: any = null;
        try {
          errorBody = await response.json();
          if (errorBody && typeof errorBody === 'object') {
            if (errorBody.error) errorMsg = errorBody.error;
            else if (errorBody.message) errorMsg = errorBody.message;
            else errorMsg = JSON.stringify(errorBody);
          }
        } catch {
          // Fallback to text if JSON parse fails
          const textBody = await response.text();
          if (textBody) errorMsg = textBody;
        }

        // Check for 401 Unauthorized or "Invalid JWT" in the response
        const is401 = response.status === 401 || 
                      errorMsg.includes('Invalid JWT') || 
                      errorMsg.includes('Unauthorized') ||
                      errorMsg.includes('jwt expired');

        if (is401) {
          // Throw specific error to trigger retry logic
          throw new Error('401 Unauthorized');
        }
        
        return { data: null, error: new Error(errorMsg) };
      }

      // Success
      const data = await response.json();
      return { data, error: null };

    } catch (err: any) {
      // Check for 401 to trigger retry
      const is401 = err.message?.includes('401') || 
                    err.message?.includes('Unauthorized') ||
                    err.message?.includes('Invalid JWT') ||
                    err.message?.includes('jwt expired');

      if (!is401) {
        return { data: null, error: err };
      }
      
      console.warn(`[Supabase Function] 401/Invalid JWT for ${functionName}. Attempting session refresh...`);

      
      // 3. Refresh session
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !refreshData.session) {
        console.error('[Supabase Function] Session refresh failed:', refreshError);
        return { 
          data: null, 
          error: new Error('Session expired. Please log out and log in again.') 
        };
      }

      console.log('[Supabase Function] Session refreshed successfully. Retrying invocation...');

      // 4. Retry invocation
      const freshToken = refreshData.session.access_token;
      headers["Authorization"] = `Bearer ${freshToken}`;

      const retryResponse = await fetch(functionUrl, {
        method: options.method || 'POST',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      if (!retryResponse.ok) {
        let errorMsg = `Edge Function returned a non-2xx status code: ${retryResponse.status}`;
        try {
          const errorBody = await retryResponse.json();
           if (errorBody && typeof errorBody === 'object') {
            if (errorBody.error) errorMsg = errorBody.error;
            else if (errorBody.message) errorMsg = errorBody.message;
            else errorMsg = JSON.stringify(errorBody);
          }
        } catch {
           const textBody = await retryResponse.text();
           if (textBody) errorMsg = textBody;
        }
        return { data: null, error: new Error(errorMsg) };
      }

      const retryData = await retryResponse.json();
      return { data: retryData, error: null };
    }
  } catch (err) {
    return { data: null, error: err };
  }
}
