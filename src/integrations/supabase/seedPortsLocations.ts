import { toast } from 'sonner';

type PortSeed = {
  tenant_id: string;
  location_name: string;
  location_code: string;
  location_type: 'seaport' | 'airport' | 'inland_port' | 'warehouse' | 'terminal';
  country: string;
  city: string;
  customs_available: boolean;
  is_active: boolean;
};

export async function seedPortsForTenant(supabase: any, tenantId: string): Promise<number> {
  if (!tenantId) return 0;

  const seeds: PortSeed[] = [
    // Seaports
    { tenant_id: tenantId, location_name: 'Port of Los Angeles', location_code: 'USLAX', location_type: 'seaport', country: 'United States', city: 'Los Angeles', customs_available: true, is_active: true },
    { tenant_id: tenantId, location_name: 'Port of Long Beach', location_code: 'USLGB', location_type: 'seaport', country: 'United States', city: 'Long Beach', customs_available: true, is_active: true },
    { tenant_id: tenantId, location_name: 'Port of Shanghai', location_code: 'CNSHA', location_type: 'seaport', country: 'China', city: 'Shanghai', customs_available: true, is_active: true },
    { tenant_id: tenantId, location_name: 'Port of Singapore', location_code: 'SGSIN', location_type: 'seaport', country: 'Singapore', city: 'Singapore', customs_available: true, is_active: true },
    // Airports
    { tenant_id: tenantId, location_name: 'Los Angeles International Airport', location_code: 'LAX', location_type: 'airport', country: 'United States', city: 'Los Angeles', customs_available: true, is_active: true },
    { tenant_id: tenantId, location_name: 'Singapore Changi Airport', location_code: 'SIN', location_type: 'airport', country: 'Singapore', city: 'Singapore', customs_available: true, is_active: true },
    { tenant_id: tenantId, location_name: 'Shanghai Pudong International Airport', location_code: 'PVG', location_type: 'airport', country: 'China', city: 'Shanghai', customs_available: true, is_active: true },
    // Inland/warehouse/terminal
    { tenant_id: tenantId, location_name: 'Chicago Inland Port', location_code: 'USCHI-IP', location_type: 'inland_port', country: 'United States', city: 'Chicago', customs_available: false, is_active: true },
    { tenant_id: tenantId, location_name: 'Dallas Inland Port', location_code: 'USDAL-IP', location_type: 'inland_port', country: 'United States', city: 'Dallas', customs_available: false, is_active: true },
    { tenant_id: tenantId, location_name: 'Jebel Ali Terminal', location_code: 'AEJEA-T', location_type: 'terminal', country: 'United Arab Emirates', city: 'Dubai', customs_available: true, is_active: true },
    { tenant_id: tenantId, location_name: 'East Logistics Warehouse', location_code: 'USLAX-WH', location_type: 'warehouse', country: 'United States', city: 'Los Angeles', customs_available: false, is_active: true },
  ];

  try {
    const { data: existing, error: exErr } = await supabase
      .from('ports_locations')
      .select('location_code')
      .eq('tenant_id', tenantId);
    if (exErr) throw exErr;
    const existingCodes = new Set((existing ?? []).map((r: any) => String(r.location_code)));
    const toInsert = seeds.filter((s) => !existingCodes.has(s.location_code));
    if (toInsert.length === 0) return 0;
    const { error } = await supabase.from('ports_locations').insert(toInsert);
    if (error) throw error;
    toast.success(`Seeded ${toInsert.length} ports/locations`);
    return toInsert.length;
  } catch (e: any) {
    console.warn('Seed ports/locations failed:', e?.message || e);
    toast.error('Failed to seed ports/locations', { description: e?.message || String(e) });
    return 0;
  }
}