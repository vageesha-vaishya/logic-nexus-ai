
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkQuote() {
  const quoteNumber = 'MGL-SYS-1770819021371';
  console.log(`Checking quote: ${quoteNumber}`);

  // Check quotes table
  const { data: quotes, error: quotesError } = await supabase
    .from('quotes')
    .select('*, accounts(*)')
    .ilike('quote_number', `%${quoteNumber}%`);

  if (quotesError) {
    console.error('Error checking quotes table:', quotesError);
  } else {
    console.log(`Found ${quotes.length} matches in quotes table:`);
    quotes.forEach(q => {
      console.log(`- ID: ${q.id}`);
      console.log(`  Quote Number: ${q.quote_number}`);
      console.log(`  Tenant ID: ${q.tenant_id}`);
      console.log(`  Franchise ID: ${q.franchise_id}`);
      console.log(`  Status: ${q.status}`);
      console.log(`  Account ID: ${q.account_id}`);
      if (q.accounts) {
        console.log(`  Account Name: ${q.accounts.company_name}`);
        console.log(`  Account Tenant ID: ${q.accounts.tenant_id}`);
      } else {
        console.log(`  Account: Not found or not accessible via relation`);
      }
    });
  }

  // Check quotation_versions table
  const { data: versions, error: versionsError } = await supabase
    .from('quotation_versions')
    .select('*');
    
  if (versionsError) {
      // Table might not exist or error accessing it
      // console.error('Error fetching quotation_versions:', versionsError); 
  } else {
      // Filter manually if needed or just check if any exist
      // Since we don't know the schema fully, let's just see if we can find it by ID if the quote ID was found
      if (quotes && quotes.length > 0) {
          const quoteId = quotes[0].id;
          const { data: quoteVersions } = await supabase
            .from('quotation_versions')
            .select('*')
            .eq('quote_id', quoteId);
          console.log(`Found ${quoteVersions?.length} versions for quote ID ${quoteId}`);
      }
  }

  // Check if there is an 'emails' table and if the subject contains the quote number
  const { data: emails, error: emailsError } = await supabase
    .from('emails')
    .select('*')
    .ilike('subject', `%${quoteNumber}%`)
    .limit(5);

  if (emailsError) {
    console.error('Error fetching emails:', emailsError);
  } else {
    console.log(`Found ${emails?.length} emails with subject matching ${quoteNumber}`);
    if (emails && emails.length > 0) {
      console.log('Email details:', JSON.stringify(emails[0], null, 2));
    }
  }
}

checkQuote();
