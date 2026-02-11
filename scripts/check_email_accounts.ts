
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: accounts, error } = await supabase.from('email_accounts').select('*');
  if (error) {
    console.error('Error fetching accounts:', error);
  } else {
    console.log('Email Accounts:', accounts);
  }

  const { data: templates, error: tError } = await supabase.from('quote_templates').select('id, name');
  if (tError) {
      console.error('Error fetching templates:', tError);
  } else {
      console.log('Quote Templates:', templates);
  }
}

check();
