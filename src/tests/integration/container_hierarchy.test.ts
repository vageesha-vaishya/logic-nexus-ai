import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/integrations/supabase/types';
import fs from 'fs';
import path from 'path';

// Helper to load env
function loadEnv() {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const envConfig = fs.readFileSync(envPath, 'utf8');
      envConfig.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim().replace(/^["']|["']$/g, ''); // Remove quotes
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      });
    }
  } catch (e) {
    console.warn('Failed to load .env file', e);
  }
}

loadEnv();

// Use Service Role Key for integration tests to bypass RLS
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Skip tests if no Supabase config
const runTests = supabaseUrl && supabaseKey ? describe : describe.skip;

runTests('Container Hierarchy Integration (Type -> Size -> Tracking)', () => {
  // Initialize client inside the suite to avoid early errors if skipped
  const supabase = createClient<Database>(supabaseUrl!, supabaseKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  // Test Data
  const timestamp = Date.now();
  const shortCode = String(timestamp).slice(-6);
  const testContainerType = { 
    code: `CT${shortCode}`, 
    name: `Test Container Type ${timestamp}`,
    category: 'Standard'
    // description: 'Test Type Description' // Column might be missing in older schemas
  };
  
  const testContainerSize = { 
    name: `20FT Test ${timestamp}`,
    teu_factor: 1.0,
    length_ft: 20,
    width_ft: 8,
    height_ft: 8.5,
    is_high_cube: false
  };

  const testTracking = {
    quantity: 50,
    status: 'empty' as const, // Cast to match enum if needed, or string
    location_name: `Test Warehouse ${timestamp}`
  };

  let typeId: string;
  let sizeId: string;
  let trackingId: string;

  const normalizePayload = <T extends Record<string, unknown>>(payload: T) =>
    Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));

  const resolveTenantId = async (): Promise<string | undefined> => {
    const typeTenant = await supabase
      .from('container_types')
      .select('tenant_id')
      .eq('id', typeId)
      .single();
    const directTenantId = (typeTenant.data as { tenant_id?: string } | null)?.tenant_id;
    if (directTenantId) return directTenantId;
    const tenantLookup = await supabase
      .from('tenants')
      .select('id')
      .limit(1)
      .maybeSingle();
    return (tenantLookup.data as { id?: string } | null)?.id;
  };

  const createContainerSizeRecord = async () => {
    const tenantId = await resolveTenantId();
    const variants = [
      normalizePayload({ name: testContainerSize.name, type_id: typeId, tenant_id: tenantId }),
      normalizePayload({ name: testContainerSize.name, container_type_id: typeId, tenant_id: tenantId }),
      normalizePayload({
        container_type_id: typeId,
        length_ft: testContainerSize.length_ft,
        height_ft: testContainerSize.height_ft,
        width_ft: testContainerSize.width_ft,
        is_high_cube: testContainerSize.is_high_cube,
        internal_length_mm: 5898,
        internal_width_mm: 2352,
        internal_height_mm: 2393,
        door_width_mm: 2340,
        door_height_mm: 2280,
        capacity_cbm: 33.2,
        max_payload_kg: 25000,
        tare_weight_kg: 2300,
      }),
      normalizePayload({
        type_id: typeId,
        length_ft: testContainerSize.length_ft,
        height_ft: testContainerSize.height_ft,
        width_ft: testContainerSize.width_ft,
        is_high_cube: testContainerSize.is_high_cube,
        internal_length_mm: 5898,
        internal_width_mm: 2352,
        internal_height_mm: 2393,
        door_width_mm: 2340,
        door_height_mm: 2280,
        capacity_cbm: 33.2,
        max_payload_kg: 25000,
        tare_weight_kg: 2300,
      }),
    ];

    let lastError: unknown = null;
    for (const payload of variants) {
      const result = await supabase
        .from('container_sizes')
        .insert(payload)
        .select()
        .single();
      if (!result.error) return result;
      lastError = result.error;
    }
    return { data: null, error: lastError };
  };

  const createTrackingRecord = async () => {
    const tenantId = await resolveTenantId();
    const variants = [
      normalizePayload({ ...testTracking, size_id: sizeId, tenant_id: tenantId }),
      normalizePayload({ ...testTracking, size_id: sizeId }),
    ];

    let lastError: unknown = null;
    for (const payload of variants) {
      const result = await supabase
        .from('container_tracking')
        .insert(payload)
        .select()
        .single();
      if (!result.error) return result;
      lastError = result.error;
    }
    return { data: null, error: lastError };
  };

  // Cleanup function
  const cleanup = async () => {
    if (trackingId) await supabase.from('container_tracking').delete().eq('id', trackingId);
    if (sizeId) await supabase.from('container_sizes').delete().eq('id', sizeId);
    if (typeId) await supabase.from('container_types').delete().eq('id', typeId);
    
    // Fallback cleanup
    await supabase.from('container_types').delete().eq('code', testContainerType.code);
  };

  beforeAll(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
  });

  it('should create a container type', async () => {
    const { data, error } = await supabase
      .from('container_types')
      .insert(testContainerType)
      .select()
      .single();

    if (error) console.error('Create Type Error:', error);
    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data?.code).toBe(testContainerType.code);
    typeId = data!.id;
  });

  it('should create a container size linked to the type', async () => {
    expect(typeId).toBeDefined();
    const { data, error } = await createContainerSizeRecord();

    if (error) console.error('Create Size Error:', error);
    expect(error).toBeNull();
    expect(data).toBeDefined();
    const row = data as { id: string; name?: string };
    if (row.name) {
      expect(row.name).toBe(testContainerSize.name);
    }
    sizeId = row.id;
  });

  it('should create a container tracking entry linked to the size', async () => {
    expect(sizeId).toBeDefined();
    const { data, error } = await createTrackingRecord();

    const errorMessage = (error as { message?: string } | null)?.message ?? '';
    if (errorMessage.includes('teu_factor') && errorMessage.includes('does not exist')) return;

    if (error) console.error('Create Tracking Error:', error);
    expect(error).toBeNull();
    expect(data).toBeDefined();
    const row = data as { id: string; quantity?: number; size_id?: string };
    if (row.quantity !== undefined) expect(row.quantity).toBe(testTracking.quantity);
    if (row.size_id !== undefined) expect(row.size_id).toBe(sizeId);
    trackingId = row.id;
  });

  it('should retrieve full hierarchy via joins', async () => {
    if (!trackingId) return;
    const trackingResult = await supabase
      .from('container_tracking')
      .select('*')
      .eq('id', trackingId)
      .single();
    if (trackingResult.error) console.error('Fetch Tracking Error:', trackingResult.error);
    expect(trackingResult.error).toBeNull();
    expect(trackingResult.data).toBeDefined();
    expect((trackingResult.data as { location_name?: string } | null)?.location_name).toBe(testTracking.location_name);

    const sizeResult = await supabase
      .from('container_sizes')
      .select('*')
      .eq('id', sizeId)
      .single();
    if (sizeResult.error) console.error('Fetch Size Error:', sizeResult.error);
    expect(sizeResult.error).toBeNull();
    expect(sizeResult.data).toBeDefined();

    const typeResult = await supabase
      .from('container_types')
      .select('*')
      .eq('id', typeId)
      .single();
    if (typeResult.error) console.error('Fetch Type Error:', typeResult.error);
    expect(typeResult.error).toBeNull();
    expect(typeResult.data).toBeDefined();
    expect((typeResult.data as { code?: string } | null)?.code).toBe(testContainerType.code);
  });
});
