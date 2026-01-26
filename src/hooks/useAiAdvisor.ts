import { useCRM } from '@/hooks/useCRM';
import { supabase } from '@/integrations/supabase/client';

export interface AiAdvisorResponse<T = any> {
  data: T | null;
  error: any | null;
}

export interface AiAdvisorOptions {
  action: string;
  payload: any;
}

export function useAiAdvisor() {
  const { session } = useCRM();

  const invokeAiAdvisor = async <T = any>({ action, payload }: AiAdvisorOptions): Promise<AiAdvisorResponse<T>> => {
    const projectUrl = import.meta.env.VITE_SUPABASE_URL;
    let anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    // Safety: Strip quotes if present (common env issue)
    if (anonKey && (anonKey.startsWith('"') || anonKey.startsWith("'"))) {
        anonKey = anonKey.slice(1, -1);
    }

    const functionUrl = `${projectUrl}/functions/v1/ai-advisor`;

    let sessionToken = session?.access_token;
    if (!sessionToken) {
        try {
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            sessionToken = currentSession?.access_token;
        } catch (e) {
            console.warn("Failed to get session for AI Advisor", e);
        }
    }

    if (!anonKey) {
        console.error("Missing Supabase Anon/Publishable Key");
        return { data: null, error: new Error("Configuration Error: Missing API Key") };
    }

    // Function to perform the fetch
    const doFetch = async (token: string | null | undefined, useAnon: boolean) => {
        const keyToUse = useAnon ? anonKey : (token || anonKey);
        // console.log(`[AI-Advisor] Calling ${functionUrl} (${useAnon ? 'Anon' : 'User Auth'})`);

        return fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${keyToUse}`,
                'apikey': anonKey
            },
            body: JSON.stringify({ action, payload })
        });
    };

    try {
        // 1. Try with User Token (if available)
        let response;
        if (sessionToken) {
            response = await doFetch(sessionToken, false);
            
            // If 401, retry with Anon Key
            if (response.status === 401) {
                console.warn("[AI-Advisor] User token rejected (401). Retrying with Anon Key...");
                response = await doFetch(anonKey, true);
            }
        } else {
            // No session, try Anon Key directly
            console.warn("[AI-Advisor] No active session. Using Anon Key.");
            response = await doFetch(anonKey, true);
        }

        if (!response.ok) {
            const errorText = await response.text();
            // Try to parse JSON error if possible
            try {
                const errJson = JSON.parse(errorText);
                return { data: null, error: { message: errJson.error || errorText, status: response.status } };
            } catch (e) {
                 return { data: null, error: { message: `Function returned ${response.status}: ${errorText}`, status: response.status } };
            }
        }

        const data = await response.json();
        return { data, error: null };
    } catch (err) {
        console.error("AI Advisor Invocation Error:", err);
        return { data: null, error: err };
    }
  };

  return { invokeAiAdvisor };
}
