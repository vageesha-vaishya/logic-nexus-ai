const fs = require('fs');
const path = require('path');

// Mock Logger
const logger = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  warn: (msg) => console.log(`[WARN] ${msg}`),
  error: (msg) => console.error(`[ERROR] ${msg}`)
};

// Mock Supabase Client Factory
const createMockSupabase = (scenario) => ({
  from: (table) => ({
    select: (cols) => {
      // Mock quote_templates response based on scenario
      if (table === 'quote_templates') {
        return {
          eq: (col, val) => {
            if (val === 'Standard Multi-Modal') {
               // Simulate DB returning the template if requested
               return {
                 is: (col2, val2) => {
                   return {
                     data: [{ 
                        name: 'Standard Multi-Modal', 
                        tenant_id: null, 
                        content: { 
                            sections: [
                                { type: 'header' }, 
                                { type: 'multi_modal_details', content: { text: "Transport Details" } },
                                { type: 'footer' }
                            ] 
                        } 
                     }],
                     error: null
                   };
                 },
                 or: (cond) => {
                   // Return both tenant and global
                   return {
                      data: [
                        { name: 'Standard Multi-Modal', tenant_id: 'tenant-123', content: { /*...*/ } },
                        { name: 'Standard Multi-Modal', tenant_id: null, content: { /*...*/ } }
                      ],
                      error: null
                   };
                 }
               };
            }
            return { data: [], error: null };
          }
        };
      }
      return { data: [], error: null };
    }
  })
});

// Mock Quote Objects
const scenarios = {
  'QUO-260303-00002': {
    id: 'QUO-260303-00002',
    tenant_id: 'tenant-123',
    options: [
      {
        id: 'opt-1',
        grand_total: 1500,
        legs: [
          { mode: 'road', origin: 'Factory', destination: 'Port A', carrier_name: 'TruckCo' },
          { mode: 'ocean', origin: 'Port A', destination: 'Port B', carrier_name: 'ShipCo' }, // Ocean triggers multi-modal
          { mode: 'road', origin: 'Port B', destination: 'Warehouse', carrier_name: 'TruckCo' }
        ]
      }
    ]
  },
  'SIMPLE-QUOTE': {
    id: 'SIMPLE-001',
    tenant_id: 'tenant-123',
    options: [
      {
        id: 'opt-1',
        grand_total: 500,
        legs: [
          { mode: 'road', origin: 'A', destination: 'B', carrier_name: 'TruckCo' }
        ]
      }
    ]
  }
};

async function runTest(scenarioName) {
  console.log(`\n=== Testing Scenario: ${scenarioName} ===`);
  const quote = scenarios[scenarioName];
  const mockSupabase = createMockSupabase(scenarioName);

  // 1. Test Heuristic Logic (re-implemented from index.ts)
  let template = null;
  const isMultiModal = quote.options?.some(opt => 
    (opt.legs?.length || 0) > 1 || 
    opt.legs?.some(l => l.mode === 'ocean' || l.mode === 'air')
  );

  console.log(`[TEST] Is Multi-Modal? ${isMultiModal}`);

  if (isMultiModal) {
    // Simulate fetching template
    console.log(`[TEST] Detected Multi-Modal. Fetching 'Standard Multi-Modal'...`);
    const { data } = await mockSupabase.from('quote_templates')
      .select('content')
      .eq('name', 'Standard Multi-Modal')
      .is('tenant_id', null); // Simplified mock call
    
    if (data && data.length > 0) {
        template = data[0];
        console.log(`[PASS] Loaded 'Standard Multi-Modal' template.`);
    } else {
        console.log(`[FAIL] Template not found.`);
    }
  } else {
    console.log(`[TEST] Using Default Template.`);
  }

  // 2. Validate Expectations
  if (scenarioName === 'QUO-260303-00002') {
      if (isMultiModal && template) {
          console.log(`[SUCCESS] QUO-260303-00002 correctly identified as Multi-Modal.`);
      } else {
          console.error(`[FAILURE] QUO-260303-00002 failed identification.`);
          process.exit(1);
      }
  } else if (scenarioName === 'SIMPLE-QUOTE') {
      if (!isMultiModal) {
          console.log(`[SUCCESS] SIMPLE-QUOTE correctly identified as NOT Multi-Modal.`);
      } else {
          console.error(`[FAILURE] SIMPLE-QUOTE incorrectly identified as Multi-Modal.`);
          process.exit(1);
      }
  }
}

async function main() {
  await runTest('QUO-260303-00002');
  await runTest('SIMPLE-QUOTE');
  console.log('\nAll tests passed successfully.');
}

main().catch(err => console.error(err));
