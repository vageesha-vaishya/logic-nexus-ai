
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function verify() {
  console.log('--- Platform Domains ---');
  const { data: domains, error: domainError } = await supabase.from('platform_domains').select('*').order('name');
  if (domainError) { console.error(domainError); return; }
  console.table(domains.map(d => ({ key: d.key, name: d.name, id: d.id })));

  console.log('\n--- Service Categories (with Domain) ---');
  const { data: cats, error: catError } = await supabase
    .from('service_categories')
    .select('code, name, domain_id')
    .order('name');
  if (catError) { console.error(catError); return; }
  
  // Map domain IDs to names
  const domainMap = {};
  domains.forEach(d => domainMap[d.id] = d.name);

  console.table(cats.map(c => ({
    code: c.code,
    name: c.name,
    domain: domainMap[c.domain_id] || 'NULL'
  })));

  console.log('\n--- Service Types (Sample) ---');
  const { data: types, error: typeError } = await supabase
    .from('service_types')
    .select('code, name, category_id')
    .order('name');
  if (typeError) { console.error(typeError); return; }

  // Map category IDs to names
  const catMap = {};
  cats.forEach(c => catMap[c.id] = c.name); // Need to fetch IDs for categories first? Yes.
  
  // Fetch categories with IDs
  const { data: catsWithIds } = await supabase.from('service_categories').select('id, name');
  catsWithIds.forEach(c => catMap[c.id] = c.name);

  console.table(types.map(t => ({
    code: t.code,
    name: t.name,
    category: catMap[t.category_id] || 'NULL'
  })).filter(t => ['Savings Account', 'Fiber Optic Internet', 'Product Listing'].includes(t.name) || !t.category));
  
  console.log('Verification Complete.');
}

verify();
