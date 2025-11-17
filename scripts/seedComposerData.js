import { createClient } from '@supabase/supabase-js';

const url = process.env.NEW_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.NEW_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEW_SUPABASE_URL or NEW_SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

const chargeCategories = [
  'Freight Charges','Pickup & Delivery','Terminal Handling','Customs Clearance','Documentation','Insurance','Storage & Warehousing','Fuel Surcharge','Security Fee','Handling Charges','Port Charges','Container Detention','Demurrage','Exam Fee','ISPS (Port Security)','Chassis Fee','Seal Charges','VGM (Verified Gross Mass)','Other Charges'
];

const basisTypes = [
  { code: 'container', name: 'Per Container' },
  { code: 'weight', name: 'Per Weight (KG/LB)' },
  { code: 'volume', name: 'Per Volume (CBM/CFT)' },
  { code: 'shipment', name: 'Per Shipment' },
  { code: 'bl', name: 'Per B/L' },
  { code: 'teu', name: 'Per TEU' },
  { code: 'ton', name: 'Per Ton' },
  { code: 'pallet', name: 'Per Pallet' },
  { code: 'vehicle', name: 'Per Vehicle' },
  { code: 'lumpsum', name: 'Lump Sum' },
];

const tradeDirections = [
  { code: 'import', name: 'Import' },
  { code: 'export', name: 'Export' },
  { code: 'domestic', name: 'Domestic' },
  { code: 'cross_trade', name: 'Cross Trade' },
  { code: 'inland', name: 'Inland' },
];

const containerTypes = [
  { name: 'Dry Container' },
  { name: 'Reefer' },
  { name: 'Open Top' },
  { name: 'Flat Rack' },
  { name: 'Tank Container' },
  { name: 'Special Equipment' },
];

const containerSizes = [
  { name: "20' Standard" },
  { name: "40' Standard" },
  { name: "40' High Cube" },
  { name: "45' High Cube" },
  { name: "20' Reefer" },
  { name: "40' Reefer" },
  { name: "20' Open Top" },
  { name: "40' Open Top" },
  { name: "20' Flat Rack" },
  { name: "40' Flat Rack" },
];

const serviceTypes = [
  // ocean
  { code: 'fcl', name: 'FCL (Full Container Load)' },
  { code: 'lcl', name: 'LCL (Less than Container Load)' },
  { code: 'roro', name: 'RORO (Roll-on/Roll-off)' },
  { code: 'breakbulk', name: 'Break Bulk' },
  { code: 'reefer', name: 'Reefer' },
  { code: 'oog', name: 'OOG (Out of Gauge)' },
  { code: 'bulk', name: 'Bulk Cargo' },
  // air
  { code: 'general', name: 'General Air Cargo' },
  { code: 'express', name: 'Express Air' },
  { code: 'pharma', name: 'Pharma/Healthcare' },
  { code: 'dangerous', name: 'Dangerous Goods' },
  { code: 'live_animals', name: 'Live Animals' },
  { code: 'perishable', name: 'Perishables' },
  { code: 'valuable', name: 'Valuable Cargo' },
  // road
  { code: 'ftl', name: 'FTL (Full Truck Load)' },
  { code: 'ltl', name: 'LTL (Less than Truck Load)' },
  { code: 'refrigerated', name: 'Refrigerated Truck' },
  { code: 'flatbed', name: 'Flatbed' },
  { code: 'tanker', name: 'Tanker' },
  { code: 'specialized', name: 'Specialized' },
  // rail
  { code: 'container', name: 'Container by Rail' },
  { code: 'bulk_rail', name: 'Bulk Rail' },
  { code: 'auto_rack', name: 'Auto Rack' },
  { code: 'intermodal', name: 'Intermodal' },
  { code: 'unit_train', name: 'Unit Train' },
];

async function upsertCategories() {
  const rows = chargeCategories.map((name, i) => ({ name, code: name.toLowerCase().replace(/[^a-z0-9]+/g, '_'), is_active: true, sort_order: 100 + i }));
  await supabase.from('charge_categories').upsert(rows, { onConflict: 'code' });
}

async function upsertBases() {
  const rows = basisTypes.map((b, i) => ({ name: b.name, code: b.code, is_active: true, sort_order: 100 + i }));
  await supabase.from('charge_bases').upsert(rows, { onConflict: 'code' });
}

async function upsertDirections() {
  const rows = tradeDirections.map((d, i) => ({ name: d.name, code: d.code, is_active: true, sort_order: 100 + i }));
  await supabase.from('trade_directions').upsert(rows, { onConflict: 'code' });
}

async function upsertContainerTypes() {
  for (const ct of containerTypes) {
    // container_types table may not have code, upsert by name
    const { data } = await supabase.from('container_types').select('id').eq('name', ct.name).limit(1);
    if (!Array.isArray(data) || data.length === 0) {
      await supabase.from('container_types').insert({ name: ct.name, is_active: true });
    }
  }
}

async function upsertContainerSizes() {
  for (const cs of containerSizes) {
    const { data } = await supabase.from('container_sizes').select('id').eq('name', cs.name).limit(1);
    if (!Array.isArray(data) || data.length === 0) {
      await supabase.from('container_sizes').insert({ name: cs.name, is_active: true });
    }
  }
}

async function upsertServiceTypes() {
  const rows = serviceTypes.map((s, i) => ({ name: s.name, code: s.code, is_active: true, sort_order: 100 + i }));
  await supabase.from('service_types').upsert(rows, { onConflict: 'code' });
}

async function main() {
  await upsertCategories();
  await upsertBases();
  await upsertDirections();
  await upsertContainerTypes();
  await upsertContainerSizes();
  await upsertServiceTypes();
  // Map existing services to service types by normalized service_type
  const { data: services } = await supabase.from('services').select('id, service_type, is_active');
  const { data: types } = await supabase.from('service_types').select('id, code, name');
  const toTypeCode = (st) => {
    const raw = String(st || '').toLowerCase();
    switch (raw) {
      case 'ocean':
      case 'ocean_freight':
        return 'ocean';
      case 'air':
      case 'air_freight':
        return 'air';
      case 'inland_trucking':
      case 'trucking':
      case 'road':
        return 'trucking';
      case 'courier':
        return 'courier';
      case 'railway_transport':
      case 'rail':
        return 'railway_transport';
      default:
        return raw.split('_')[0];
    }
  };
  const typeIndex = new Map(types?.map((t) => [String(t.code).toLowerCase(), t.id]) || []);
  const rows = [];
  (services || []).forEach((s, i) => {
    const code = toTypeCode(s.service_type);
    const typeId = typeIndex.get(code);
    if (typeId) {
      rows.push({ service_type_id: typeId, service_type: code, service_id: s.id, is_active: s.is_active !== false, priority: 100 + i });
    }
  });
  if (rows.length) await supabase.from('service_type_mappings').upsert(rows, { onConflict: 'service_id,service_type_id' });
  console.log('Seed complete');
}

main().catch((e) => { console.error(e); process.exit(1); });