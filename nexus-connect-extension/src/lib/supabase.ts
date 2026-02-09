
import { createClient } from '@supabase/supabase-js';

// Use the same credentials as the main app
const SUPABASE_URL = "https://gzhxgoigflftharcmdqj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6aHhnb2lnZmxmdGhhcmNtZHFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MTk2ODcsImV4cCI6MjA4NTA5NTY4N30.6xIZ3VYubUZ73pNPurzYuf-2RUpXj_9w-LpU-6d6kqU";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage, // Works in Side Panel / Popup
    persistSession: true,
    autoRefreshToken: true,
  }
});
