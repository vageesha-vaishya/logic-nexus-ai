/**
 * Seed Enterprise Data Script
 * 
 * Run this to insert tools and AD/SB directives directly via Supabase JS client
 * 
 * Usage:
 * node seed-enterprise-data.mjs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Required: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const TENANT_ID = '0ff7c47d-c013-49a2-8c7f-4462f4e50e02'; // Deccan tenant

async function seedTools() {
  console.log('\n📦 Seeding Tools Registry...');
  
  const tools = [
    { tool_code: 'TOOL-TW-500', tool_name: 'Digital Torque Wrench 500', manufacturer: 'Snap-on', model_number: 'ECF500', tool_category: 'hand_tool', tool_type: 'Torque Wrench', calibration_required: true, calibration_interval_days: 180, calibration_standard: 'ISO 6789', specifications: { measurement_range: '50-500 in-lbs', accuracy: '±2%', weight: 1.2 }, currency: 'USD', purchase_cost: 850.00, regulatory_approvals: ['FAA', 'EASA'] },
    { tool_code: 'TOOL-TW-1000', tool_name: 'Digital Torque Wrench 1000', manufacturer: 'Snap-on', model_number: 'ECF1000', tool_category: 'hand_tool', tool_type: 'Torque Wrench', calibration_required: true, calibration_interval_days: 180, calibration_standard: 'ISO 6789', specifications: { measurement_range: '100-1000 in-lbs', accuracy: '±1.5%', weight: 1.8 }, currency: 'USD', purchase_cost: 1150.00, regulatory_approvals: ['FAA', 'EASA'] },
    { tool_code: 'TOOL-SK-SET', tool_name: 'Socket Set Complete', manufacturer: 'Craftsman', model_number: 'SK-200', tool_category: 'hand_tool', tool_type: 'Socket Set', calibration_required: false, calibration_interval_days: 0, specifications: { pieces: 200 }, currency: 'USD', purchase_cost: 350.00, regulatory_approvals: ['FAA'] },
    { tool_code: 'TOOL-PD-750', tool_name: 'Pneumatic Drill', manufacturer: 'Chicago Pneumatic', model_number: 'CP750', tool_category: 'power_tool', tool_type: 'Drill', calibration_required: true, calibration_interval_days: 365, calibration_standard: 'ANSI B186.9', specifications: { power: '0.5 HP', speed: '1800 RPM' }, currency: 'USD', purchase_cost: 650.00, regulatory_approvals: ['FAA', 'EASA'] },
    { tool_code: 'TOOL-AG-400', tool_name: 'Air Grinder', manufacturer: 'Ingersoll Rand', model_number: 'AG-400', tool_category: 'power_tool', tool_type: 'Grinder', calibration_required: true, calibration_interval_days: 365, calibration_standard: 'ANSI B186.9', specifications: { power: '0.7 HP', speed: '20000 RPM' }, currency: 'USD', purchase_cost: 480.00, regulatory_approvals: ['FAA'] },
    { tool_code: 'TOOL-MLG-1000', tool_name: 'Magnetic Level Gauge', manufacturer: 'Fluke', model_number: 'MLG-1000', tool_category: 'test_equipment', tool_type: 'Level Gauge', calibration_required: true, calibration_interval_days: 365, calibration_standard: 'NIST', specifications: { range: '0-100%', accuracy: '±0.5%' }, currency: 'USD', purchase_cost: 1200.00, regulatory_approvals: ['FAA', 'EASA'] },
    { tool_code: 'TOOL-MT-500', tool_name: 'Multimeter Digital', manufacturer: 'Fluke', model_number: '87V', tool_category: 'test_equipment', tool_type: 'Multimeter', calibration_required: true, calibration_interval_days: 365, calibration_standard: 'NIST', specifications: { voltage_range: '0-1000V', accuracy: '±0.1%' }, currency: 'USD', purchase_cost: 450.00, regulatory_approvals: ['FAA', 'EASA'] },
    { tool_code: 'TOOL-PT-200', tool_name: 'Pressure Tester', manufacturer: 'GE Druck', model_number: 'PT-200', tool_category: 'test_equipment', tool_type: 'Pressure Gauge', calibration_required: true, calibration_interval_days: 180, calibration_standard: 'ISO 17025', specifications: { range: '0-5000 PSI', accuracy: '±0.05%' }, currency: 'USD', purchase_cost: 2800.00, regulatory_approvals: ['FAA', 'EASA'] },
    { tool_code: 'TOOL-GS-JACK', tool_name: 'Aircraft Jack', manufacturer: 'Hydravil', model_number: 'HJ-50', tool_category: 'ground_support', tool_type: 'Jack', calibration_required: true, calibration_interval_days: 365, calibration_standard: 'ASME PALD', specifications: { capacity: '50 tons' }, currency: 'USD', purchase_cost: 15000.00, regulatory_approvals: ['FAA', 'EASA'] },
    { tool_code: 'TOOL-ST-ENG', tool_name: 'Engine Hoist Ring', manufacturer: 'CFM International', model_number: 'ENG-HOIST-001', tool_category: 'special_tool', tool_type: 'Engine Hoist', calibration_required: true, calibration_interval_days: 365, calibration_standard: 'OEM Spec', specifications: { capacity: '5000 lbs' }, currency: 'USD', purchase_cost: 3500.00, regulatory_approvals: ['FAA', 'EASA'] },
  ];

  const { data, error, count } = await supabase
    .from('amro_tooling_registry')
    .insert(tools.map(t => ({ tenant_id: TENANT_ID, ...t })))
    .select();

  if (error) {
    console.error('❌ Error seeding tools:', error.message);
    return 0;
  }

  console.log(`✅ Inserted ${data?.length || 0} tools`);
  return data?.length || 0;
}

async function seedADSB() {
  console.log('\n📋 Seeding AD/SB Directives...');
  
  const directives = [
    { directive_number: 'AD 2024-12-05', directive_type: 'AD', regulatory_authority: 'FAA', oem: 'CFM International', aircraft_model: 'A320neo', engine_model: 'CFM LEAP-1A', component_ata: '72-00-00', effective_date: '2024-12-01', compliance_deadline: '2025-06-01', title: 'Engine Fuel Pump Inspection', description: 'Inspect high-pressure fuel pump for cracking', applicability: 'A320neo with CFM LEAP-1A', summary: 'Mandatory inspection', applicable_to_fleet: true, priority: 'high', safety_impact: true, grounding_requirement: false, fleet_impact: true },
    { directive_number: 'AD 2024-10-03', directive_type: 'AD', regulatory_authority: 'FAA', oem: 'Airbus', aircraft_model: 'A320', component_ata: '27-00-00', effective_date: '2024-10-15', compliance_deadline: '2025-04-15', title: 'Flight Control Software Update', description: 'Update flight control computer software', applicability: 'All A320 family', summary: 'Software update for flight safety', applicable_to_fleet: true, priority: 'critical', safety_impact: true, grounding_requirement: false, fleet_impact: true },
    { directive_number: 'AD 2024-08-15', directive_type: 'AD', regulatory_authority: 'FAA', oem: 'Boeing', aircraft_model: 'B737 MAX', component_ata: '32-00-00', effective_date: '2024-08-01', compliance_deadline: '2025-02-01', title: 'Landing Gear Inspection', description: 'Inspect landing gear for stress fractures', applicability: 'B737 MAX 8/9', summary: 'Preventive inspection', applicable_to_fleet: true, priority: 'high', safety_impact: false, grounding_requirement: false, fleet_impact: true },
    { directive_number: 'EASA AD 2024-0150', directive_type: 'AD', regulatory_authority: 'EASA', oem: 'Airbus', aircraft_model: 'A350', engine_model: 'Rolls-Royce Trent XWB', component_ata: '71-00-00', effective_date: '2024-09-01', compliance_deadline: '2025-03-01', title: 'Engine Oil System Inspection', description: 'Inspect engine oil system for contamination', applicability: 'A350-900/1000', summary: 'Prevent engine failure', applicable_to_fleet: true, priority: 'high', safety_impact: false, grounding_requirement: false, fleet_impact: true },
    { directive_number: 'EASA AD 2024-0120', directive_type: 'AD', regulatory_authority: 'EASA', oem: 'Embraer', aircraft_model: 'E190-E2', component_ata: '53-00-00', effective_date: '2024-07-01', compliance_deadline: '2025-01-01', title: 'Fuselage Skin Inspection', description: 'Inspect fuselage for fatigue cracking', applicability: 'E190-E2/E195-E2', summary: 'Structural integrity', applicable_to_fleet: true, priority: 'medium', safety_impact: false, grounding_requirement: false, fleet_impact: true },
    { directive_number: 'SB A320-2024-001', directive_type: 'SB', regulatory_authority: 'FAA', oem: 'Airbus', aircraft_model: 'A320neo', component_ata: '21-00-00', effective_date: '2024-11-01', compliance_deadline: '2025-05-01', title: 'Air Conditioning Upgrade', description: 'Upgrade AC system for cabin comfort', applicability: 'A320neo family', summary: 'Optional upgrade', applicable_to_fleet: true, priority: 'low', safety_impact: false, grounding_requirement: false, fleet_impact: false },
    { directive_number: 'SB B737-2024-002', directive_type: 'SB', regulatory_authority: 'FAA', oem: 'Boeing', aircraft_model: 'B737 MAX', component_ata: '22-00-00', effective_date: '2024-10-01', compliance_deadline: '2025-04-01', title: 'Autopilot Enhancement', description: 'Install enhanced autopilot software', applicability: 'B737 MAX 8/9', summary: 'Optional software update', applicable_to_fleet: true, priority: 'low', safety_impact: false, grounding_requirement: false, fleet_impact: false },
    { directive_number: 'SIL 2024-001', directive_type: 'SIL', regulatory_authority: 'FAA', oem: 'CFM International', aircraft_model: 'A320neo', engine_model: 'CFM LEAP-1A', component_ata: '72-00-00', effective_date: '2024-08-01', compliance_deadline: '2025-02-01', title: 'Engine Oil Filter Replacement', description: 'Replace oil filters at reduced interval', applicability: 'A320neo LEAP-1A', summary: 'Enhanced maintenance', applicable_to_fleet: true, priority: 'medium', safety_impact: false, grounding_requirement: false, fleet_impact: true },
  ];

  const { data, error } = await supabase
    .from('amro_compliance_ad_sb_registry')
    .insert(directives.map(d => ({ tenant_id: TENANT_ID, ...d })))
    .select();

  if (error) {
    console.error('❌ Error seeding AD/SB:', error.message);
    return 0;
  }

  console.log(`✅ Inserted ${data?.length || 0} AD/SB directives`);
  return data?.length || 0;
}

async function main() {
  console.log('🚀 Seeding Enterprise Data for Deccan Tenant');
  console.log(`Tenant ID: ${TENANT_ID}`);
  console.log(`Supabase URL: ${supabaseUrl}`);

  try {
    const toolCount = await seedTools();
    const adsbCount = await seedADSB();

    console.log('\n' + '='.repeat(50));
    console.log('✅ Seeding Complete!');
    console.log(`Tools: ${toolCount}`);
    console.log(`AD/SB: ${adsbCount}`);
    console.log('='.repeat(50));
    console.log('\n🌐 Refresh your browser and test the enterprise tabs!');
  } catch (error) {
    console.error('\n❌ Seeding failed:', error.message);
    process.exit(1);
  }
}

main();
