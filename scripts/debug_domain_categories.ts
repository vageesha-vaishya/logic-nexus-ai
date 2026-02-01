
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Create an anon client to test RLS
const supabaseAnon = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY || '');

async function debug() {
  console.log('Debugging Domain Categories...\n');

  // 1. Find the domain with the description from the screenshot
  const descriptionSnippet = 'Transportation, Warehousing, and Freight Management';
  console.log(`Searching for domain with description like "${descriptionSnippet}"...`);
  
  const { data: domains, error: domainError } = await supabase
    .from('platform_domains')
    .select('*')
    .ilike('description', `%${descriptionSnippet}%`);

  if (domainError) {
    console.error('Error fetching domain:', domainError);
    return;
  }

  if (!domains || domains.length === 0) {
    console.log('No domain found with that exact description. Listing all domains:');
    const { data: allDomains } = await supabase.from('platform_domains').select('id, name, description');
    if (allDomains) {
        allDomains.forEach(d => console.log(`- [${d.id}] ${d.name}: ${d.description}`));
    }
    return;
  }

  const domain = domains[0];
  console.log(`Found Domain: ${domain.name} (ID: ${domain.id})`);

  // 2. Check categories for this domain ID (Service Role)
  console.log(`\nChecking service_categories for domain_id = ${domain.id} (Service Role)...`);
  const { data: categories, error: catError } = await supabase
    .from('service_categories')
    .select('*')
    .eq('domain_id', domain.id);

  if (catError) {
    console.error('Error fetching categories:', catError);
  } else {
    console.log(`Found ${categories.length} categories.`);
    categories.forEach(c => {
        console.log(`- ${c.name} (Code: ${c.code}, Active: ${c.is_active})`);
    });
  }

  // 3. Check categories for this domain ID (Anon Role - Simulating Frontend)
  console.log(`\nChecking service_categories for domain_id = ${domain.id} (Anon Role)...`);
  const { data: categoriesAnon, error: catAnonError } = await supabaseAnon
    .from('service_categories')
    .select('*')
    .eq('domain_id', domain.id);

  if (catAnonError) {
    console.error('Error fetching categories (Anon):', catAnonError);
  } else {
    console.log(`Found ${categoriesAnon.length} categories (Anon).`);
    if (categoriesAnon.length === 0) {
        console.log('!!! RLS ISSUE DETECTED: Service Role sees data, but Anon/Frontend does not. !!!');
    }
  }
}

debug();
