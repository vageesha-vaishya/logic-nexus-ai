import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function runTests() {
  console.log('Starting Domain Integrity Tests...');
  let errors = [];

  try {
    // 1. Check Platform Domains
    const requiredDomains = ['banking', 'ecommerce', 'telecom'];
    const { data: domains, error: domainError } = await supabase
      .from('platform_domains')
      .select('id, key, name');
    
    if (domainError) throw domainError;

    const domainKeys = domains.map(d => d.key);
    requiredDomains.forEach(key => {
      if (!domainKeys.includes(key)) {
        errors.push(`Missing required domain: ${key}`);
      }
    });

    // 2. Check Service Categories linkage
    const domainMap = domains.reduce((acc, d) => ({ ...acc, [d.id]: d.key }), {});
    
    const { data: categories, error: catError } = await supabase
      .from('service_categories')
      .select('id, name, domain_id, code');
    
    if (catError) throw catError;

    // Check specific categories exist for Banking
    const bankingId = domains.find(d => d.key === 'banking')?.id;
    if (bankingId) {
      const bankingCats = categories.filter(c => c.domain_id === bankingId);
      if (bankingCats.length === 0) errors.push('No categories found for banking domain');
      
      const expectedCodes = ['banking_accounts', 'banking_loans', 'banking_payments'];
      expectedCodes.forEach(code => {
        if (!bankingCats.find(c => c.code === code)) {
          errors.push(`Missing expected banking category: ${code}`);
        }
      });
    }

    // 3. Check Service Types linkage
    const { data: types, error: typeError } = await supabase
      .from('service_types')
      .select('id, name, category_id, mode_id');
    
    if (typeError) throw typeError;

    // Check at least one type exists for 'banking_accounts'
    const accountCat = categories.find(c => c.code === 'banking_accounts');
    if (accountCat) {
      const accountTypes = types.filter(t => t.category_id === accountCat.id);
      if (accountTypes.length === 0) {
        errors.push(`No service types found for category: ${accountCat.name}`);
      }
    }

  } catch (err) {
    errors.push(`Exception during test execution: ${err.message}`);
  }

  if (errors.length > 0) {
    console.error('❌ Tests Failed:');
    errors.forEach(e => console.error(`- ${e}`));
    process.exit(1);
  } else {
    console.log('✅ All Domain Integrity Tests Passed');
    process.exit(0);
  }
}

runTests();
