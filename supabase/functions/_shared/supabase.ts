/// <reference path="../types.d.ts" />
import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  /**
   * @deprecated
   * Please use `serveWithLogger` which injects `supabase` (admin client) instead.
   * This function bypasses RLS if used improperly and lacks logging context.
   */
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
