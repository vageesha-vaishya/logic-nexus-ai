import { createClient } from '@supabase/supabase-js';
import { faker } from '@faker-js/faker';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const VENDOR_TYPES = [
  'ocean_carrier', 'air_carrier', 'trucker', 'rail_carrier',
  'courier', 'freight_forwarder', '3pl', 'warehouse',
  'customs_broker', 'agent', 'technology', 'manufacturing',
  'retail', 'wholesaler', 'consulting', 'other'
];

const LOGISTICS_TYPES = [
  'ocean_carrier', 'air_carrier', 'trucker', 'rail_carrier',
  'courier', 'freight_forwarder', '3pl', 'warehouse'
];

// Real-world Major Logistics Companies for realistic data
const REAL_WORLD_VENDORS = {
  ocean_carrier: [
    'Maersk Line', 'MSC Mediterranean Shipping Company', 'CMA CGM', 
    'COSCO Shipping', 'Hapag-Lloyd', 'Evergreen Marine', 
    'ONE (Ocean Network Express)', 'HMM', 'Yang Ming', 'ZIM'
  ],
  air_carrier: [
    'FedEx Express', 'UPS Airlines', 'DHL Aviation', 'Emirates SkyCargo', 
    'Cathay Pacific Cargo', 'Korean Air Cargo', 'Lufthansa Cargo', 
    'Qatar Airways Cargo', 'Cargolux', 'China Airlines Cargo'
  ],
  courier: [
    'DHL Express', 'FedEx', 'UPS', 'TNT', 'Aramex', 'Blue Dart', 
    'DPD', 'GLS', 'SF Express', 'Purolator'
  ],
  trucker: [
    'JB Hunt', 'XPO Logistics', 'Knight-Swift', 'Schneider National', 
    'Old Dominion Freight Line', 'YRC Worldwide', 'Landstar System', 
    'Werner Enterprises', 'Estes Express Lines', 'TFI International'
  ],
  freight_forwarder: [
    'Kuehne + Nagel', 'DHL Global Forwarding', 'DSV Panalpina', 
    'DB Schenker', 'Expeditors', 'Nippon Express', 'C.H. Robinson', 
    'Sinotrans', 'Hellmann Worldwide', 'Bolloré Logistics'
  ]
};

