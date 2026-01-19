
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://iutyqzjlpenfddqdwcsk.supabase.co";
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1dHlxempscGVuZmRkcWR3Y3NrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NjQ4MjMsImV4cCI6MjA4NDI0MDgyM30.90USeHOMTy-Nz7AFZIwZ3s75AO5ch9uFgSHTDbmbWQw";

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
