const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log('Checking HTS codes...');
    const { data: hts, error: htsError } = await supabase
        .from('aes_hts_codes')
        .select('id, hts_code')
        .in('hts_code', ['8471.30.01.00', '6403.99.60.50', '6109.10.00.04']);

    if (htsError) console.error(htsError);
    console.log('HTS Codes:', hts);

    if (hts && hts.length > 0) {
        const ids = hts.map(h => h.id);
        console.log('Checking Duty Rates for IDs:', ids);
        
        const { data: rates, error: ratesError } = await supabase
            .from('duty_rates')
            .select('*')
            .in('aes_hts_id', ids);
            
        if (ratesError) console.error(ratesError);
        console.log('Duty Rates:', rates);
    }
}

checkData();