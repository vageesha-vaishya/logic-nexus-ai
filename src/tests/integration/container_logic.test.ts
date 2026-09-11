
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/integrations/supabase/types';
import fs from 'fs';
import path from 'path';
import { logger } from "@/lib/logger";

// Helper to load env
function loadEnv() {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const envConfig = fs.readFileSync(envPath, 'utf8');
      // .split('\n') alone leaves a trailing \r on each line for a
      // CRLF-saved .env (common on Windows) -- the regex below has no /m
      // flag, so its $ can't match before that \r and every line silently
      // fails to parse, leaving SUPABASE_SERVICE_ROLE_KEY unset and this
      // suite's createClient() crashing instead of skipping.
      envConfig.split(/\r?\n/).forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim().replace(/^["']|["']$/g, '');
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      });
    }
  } catch (e) {
    logger.warn('Failed to load .env file', e);
  }
}

loadEnv();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Skip tests if no Supabase config
const runTests = supabaseUrl && supabaseKey ? describe : describe.skip;

runTests('Enhanced Container Logic Integration', () => {
  const supabase = createClient<Database>(supabaseUrl!, supabaseKey!, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const timestamp = Date.now();
  const testTenantId = '00000000-0000-0000-0000-000000000000'; // Use a dummy or fetch existing
  // Ideally we should create a tenant, but for now we might rely on RLS bypass or existing tenant
  // However, transactions require a valid tenant_id fk usually.
  // We'll try to fetch the first available tenant or insert one if possible.
  
  let tenantId: string;
  let typeId: string;
  let sizeId: string;
  
  // Data
  const shortSuffix = String(timestamp).slice(-6);
  const testType = { 
    code: `TL${shortSuffix}`, 
    name: `Test Logic Type ${timestamp}`
  };
  
  // public.container_sizes has no name/code/teu_factor/iso_code/type_id
  // column -- only dimensional data, keyed by container_type_id. See
  // container_hierarchy.test.ts and the container_sizes fix in
  // container-utils.ts for the same real-schema shape.
  const testSize = {
    length_ft: 40,
    width_ft: 8,
    height_ft: 8.5,
    internal_length_mm: 12032,
    internal_width_mm: 2352,
    internal_height_mm: 2393,
    door_width_mm: 2340,
    door_height_mm: 2280,
    capacity_cbm: 67.7,
    max_payload_kg: 26512,
    tare_weight_kg: 3800,
    is_high_cube: false,
  };

  const cleanup = async () => {
    // Delete transactions first (fk dependency)
    if (sizeId) {
        await supabase.from('container_transactions').delete().eq('size_id', sizeId);
        await supabase.from('container_tracking').delete().eq('size_id', sizeId);
        await supabase.from('vessel_class_capacities').delete().eq('container_size_id', sizeId);
        await supabase.from('container_sizes').delete().eq('id', sizeId);
    }
    if (typeId) await supabase.from('container_types').delete().eq('id', typeId);
  };

  beforeAll(async () => {
    // Get a tenant
    const { data: tenants } = await supabase.from('tenants').select('id').limit(1);
    if (tenants && tenants.length > 0) {
      tenantId = tenants[0].id;
    } else {
      // Create a dummy tenant if allowed, or skip
      // For this test suite to work, we assume a tenant exists or foreign key checks might fail
      logger.warn('No tenant found. Tests requiring tenant_id might fail.');
      tenantId = '00000000-0000-0000-0000-000000000000';
    }

    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
  });

  it('should set up container type and size', async () => {
    // Type
    const { data: typeData, error: typeError } = await supabase
      .from('container_types')
      .insert(testType)
      .select()
      .single();
    
    expect(typeError).toBeNull();
    expect(typeData).toBeDefined();
    typeId = typeData!.id;

    // Size
    const { data: sizeData, error: sizeError } = await supabase
      .from('container_sizes')
      .insert({ ...testSize, container_type_id: typeId })
      .select()
      .single();

    expect(sizeError).toBeNull();
    expect(sizeData).toBeDefined();
    sizeId = sizeData!.id;
  });

  it('should process INBOUND transaction and update inventory summary', async () => {
    if (!tenantId) return; // Skip if no tenant

    const qty = 10;
    const location = 'Port Logic Test';

    // Insert Transaction
    const { data: txn, error: txnError } = await supabase
      .from('container_transactions')
      .insert({
        tenant_id: tenantId,
        size_id: sizeId,
        transaction_type: 'INBOUND',
        quantity_change: qty,
        location_name: location,
        status: 'empty',
        notes: 'Integration Test Inbound'
      })
      .select()
      .single();

    expect(txnError).toBeNull();
    expect(txn).toBeDefined();

    // Verify Summary (Container Tracking) via Trigger
    // Give a small delay for trigger execution if async (usually sync in Postgres)
    const { data: tracking, error: trackError } = await supabase
      .from('container_tracking')
      .select('*')
      .eq('size_id', sizeId)
      .eq('location_name', location)
      .eq('status', 'empty')
      .single();

    expect(trackError).toBeNull();
    expect(tracking).toBeDefined();
    expect(tracking!.quantity).toBe(qty);
  });

  it('should calculate TEU correctly in analytics view', async () => {
    if (!tenantId) return;

    // NOTE: container_sizes has no teu_factor column, and
    // view_container_inventory_summary does not exist on the production DB
    // at all (see ContainerTracking.tsx) -- this test's TEU assertions
    // below are pre-existing, out-of-scope breakage unrelated to the
    // container_sizes column fix above; flagging rather than changing
    // behavior here.
    // View query
    const { data: rawViewData, error: viewError } = await supabase
      .from('view_container_inventory_summary')
      .select('*')
      .eq('size_id', sizeId);

    expect(viewError).toBeNull();
    expect(rawViewData).toBeDefined();
    
    const viewData = rawViewData as { total_quantity: number; total_teu: number }[];
    expect(viewData.length).toBeGreaterThan(0);

    const record = viewData[0];
    expect(record.total_quantity).toBe(10);
    // TEU Factor is 2.0, Qty is 10 -> Total TEU should be 20
    expect(record.total_teu).toBe(20);
  });

  it('should process OUTBOUND transaction and decrease inventory', async () => {
    if (!tenantId) return;

    const qtyOut = 3;
    const location = 'Port Logic Test';

    // Insert Transaction
    const { error: txnError } = await supabase
      .from('container_transactions')
      .insert({
        tenant_id: tenantId,
        size_id: sizeId,
        transaction_type: 'OUTBOUND',
        quantity_change: -qtyOut, // Negative change for outbound/reduction
        location_name: location,
        status: 'empty',
        notes: 'Integration Test Outbound'
      });

    expect(txnError).toBeNull();

    // Verify Summary
    const { data: tracking } = await supabase
      .from('container_tracking')
      .select('*')
      .eq('size_id', sizeId)
      .eq('location_name', location)
      .eq('status', 'empty')
      .single();

    expect(tracking!.quantity).toBe(10 - qtyOut);
  });

  it('should allow setting vessel capacity limits', async () => {
    if (!tenantId) return;
    
    // We need a vessel class first, but let's see if we can just test the table insertion
    // We need a valid class_id. Let's create a dummy class if needed or skip.
    // For now, we'll skip creating a full vessel hierarchy in this test file to keep it focused,
    // but we can check if the table exists by doing a select (which returns empty or error).
    
    const { error } = await supabase
        .from('vessel_class_capacities')
        .select('*')
        .limit(1);
    
    // If table exists, error should be null (or permission error), not "relation does not exist"
    expect(error).toBeNull(); 
  });
});
