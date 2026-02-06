seconst { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedTaricData() {
  console.log('Starting TARIC data seeding...');

  // 1. Get Global Roots
  const { data: roots, error: rootsError } = await supabase
    .from('global_hs_roots')
    .select('*')
    .limit(50);

  if (rootsError) {
    console.error('Error fetching global roots:', rootsError);
    return;
  }

  console.log(`Fetched ${roots.length} global roots.`);

  let insertedCount = 0;

  for (const root of roots) {
    // Check if TARIC code already exists for this root
    const { count, error: checkError } = await supabase
      .from('taric_codes')
      .select('*', { count: 'exact', head: true })
      .eq('global_hs_root_id', root.id);

    if (checkError) {
      console.error('Error checking existing TARIC:', checkError);
      continue;
    }

    if (count > 0) {
      // Already has TARIC, skip
      continue;
    }

    // Generate TARIC data
    // TARIC is usually 10 digits. Root is 6 digits.
    // We'll append '0000' for the base TARIC code (general case)
    // and maybe '1000' or '9000' for variations if we wanted complexity, but let's stick to base.
    const taricCode = `${root.hs6_code}0000`;
    const cnCode = `${root.hs6_code}00`; // 8 digits

    const taricEntry = {
      taric_code: taricCode,
      // hs6_code is generated
      // cn_code is generated
      // chapter and heading are generated columns
      description: `${root.description} (EU Import Standard)`,
      global_hs_root_id: root.id,
      attributes: {
        duty_rates: [
          { type: "Third country duty", rate: "6.5%" }, // Mock rate
          { type: "VAT", rate: "20%" } // Mock VAT
        ],
        regulations: ["R2658/87"]
      }
    };

    const { error: insertError } = await supabase
      .from('taric_codes')
      .insert(taricEntry);

    if (insertError) {
      console.error(`Error inserting TARIC ${taricCode}:`, insertError);
    } else {
      console.log(`Inserted TARIC ${taricCode}`);
      insertedCount++;
    }
  }

  console.log(`Seeding complete. Inserted ${insertedCount} new TARIC codes.`);
}

seedTaricData();
