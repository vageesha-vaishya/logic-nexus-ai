
import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl || '', supabaseServiceKey || '');

describe('Exec SQL RPC Verification', () => {
  it('should have execute_sql_query RPC accessible', async () => {
    if (!supabaseUrl) return;
    const { data, error } = await supabase.rpc('execute_sql_query', { sql_query: 'SELECT 1' });
    if (error) console.error('execute_sql_query error:', error);
    expect(error).toBeNull();
  });
});
