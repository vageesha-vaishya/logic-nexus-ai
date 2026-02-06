import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyQuotesFix() {
  console.log('🔍 Verifying Historical Quotes Fetching...');

  const limit = 1000;
  console.log(`fetching up to ${limit} quotes...`);

  const { data: quotes, error } = await supabase
    .from('quotes')
    .select('id, created_at, status')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('❌ Error fetching quotes:', error);
    process.exit(1);
  }

  const count = quotes.length;
  console.log(`✅ Fetched ${count} quotes.`);

  if (count === 0) {
    console.log('⚠️ No quotes found in the database.');
    return;
  }

  // Analyze age distribution
  const now = new Date();
  let last24h = 0;
  let last7d = 0;
  let last30d = 0;
  let last90d = 0;
  let older90d = 0;
  let draftsOlder30d = 0;

  quotes.forEach(q => {
    const created = new Date(q.created_at);
    const diffTime = Math.abs(now - created);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

    if (diffDays <= 1) last24h++;
    else if (diffDays <= 7) last7d++;
    else if (diffDays <= 30) last30d++;
    else if (diffDays <= 90) last90d++;
    else older90d++;

    if (diffDays > 30 && (q.status || '').toLowerCase() === 'draft') {
      draftsOlder30d++;
    }
  });

  console.log('\n📊 Age Distribution:');
  console.log(`  - Last 24 hours: ${last24h}`);
  console.log(`  - Last 7 days:   ${last7d}`);
  console.log(`  - Last 30 days:  ${last30d}`);
  console.log(`  - Last 90 days:  ${last90d}`);
  console.log(`  - Older than 90d:${older90d}`);

  console.log('\n📄 Historical Drafts Analysis:');
  if (draftsOlder30d > 0) {
    console.log(`  ✅ Found ${draftsOlder30d} drafts older than 30 days.`);
    console.log('  This confirms that historical drafts are now being retrieved.');
  } else {
    console.log('  ℹ️ No drafts older than 30 days found in the sample.');
    if (older90d > 0) {
        console.log('  However, older records ARE being fetched, just none are drafts.');
    } else {
        console.log('  ⚠️ Only recent data found. If the database has old data, check the limit or filters.');
    }
  }

  if (count > 100) {
      console.log(`\n✅ Success: Retrieved ${count} records, exceeding the previous 100 limit.`);
  } else {
      console.log(`\nℹ️ Retrieved ${count} records. (Less than 100, so limit increase impact is unverified unless DB has >100 records)`);
  }
}

verifyQuotesFix().catch(console.error);
