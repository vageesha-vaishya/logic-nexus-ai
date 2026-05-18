import { useAuth } from './useAuth';

/**
 * Thin wrapper that exposes just the Supabase session from AuthContext.
 * Use this when you only need the session token (e.g. for API calls).
 */
export function useSession() {
  const { session } = useAuth();
  return { session };
}
