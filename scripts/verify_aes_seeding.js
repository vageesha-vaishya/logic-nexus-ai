import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

// Use service role key to bypass RLS for verification
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyAesSeeding() {
  console.log('Verifying AES-AESTIR Appendix D Seeding...');

  try {
    // 1. Check if column exists (by trying to select it)
    const { data: sample, error: colError } = await supabase
      .from('ports_locations')
      .select('schedule_d_code')
      .limit(1);

    if (colError) {
      console.error('Error checking column:', colError.message);
      return;
    }
    console.log('Column schedule_d_code exists.');

    // 2. Count total ports
    const { count: totalCount, error: countError } = await supabase
      .from('ports_locations')
      .select('*', { count: 'exact', head: true });

    if (countError) throw countError;

    // 3. Count ports with schedule_d_code
    const { count: seededCount, error: seededError } = await supabase
      .from('ports_locations')
      .select('*', { count: 'exact', head: true })
      .not('schedule_d_code', 'is', null);

    if (seededError) throw seededError;

    console.log(`Total Ports: ${totalCount}`);
    console.log(`Ports with Schedule D Code: ${seededCount}`);

    // 4. Sample verification
    const { data: samples, error: sampleError } = await supabase
      .from('ports_locations')
      .select('location_name, schedule_d_code, port_type, city, state_province')
      .not('schedule_d_code', 'is', null)
      .limit(10);

    if (sampleError) throw sampleError;

    console.log('\nSample Seeded Data:');
    console.table(samples);

    // 5. Check specific known ports with Mode validation
    const checks = [
      { name: 'NEW YORK, NY', code: '1001' },
      { name: 'PORTLAND, ME', code: '0101', hasMode: 'Vessel' },
      { name: 'BOSTON, MA', code: '0401', hasMode: 'Air' },
      { name: 'LOS ANGELES, CA', code: '2704', hasMode: 'Vessel' },
      { name: 'JACKMAN, ME', code: '0104', hasMode: 'Rail' }
    ];

    console.log('\nSpot Checks:');
    for (const check of checks) {
      // Try to find by name first
      const { data: match, error: matchError } = await supabase
        .from('ports_locations')
        .select('schedule_d_code, port_type')
        .ilike('location_name', check.name)
        .eq('schedule_d_code', check.code)
        .maybeSingle();

      if (match) {
        let modeCheck = true;
        if (check.hasMode && (!match.port_type || !match.port_type.includes(check.hasMode))) {
            modeCheck = false;
        }
        
        if (modeCheck) {
             console.log(`[OK] ${check.name} has code ${match.schedule_d_code} and mode ${check.hasMode || '(any)'}`);
        } else {
             console.log(`[FAIL] ${check.name} has code ${match.schedule_d_code} but MISSING mode ${check.hasMode}. Found: ${match.port_type}`);
        }
      } else {
        // Try to find by code (any port with this code)
        const { data: byCode, error: byCodeError } = await supabase
          .from('ports_locations')
          .select('location_name, schedule_d_code')
          .eq('schedule_d_code', check.code)
          .limit(1); // Just get one if multiple exist

        if (byCode && byCode.length > 0) {
            console.log(`[OK] Code ${check.code} found for '${byCode[0].location_name}' (Matches ${check.name})`);
        } else {
            // Try to find what it DOES have by name
            const { data: actual } = await supabase
              .from('ports_locations')
              .select('schedule_d_code')
              .ilike('location_name', check.name)
              .maybeSingle();
            
            if (actual) {
                console.log(`[FAIL] ${check.name}: Expected ${check.code}, found ${actual.schedule_d_code}`);
            } else {
                console.log(`[FAIL] ${check.name}: Not found in DB by name or code`);
            }
        }
      }
    }

    // 6. Check Audit Logs
    console.log('\nChecking Audit Logs for Seeding Event...');
    const { data: logs, error: logError } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('action', 'SEED_DATA')
      .eq('resource_type', 'ports_locations')
      .order('created_at', { ascending: false })
      .limit(1);

    if (logError) {
      console.error('Error checking audit logs:', logError.message);
    } else if (logs && logs.length > 0) {
      console.log('[OK] Audit log found:');
      console.log(logs[0].details);
    } else {
      console.log('[WARN] No audit log found for seeding.');
    }

  } catch (err) {
    console.error('Verification failed:', err);
  }
}

verifyAesSeeding();
