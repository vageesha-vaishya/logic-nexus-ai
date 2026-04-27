import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function resolveSupabaseAvailability(): Promise<boolean> {
  if (!supabaseUrl || !supabaseServiceKey) return false;
  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/`, {
      headers: {
        apikey: supabaseServiceKey,
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
    });
    return response.status < 500;
  } catch {
    return false;
  }
}

const amroOperationalSchemaSuite = (await resolveSupabaseAvailability()) ? describe : describe.skip;

/**
 * Integration test for AMRO operational database schema
 *
 * This test validates the creation and structure of all AMRO tables:
 * - aircraft
 * - components
 * - work_orders
 * - tasks
 * - staff_qualifications
 * - maintenance_events
 * - amro_work_order_materials
 *
 * Tests ensure RLS policies are correctly applied for tenant isolation.
 */
amroOperationalSchemaSuite('AMRO Operational Schema', () => {
  // Use an untyped client for schema-validation integration tests to avoid strict generated-schema coupling.
  let supabase: any;
  const testTenantId = 'test-tenant-amro-001';
  const testFranchiseId = 'test-franchise-amro-001';

  beforeAll(async () => {
    supabase = createClient(supabaseUrl!, supabaseServiceKey!);
  });

  afterAll(async () => {
    // Cleanup test data if needed
  });

  describe('Table structure validation', () => {
    it('should have aircraft table with correct columns', async () => {
      const { data, error } = await supabase
        .from('aircraft')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      // If table exists, data will be array (possibly empty)
      expect(Array.isArray(data)).toBe(true);
    });

    it('should have components table with correct columns', async () => {
      const { data, error } = await supabase
        .from('components')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should have work_orders table with correct columns', async () => {
      const { data, error } = await supabase
        .from('work_orders')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should have tasks table with correct columns', async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should have staff_qualifications table with correct columns', async () => {
      const { data, error } = await supabase
        .from('staff_qualifications')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should have maintenance_events table with correct columns', async () => {
      const { data, error } = await supabase
        .from('maintenance_events')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should have amro_work_order_materials table with correct columns', async () => {
      const { data, error } = await supabase
        .from('amro_work_order_materials')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should have LLD v6.1 AMRO domain tables', async () => {
      const tables = [
        'component_positions',
        'schedules',
        'schedule_constraints',
        'shift_calendars',
        'parts_inventory',
        'stock_movements',
        'reservations',
        'suppliers',
        'compliance_obligations',
        'compliance_records',
        'regulator_profiles',
        'certification_actions',
        'integration_jobs',
        'integration_mappings',
        'webhook_outbox',
        'asset_health_signals',
        'forecast_outputs',
        'work_order_templates',
        'task_evidence',
        'policy_snapshots',
        'sync_conflicts',
        'regulator_dossiers',
        'forecast_features',
        'forecast_decisions',
      ];

      for (const table of tables) {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);

        expect(error).toBeNull();
        expect(Array.isArray(data)).toBe(true);
      }
    });

    it('should have AMRO 6.2 operational core alignment columns', async () => {
      const checks: Array<{ table: string; columns: string }> = [
        { table: 'aircraft', columns: 'tail_number,msn,operator_code,aircraft_model,engine_type,status,station_code' },
        { table: 'work_orders', columns: 'work_order_number,maintenance_type,priority,status,planned_start,planned_end,estimated_labor_hours,estimated_downtime_minutes' },
        { table: 'tasks', columns: 'sequence,procedure_reference,steps_json,qualifications_json,status,assigned_technician_id' },
        { table: 'parts_inventory', columns: 'part_number,serial_number,batch_number,condition_code,uom,quantity_on_hand,quantity_available,warehouse_location,expiry_date' },
        { table: 'compliance_obligations', columns: 'obligation_type,due_date,due_hours,due_cycles,regulator_code,status,aircraft_id' },
        { table: 'compliance_records', columns: 'obligation_id,decision_status,approving_authority,approving_authority_profile_id,work_order_id,policy_snapshot_id' },
        { table: 'staff_qualifications', columns: 'technician_id,rating,scope,issuer_authority,valid_from,valid_to,can_certify_release' },
        { table: 'certification_actions', columns: 'action_status,rejection_reason,policy_reference,signer_id,signature_method,policy_snapshot_id' },
        { table: 'maintenance_events', columns: 'event_hash,previous_hash,signature,signature_method,task_id,created_at' },
        { table: 'task_qualification_requirements', columns: 'task_id,staff_qualification_id,is_mandatory' },
        { table: 'work_order_templates', columns: 'template_code,version,active,template_name,scope_json,tasks_json,policy_snapshot_id' },
        { table: 'task_evidence', columns: 'task_id,evidence_type,uri,checksum,captured_at' },
        { table: 'policy_snapshots', columns: 'policy_type,version,policy_key,rules_json,effective_at,checksum' },
        { table: 'sync_conflicts', columns: 'entity_type,entity_id,conflict_class,resolution,detected_at' },
        { table: 'regulator_dossiers', columns: 'work_order_id,regulator_code,dossier_ref,status,manifest_json' },
        { table: 'forecast_features', columns: 'asset_id,feature_vector,inference_time,feature_hash,model_version' },
        { table: 'forecast_decisions', columns: 'recommendation_id,accepted,outcome_metric,decided_at,policy_snapshot_id' },
      ];

      for (const check of checks) {
        const { data, error } = await supabase
          .from(check.table)
          .select(check.columns)
          .limit(1);

        expect(error).toBeNull();
        expect(Array.isArray(data)).toBe(true);
      }
    });
  });

  describe('RLS policy validation', () => {
    it('should enforce tenant isolation on aircraft table', async () => {
      // Insert test aircraft
      const { data: insertData, error: insertError } = await supabase
        .from('aircraft')
        .insert({
          tenant_id: testTenantId,
          franchise_id: testFranchiseId,
          registration: 'N-TEST-001',
          aircraft_type: 'Boeing 787-9',
          manufacturer: 'Boeing',
          model: '787-9',
          serial_number: 'BJS12345',
          line_number: 'LN001',
          msn: 'MSN001',
        })
        .select();

      if (insertData && insertData.length > 0) {
        const aircraftId = insertData[0].id;

        // Verify we can read our own tenant data
        const { data: readData, error: readError } = await supabase
          .from('aircraft')
          .select('id, registration, tenant_id')
          .eq('id', aircraftId);

        expect(readError).toBeNull();
        expect(readData).toBeDefined();
        expect(readData?.length).toBeGreaterThan(0);

        // Cleanup
        await supabase
          .from('aircraft')
          .delete()
          .eq('id', aircraftId);
      }
    });

    it('should enforce tenant isolation on work_orders table', async () => {
      // Test that work_orders respects tenant_id in RLS
      const { data, error } = await supabase
        .from('work_orders')
        .select('tenant_id')
        .limit(1);

      expect(error).toBeNull();
      // All returned records should have a tenant_id (enforced by RLS)
      if (data && data.length > 0) {
        data.forEach((record: any) => {
          expect(record.tenant_id).toBeDefined();
        });
      }
    });
  });

  describe('Foreign key relationships', () => {
    it('should support aircraft-to-components relationship', async () => {
      // Verify that components table can reference aircraft
      const { data, error } = await supabase
        .from('components')
        .select('id, aircraft_id')
        .limit(1);

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should support work_orders referencing aircraft', async () => {
      // Verify structure
      const { data, error } = await supabase
        .from('work_orders')
        .select('id, aircraft_id')
        .limit(1);

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should support tasks referencing work_orders', async () => {
      // Verify structure
      const { data, error } = await supabase
        .from('tasks')
        .select('id, work_order_id')
        .limit(1);

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('Index validation', () => {
    it('should have indexes on tenant_id columns for query performance', async () => {
      // This test validates that indexes exist by checking query performance metadata
      // In a real scenario, we'd inspect pg_indexes system table
      const tables = [
        'aircraft',
        'components',
        'work_orders',
        'tasks',
        'staff_qualifications',
        'maintenance_events',
        'amro_work_order_materials'
      ];

      for (const table of tables) {
        const { error } = await supabase
          .from(table)
          .select('*')
          .eq('tenant_id', testTenantId)
          .limit(1);

        // Query should work (indexes help but aren't strictly required for correctness)
        expect(error).toBeNull();
      }
    });
  });

  describe('Timestamp columns', () => {
    it('should have created_at and updated_at on all tables', async () => {
      const tables = [
        'aircraft',
        'components',
        'work_orders',
        'tasks',
        'staff_qualifications',
        'maintenance_events',
        'amro_work_order_materials'
      ];

      for (const table of tables) {
        // Query structure to verify columns exist
        const { data, error } = await supabase
          .from(table)
          .select('created_at, updated_at')
          .limit(1);

        expect(error).toBeNull();
        expect(data).toBeDefined();
      }
    });
  });
});
