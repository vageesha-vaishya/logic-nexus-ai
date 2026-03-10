
import { createClient } from '@supabase/supabase-js';

declare global {
  interface ImportMeta {
    readonly env: Record<string, string | undefined>;
  }
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage, // Works in Side Panel / Popup
    persistSession: true,
    autoRefreshToken: true,
  }
});
