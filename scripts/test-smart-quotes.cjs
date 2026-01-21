require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Simple check for env vars, assuming they are set in shell or .env
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://iutyqzjlpenfddqdwcsk.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY; 

if (!SUPABASE_KEY) {
    console.error("Missing SUPABASE_ANON_KEY, VITE_SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY. Please ensure .env file exists and contains one of these keys.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function validateResponse(scenarioName, data) {
    console.log(`\nValidating ${scenarioName} Response...`);
    const errors = [];

    if (!data.options || !Array.isArray(data.options)) {
        errors.push("Missing 'options' array");
    } else if (data.options.length !== 5) {
        errors.push(`Expected 5 options, got ${data.options.length}`);
    }

    if (!data.market_analysis) errors.push("Missing 'market_analysis'");
    if (typeof data.confidence_score !== 'number') errors.push("Missing or invalid 'confidence_score'");
    if (!data.anomalies || !Array.isArray(data.anomalies)) errors.push("Missing 'anomalies' array");

    if (errors.length > 0) {
        console.error(`❌ Validation Failed for ${scenarioName}:`);
        errors.forEach(e => console.error(`  - ${e}`));
        return false;
    } else {
        console.log(`✅ Validation Passed for ${scenarioName}`);
        
        // Detailed checks on first option
        const opt = data.options[0];
        if (opt) {
            console.log("  Sample Option Check:");
            console.log(`    - Tier: ${opt.tier}`);
            console.log(`    - Price: ${opt.price_breakdown?.total} ${opt.price_breakdown?.currency}`);
            console.log(`    - Reliability: ${opt.reliability?.score}`);
            console.log(`    - Source: ${opt.source_attribution}`);
        }
        return true;
    }
}

async function testSmartQuotes() {
  console.log('------------------------------------------------');
  console.log('Testing Scenario 1: Ocean Freight (Full Params)');
  
  const payload = {
    action: 'generate_smart_quotes',
    payload: {
      mode: 'ocean',
      origin: 'Shanghai, China (CNSHA)',
      destination: 'Los Angeles, USA (USLAX)',
      commodity: 'Consumer Electronics',
      weight: 5000,
      volume: 15,
      containerQty: 1,
      containerSize: '20ft',
      containerType: 'dry',
      dangerousGoods: false,
      specialHandling: 'Fragile',
      pickupDate: '2025-11-01',
      deliveryDeadline: '2025-11-30'
    }
  };

  try {
      const { data, error } = await supabase.functions.invoke('ai-advisor', {
        body: payload
      });

      if (error) {
        console.error('Function Error:', error);
        if (error.context) console.error('Context:', JSON.stringify(error.context, null, 2));
      } else {
        // console.log('Raw Result:', JSON.stringify(data, null, 2));
        validateResponse('Ocean Freight', data);
        if (data.anomalies && data.anomalies.length > 0) {
            console.log("  ⚠️ Anomalies Detected:", data.anomalies);
        }
      }
  } catch (e) {
      console.error("Invocation failed:", e);
  }
}

async function testAirFreight() {
    console.log('\n------------------------------------------------');
    console.log('Testing Scenario 2: Air Freight (Pharma/Cold Chain)');
    const payload = {
        action: 'generate_smart_quotes',
        payload: {
            mode: 'air',
            origin: 'London, UK (LHR)',
            destination: 'New York, USA (JFK)',
            commodity: 'Pharmaceuticals',
            weight: 200,
            volume: 1.5,
            dangerousGoods: false,
            specialHandling: 'Temperature Controlled',
            pickupDate: '2025-10-15',
            deliveryDeadline: '2025-10-18' // Tight deadline
        }
    };

    try {
        const { data, error } = await supabase.functions.invoke('ai-advisor', {
            body: payload
        });

        if (error) {
            console.error('Function Error:', error);
        } else {
            validateResponse('Air Freight', data);
            if (data.anomalies && data.anomalies.length > 0) {
                console.log("  ⚠️ Anomalies Detected:", data.anomalies);
            }
        }
    } catch (e) {
        console.error("Invocation failed:", e);
    }
}

async function runTests() {
    await testSmartQuotes();
    await testAirFreight();
}

runTests();
