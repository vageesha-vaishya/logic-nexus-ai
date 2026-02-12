
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixQuoteVisibility() {
  const quoteNumber = 'MGL-SYS-1770819021371';
  const targetTenantId = 'fbb1e554-6cf5-4091-b351-962db415efb2'; // Tenant001
  const targetFranchiseId = 'a1dc18d7-ef5b-41e8-814b-fa6b94493ae8'; // Franchise001OfTenanant001

  console.log(`Fixing visibility for quote: ${quoteNumber}`);

  // 1. Fetch Quote
  const { data: quotes, error: quoteError } = await supabase
    .from('quotes')
    .select('*')
    .eq('quote_number', quoteNumber);

  if (quoteError || !quotes || quotes.length === 0) {
    console.error('Quote not found or error:', quoteError);
    return;
  }

  const quote = quotes[0];
  console.log(`Found quote: ${quote.id}`);
  console.log(`Current Quote Tenant: ${quote.tenant_id}, Franchise: ${quote.franchise_id}`);

  // 2. Update Quote Franchise
  const { error: updateQuoteError } = await supabase
    .from('quotes')
    .update({ franchise_id: targetFranchiseId })
    .eq('id', quote.id);

  if (updateQuoteError) {
    console.error('Error updating quote franchise:', updateQuoteError);
  } else {
    console.log(`Updated quote franchise to: ${targetFranchiseId}`);
  }

  // 3. Fix Account
  const accountId = quote.account_id;
  if (accountId) {
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', accountId)
      .single();

    if (accountError) {
        console.error('Error fetching account:', accountError);
    } else {
        console.log(`Found Account: ${account.name} (${account.id})`);
        console.log(`Current Account Tenant: ${account.tenant_id}, Franchise: ${account.franchise_id}`);

        if (account.tenant_id !== targetTenantId || account.franchise_id !== targetFranchiseId) {
            const { error: updateAccountError } = await supabase
                .from('accounts')
                .update({ 
                    tenant_id: targetTenantId,
                    franchise_id: targetFranchiseId
                })
                .eq('id', accountId);

            if (updateAccountError) {
                console.error('Error updating account:', updateAccountError);
            } else {
                console.log(`Updated account to Tenant: ${targetTenantId}, Franchise: ${targetFranchiseId}`);
            }
        } else {
            console.log('Account is already in correct scope.');
        }
    }
  } else {
      console.log('No account associated with this quote.');
  }
}

fixQuoteVisibility().catch(console.error);
