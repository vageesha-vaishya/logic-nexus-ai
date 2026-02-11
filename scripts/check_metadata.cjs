
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMetadata() {
  console.log('Checking container_sizes...');
  const { data: sizes, error: sizesError } = await supabase.from('container_sizes').select('*').limit(3);
  if (sizesError) console.log('Error container_sizes:', sizesError.message);
  else console.log('Sizes:', sizes);

  console.log('Checking container_types...');
  const { data: types, error: typesError } = await supabase.from('container_types').select('*').limit(3);
  if (typesError) console.log('Error container_types:', typesError.message);
  else console.log('Types:', types);

  console.log('Checking package_types / categories...');
  // Guessing table name
  const { data: pkgs, error: pkgsError } = await supabase.from('package_types').select('*').limit(3);
  if (pkgsError) console.log('Error package_types:', pkgsError.message);
  else console.log('Packages:', pkgs);
}

checkMetadata();
