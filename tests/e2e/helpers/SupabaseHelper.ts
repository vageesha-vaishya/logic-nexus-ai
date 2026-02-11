
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env from root .env or .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') }); // Overrides .env if exists

export class SupabaseHelper {
    private static instance: SupabaseClient;

    public static getClient(): SupabaseClient {
        if (!this.instance) {
            const url = process.env.VITE_SUPABASE_URL;
            const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
            const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
            
            // Debug Log
            console.log('SupabaseHelper Init:');
            console.log('URL:', url);
            console.log('Service Key Present:', !!serviceKey);
            console.log('Anon Key Present:', !!anonKey);

            const key = serviceKey || anonKey;

            if (!url || !key) {
                throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
            }

            this.instance = createClient(url, key, {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                }
            });
        }
        return this.instance;
    }
}
