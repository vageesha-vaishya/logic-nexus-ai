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
  const testContainerType = { 
    code: `TEST_CT_${timestamp}`, 
    name: `Test Container Type ${timestamp}`
    // description: 'Test Type Description' // Column might be missing in older schemas
  };
  
  const testContainerSize = { 
    name: `20FT Test ${timestamp}`,
    code: `20TEST_${timestamp}`,
    description: '20FT Test Container',
    teu_factor: 1.0,
    iso_code: '22G1',
    length_ft: 20,
    width_ft: 8,
    height_ft: 8.5,
    max_gross_weight_kg: 30480,
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
    const { data, error } = await supabase
      .from('container_sizes')
      .insert({ ...testContainerSize, type_id: typeId })
      .select()
      .single();

    if (error) console.error('Create Size Error:', error);
    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data?.name).toBe(testContainerSize.name);
    expect(data?.type_id).toBe(typeId);
    expect(data?.length_ft).toBe(20);
    sizeId = data!.id;
  });

  it('should create a container tracking entry linked to the size', async () => {
    expect(sizeId).toBeDefined();
    const { data, error } = await supabase
      .from('container_tracking')
      .insert({ ...testTracking, size_id: sizeId })
      .select()
      .single();

    if (error) console.error('Create Tracking Error:', error);
    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data?.quantity).toBe(testTracking.quantity);
    expect(data?.size_id).toBe(sizeId);
    trackingId = data!.id;
  });

  it('should retrieve full hierarchy via joins', async () => {
    expect(trackingId).toBeDefined();
    
    // Note: Supabase JS syntax for deep joins: size:container_sizes!inner(..., type:container_types!inner(...))
    // Or just simple joins if relationships are clear
    const { data, error } = await supabase
      .from('container_tracking')
      .select(`
        *,
        container_sizes (
          name,
          teu_factor,
          container_types (
            name,
            code
          )
        )
      `)
      .eq('id', trackingId)
      .single();

    if (error) console.error('Fetch Hierarchy Error:', error);
    expect(error).toBeNull();
    expect(data).toBeDefined();
    
    // Verify Tracking Data
    expect(data?.location_name).toBe(testTracking.location_name);
    
    // Verify Size Data (joined)
    const size = data?.container_sizes;
    expect(size).toBeDefined();
    // @ts-ignore
    expect(size?.name).toBe(testContainerSize.name);
    
    // Verify Type Data (deep joined)
    // @ts-ignore
    const type = size?.container_types;
    expect(type).toBeDefined();
    // @ts-ignore
    expect(type?.code).toBe(testContainerType.code);
  });
});