async function seedVendors() {
  console.log('🚀 Starting Comprehensive Vendor Seeding with Real-world Data...');
  
  // Fetch a valid tenant_id
  const { data: tenants } = await supabase.from('tenants').select('id').limit(1);
  const tenantId = tenants && tenants.length > 0 ? tenants[0].id : null;
  console.log(`ℹ️  Using Tenant ID: ${tenantId || 'Global (NULL)'}`);

  let createdCount = 0;
  let errors = 0;
  const createdVendors: { id: string; name: string; type: string }[] = [];
  const typeDistribution: Record<string, number> = {};

  // Helper to create a single vendor
  async function createVendor(name: string, type: string) {
    const vendorCode = name.substring(0, 3).toUpperCase() + '-' + faker.string.numeric(4);
    const isLogistics = LOGISTICS_TYPES.includes(type);

    // Operational Data (Logistics Focused)
    let operationalData = {};
    if (isLogistics) {
      operationalData = {
        fleet_size: faker.number.int({ min: 10, max: 500 }),
        vehicle_types: faker.helpers.arrayElements(['Semi-Trailer', 'Box Truck', 'Van', 'Reefer', 'Flatbed', 'Container Ship', 'Cargo Plane'], { min: 1, max: 3 }),
        regions_served: faker.helpers.arrayElements(['North America', 'Europe', 'Asia Pacific', 'LATAM', 'Middle East', 'Africa'], { min: 1, max: 4 }),
        tracking_capabilities: faker.helpers.arrayElements(['GPS', 'Real-time API', 'EDI', 'Manual Updates', 'IoT Sensors'], { min: 1, max: 3 }),
        warehouse_capacity_sqft: type === 'warehouse' ? faker.number.int({ min: 10000, max: 500000 }) : undefined,
        certifications: faker.helpers.arrayElements(['ISO 9001', 'C-TPAT', 'AEO', 'GDP', 'IATA'], { min: 0, max: 3 }),
        insurance_coverage: {
          provider: faker.company.name() + ' Insurance',
          policy_number: faker.string.alphanumeric(10).toUpperCase(),
          expiration_date: faker.date.future().toISOString(),
          liability_limit: faker.finance.amount({ min: 1000000, max: 10000000, dec: 0 })
        }
      };
      
      // Specific attributes for subtypes
      if (type === 'ocean_carrier') {
        operationalData = { ...operationalData, vessel_count: faker.number.int({ min: 50, max: 700 }), teu_capacity: faker.number.int({ min: 100000, max: 5000000 }) };
      } else if (type === 'air_carrier') {
         operationalData = { ...operationalData, aircraft_count: faker.number.int({ min: 20, max: 300 }), iata_code: faker.string.alpha(2).toUpperCase() };
      }
      
    } else if (type === 'manufacturing') {
       operationalData = {
         production_capacity: faker.number.int({ min: 1000, max: 100000 }) + ' units/month',
         lead_time_days: faker.number.int({ min: 7, max: 90 }),
         quality_standards: ['ISO 9001', 'Six Sigma']
       };
    }

    // Performance Metrics (Mock)
    const performanceMetrics = {
      on_time_delivery_rate: faker.number.float({ min: 80, max: 99, fractionDigits: 1 }),
      quality_rating: faker.number.float({ min: 3.5, max: 5.0, fractionDigits: 1 }),
      claim_ratio: faker.number.float({ min: 0, max: 2.0, fractionDigits: 2 })
    };

    const vendorData = {
      tenant_id: tenantId,
      name: name,
      code: vendorCode,
      type: type,
      status: 'active',
      contact_info: {
        phone: faker.phone.number(),
        email: faker.internet.email(),
        website: faker.internet.url(),
        address: {
          street: faker.location.streetAddress(),
          city: faker.location.city(),
          state: faker.location.state(),
          zip: faker.location.zipCode(),
          country: faker.location.country()
        }
      },
      compliance_data: {
        tax_id: faker.finance.routingNumber(),
        licenses: [faker.string.alphanumeric(8).toUpperCase()]
      },
      operational_data: operationalData,
      performance_metrics: performanceMetrics
    };

    try {
      // Check for duplicates
      const { data: existing } = await supabase.from('vendors').select('id, type').eq('name', name).single();
      
      const isRealWorld = Object.values(REAL_WORLD_VENDORS).flat().includes(name);

      if (existing) {
        if (isRealWorld && existing.type !== type) {
             console.log(`🔄 Updating Real-world Vendor ${name} (Fixing type: ${existing.type} -> ${type})`);
             const { error: updateError } = await supabase
               .from('vendors')
               .update({ 
                 type, 
                 operational_data: operationalData,
                 performance_metrics: performanceMetrics 
                })
               .eq('id', existing.id);
             
             if (updateError) throw updateError;
             return { id: existing.id, name, type, skipped: false, updated: true };
        }

        console.log(`⚠️  Vendor ${name} already exists. Skipping.`);
        return { id: existing.id, name, type, skipped: true };
      }

      const { data: newVendor, error } = await supabase.from('vendors').insert(vendorData).select().single();
      if (error) throw error;
      
      console.log(`✅ Created Vendor: ${name} (${type})`);
      
      // Create a Contract (Mock)
      if (faker.datatype.boolean()) {
          await supabase.from('vendor_contracts').insert({
            vendor_id: newVendor.id,
            title: `Master Service Agreement - ${new Date().getFullYear()}`,
            status: 'active',
            start_date: faker.date.past().toISOString(),
            end_date: faker.date.future().toISOString(),
            value: faker.finance.amount({ min: 10000, max: 1000000 }),
            currency: 'USD'
          });
      }

      return { id: newVendor.id, name, type, skipped: false };
    } catch (e: any) {
      console.error(`❌ Error creating ${name}:`, e.message);
      throw e;
    }
  }

  // 1. Seed Real-World Vendors
  for (const [type, names] of Object.entries(REAL_WORLD_VENDORS)) {
    for (const name of names) {
      try {
        const result = await createVendor(name, type);
        if (!result.skipped) {
          createdVendors.push(result);
          typeDistribution[type] = (typeDistribution[type] || 0) + 1;
          createdCount++;
        }
      } catch (e) {
        errors++;
      }
    }
  }

  // 2. Fill the rest with Faker data up to 100 total
  const TARGET_TOTAL = 100;
  const currentTotal = createdCount + Object.values(REAL_WORLD_VENDORS).flat().length; // Approximate check
  const REMAINING = Math.max(0, TARGET_TOTAL - currentTotal); // Just add some random ones

  // Let's explicitly add 30 random ones to ensure mix
  for (let i = 0; i < 30; i++) {
    const type = faker.helpers.arrayElement(VENDOR_TYPES);
    try {
      const result = await createVendor(faker.company.name(), type);
      if (!result.skipped) {
        createdVendors.push(result);
        typeDistribution[type] = (typeDistribution[type] || 0) + 1;
        createdCount++;
      }
    } catch (e) {
      errors++;
    }
  }

  // Generate Report
  const reportPath = path.join(__dirname, '..', 'docs', 'SEEDING_REPORT.md');
  const reportContent = `
# Comprehensive Vendor Seeding Report
**Date:** ${new Date().toLocaleString()}
**Total Created:** ${createdCount}
**Errors:** ${errors}

## Distribution by Type
${Object.entries(typeDistribution).map(([type, count]) => `- **${type}**: ${count}`).join('\n')}

## Created Vendors
| Name | Type | ID |
|------|------|----|
${createdVendors.map(v => `| ${v.name} | ${v.type} | ${v.id} |`).join('\n')}
  `;

  // Ensure docs dir exists
  const docsDir = path.join(__dirname, '..', 'docs');
  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir);

  fs.writeFileSync(reportPath, reportContent);

  // Save Transaction Log for Rollback
  const logsDir = path.join(__dirname, '..', 'logs');
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);
  const logPath = path.join(logsDir, `seed_vendors_${Date.now()}.json`);
  fs.writeFileSync(logPath, JSON.stringify(createdVendors.map(v => v.id), null, 2));

  console.log(`\n🎉 Seeding Complete!`);
  console.log(`   Created: ${createdCount}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Report saved to: ${reportPath}`);
  console.log(`   Rollback log saved to: ${logPath}`);
}

seedVendors().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
