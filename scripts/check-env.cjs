require('dotenv').config({ path: '.env' });
console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL);
console.log('SUPABASE_DB_URL:', process.env.SUPABASE_DB_URL ? process.env.SUPABASE_DB_URL.replace(/:[^:@]+@/, ':***@') : 'undefined');
