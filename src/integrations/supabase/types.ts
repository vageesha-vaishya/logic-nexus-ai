export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Placeholder Database type to enable typed Supabase client.
// Replace this file with generated types from:
// npx supabase gen types typescript --project-id pqulscbawoqzhqobwupu > src/integrations/supabase/types.ts
export type Database = {
  __InternalSupabase?: {
    PostgrestVersion?: string;
  };
  public: {
    Tables: Record<string, unknown>;
    Views: Record<string, unknown>;
    Functions: Record<string, unknown>;
    Enums: Record<string, string | number | null>;
    CompositeTypes: never;
  };
};