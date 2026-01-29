import { Database } from '@/integrations/supabase/types';

export type GLAccount = Database['finance']['Tables']['gl_accounts']['Row'];
export type GLAccountInsert = Database['finance']['Tables']['gl_accounts']['Insert'];
export type GLAccountUpdate = Database['finance']['Tables']['gl_accounts']['Update'];

export type JournalEntry = Database['finance']['Tables']['journal_entries']['Row'];
export type JournalEntryInsert = Database['finance']['Tables']['journal_entries']['Insert'];
export type JournalEntryUpdate = Database['finance']['Tables']['journal_entries']['Update'];
