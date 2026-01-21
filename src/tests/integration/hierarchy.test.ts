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

runTests('Container & Vessel Hierarchy Integration', () => {
  // Initialize client inside the suite to avoid early errors if skipped
  const supabase = createClient<Database>(supabaseUrl!, supabaseKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  // Test Data
  const timestamp = Date.now();
  const testVesselType = { code: `TEST_VT_${timestamp}`, name: `Test Vessel Type ${timestamp}` };
  const testVesselClass = { name: `Test Class A ${timestamp}`, min_teu: 1000, max_teu: 2000 };
  const testVessel = { 
    name: `TEST VESSEL ${timestamp}`, 
    imo_number: `${Math.floor(Math.random() * 10000000)}`, // Random 7 digit IMO
    built_year: 2024,
    capacity_teu: 1500
  };

  let typeId: string;
  let classId: string;
  let vesselId: string;

  // Cleanup function
  const cleanup = async () => {
    if (vesselId) await supabase.from('vessels').delete().eq('id', vesselId);
    if (classId) await supabase.from('vessel_classes').delete().eq('id', classId);
    if (typeId) await supabase.from('vessel_types').delete().eq('id', typeId);
    
    // Also try to clean up by code/name in case ID wasn't captured
    await supabase.from('vessel_types').delete().eq('code', testVesselType.code);
  };

  beforeAll(async () => {
    // Ensure clean state
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
  });

  it('should create a vessel type', async () => {
    const { data, error } = await supabase
      .from('vessel_types')
      .insert(testVesselType)
      .select()
      .single();

    if (error) console.error('Create Type Error:', error);
    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data?.code).toBe(testVesselType.code);
    typeId = data!.id;
  });

  it('should create a vessel class linked to the type', async () => {
    expect(typeId).toBeDefined();
    const { data, error } = await supabase
      .from('vessel_classes')
      .insert({ ...testVesselClass, type_id: typeId })
      .select()
      .single();

    if (error) console.error('Create Class Error:', error);
    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data?.type_id).toBe(typeId);
    classId = data!.id;
  });

  it('should create a vessel linked to the class', async () => {
    expect(classId).toBeDefined();
    const { data, error } = await supabase
      .from('vessels')
      .insert({ ...testVessel, class_id: classId })
      .select()
      .single();

    if (error) console.error('Create Vessel Error:', error);
    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data?.class_id).toBe(classId);
    vesselId = data!.id;
  });

  it('should enforce foreign key constraints', async () => {
    // Try to delete type while class exists (should fail due to RESTRICT)
    const { error } = await supabase.from('vessel_types').delete().eq('id', typeId);
    expect(error).toBeDefined();
    // specific error code for FK violation is 23503
    expect(error?.code).toBe('23503'); 
  });

  it('should allow reading via view or direct selection', async () => {
    const { data, error } = await supabase
      .from('vessels')
      .select('*, vessel_classes(name, vessel_types(name))')
      .eq('id', vesselId)
      .single();

    if (error) console.error('Read Vessel Error:', error);
    expect(error).toBeNull();
    expect(data?.vessel_classes?.name).toBe(testVesselClass.name);
    // Supabase returns nested objects for relationships
    // @ts-ignore
    expect(data?.vessel_classes?.vessel_types?.name).toBe(testVesselType.name);
  });
});
