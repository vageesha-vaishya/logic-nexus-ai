
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAccount() {
  const { data, error } = await supabase
    .from('email_accounts')
    .select('*')
    .eq('email_address', 'vimal.bahuguna@miapps.co');

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Account found:', data);
  }
}

checkAccount();
