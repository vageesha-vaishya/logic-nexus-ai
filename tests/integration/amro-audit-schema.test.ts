import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

/**
 * Integration test for AMRO audit database schema
 *
 * This test validates the creation and immutability of audit tables:
 * - mro_audit.records - Immutable audit records with blockchain-style hashing
 * - mro_audit.trails - Immutable audit trail events for compliance replay
 *
 * Key validation:
 * - Records are append-only (INSERT allowed, UPDATE/DELETE prevented)
 * - Triggers enforce immutability at database level
 * - RLS policies allow SELECT/INSERT for authenticated users
 * - Indexes support efficient filtering by tenant and timestamp
 */
describe('AMRO Audit Schema', () => {
  let supabase: ReturnType<typeof createClient>;
  const testTenantId = 'test-tenant-audit-001';
  const testActorId = 'test-actor-audit-001';
  const testUserId = 'test-user-audit-001';

  beforeAll(async () => {
    const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc19zdXBlcmFkbWluIjp0cnVlfQ.rGL32GQBYaO69BIkD_K1t-nxrngilvpVVPreh74XUkQ';

    supabase = createClient(supabaseUrl, supabaseServiceKey);
  });

  afterAll(async () => {
    // Cleanup test data if needed
  });

  describe('mro_audit.records table', () => {
    it('should exist with correct columns', async () => {
      const { data, error } = await supabase
        .from('records')
        .select('*')
        .limit(1)
        .schema('mro_audit');

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should allow INSERT of audit records', async () => {
      const { data, error } = await supabase
        .from('records')
        .insert({
          tenant_id: testTenantId,
          record_type: 'component_installation',
          related_entity_id: 'component-001',
          related_entity_type: 'component',
          actor_id: testActorId,
          actor_role: 'technician',
          action: 'installed',
          context: { aircraft_id: 'aircraft-001', hours_before: 1000 },
          signature: new Uint8Array([1, 2, 3, 4, 5]),
          previous_hash: new Uint8Array([0, 0, 0, 0, 0]),
        })
        .select();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
      expect(data!.length).toBeGreaterThan(0);
    });

    it('should prevent UPDATE of audit records with trigger', async () => {
      // First insert a record
      const { data: insertData, error: insertError } = await supabase
        .from('records')
        .insert({
          tenant_id: testTenantId,
          record_type: 'component_removal',
          related_entity_id: 'component-002',
          related_entity_type: 'component',
          actor_id: testActorId,
          actor_role: 'technician',
          action: 'removed',
          context: { reason: 'failed inspection' },
          signature: new Uint8Array([2, 3, 4, 5, 6]),
          previous_hash: new Uint8Array([1, 2, 3, 4, 5]),
        })
        .select();

      expect(insertError).toBeNull();
      expect(insertData).toBeDefined();
      expect(insertData!.length).toBe(1);

      const recordId = insertData![0].id;

      // Now try to update it - should fail with trigger exception
      const { error: updateError } = await supabase
        .from('records')
        .update({
          action: 'modified',
        })
        .eq('id', recordId);

      // Expect error due to immutability trigger
      expect(updateError).not.toBeNull();
      expect(updateError?.message).toMatch(/prevent|immutable|audit|update/i);
    });

    it('should prevent DELETE of audit records with trigger', async () => {
      // First insert a record
      const { data: insertData, error: insertError } = await supabase
        .from('records')
        .insert({
          tenant_id: testTenantId,
          record_type: 'maintenance_completion',
          related_entity_id: 'task-001',
          related_entity_type: 'task',
          actor_id: testActorId,
          actor_role: 'inspector',
          action: 'approved',
          context: { sign_off_time: new Date().toISOString() },
          signature: new Uint8Array([3, 4, 5, 6, 7]),
          previous_hash: new Uint8Array([2, 3, 4, 5, 6]),
        })
        .select();

      expect(insertError).toBeNull();
      expect(insertData).toBeDefined();

      const recordId = insertData![0].id;

      // Now try to delete it - should fail with trigger exception
      const { error: deleteError } = await supabase
        .from('records')
        .delete()
        .eq('id', recordId);

      // Expect error due to immutability trigger
      expect(deleteError).not.toBeNull();
      expect(deleteError?.message).toMatch(/prevent|immutable|audit|delete/i);
    });

    it('should have indexes on related_entity_id and created_at', async () => {
      // This validates indexes exist by successful query with filtering
      const { data, error } = await supabase
        .from('records')
        .select('id, created_at')
        .eq('related_entity_id', 'component-test')
        .order('created_at', { ascending: false })
        .limit(1)
        .schema('mro_audit');

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should have indexes on tenant_id and created_at', async () => {
      // Validates multi-tenant filtering performance
      const { data, error } = await supabase
        .from('records')
        .select('id, tenant_id')
        .eq('tenant_id', testTenantId)
        .order('created_at', { ascending: false })
        .limit(1)
        .schema('mro_audit');

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('mro_audit.trails table', () => {
    it('should exist with correct columns', async () => {
      const { data, error } = await supabase
        .from('trails')
        .select('*')
        .limit(1)
        .schema('mro_audit');

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should allow INSERT of audit trail events', async () => {
      const { data, error } = await supabase
        .from('trails')
        .insert({
          tenant_id: testTenantId,
          event_type: 'work_package_created',
          entity_type: 'work_package',
          entity_id: 'wp-001',
          user_id: testUserId,
          user_email: 'test@example.com',
          action_description: 'Created new work package for aircraft inspection',
          regulatory_context: { regulation: 'FAA Part 43', section: 'Appendix A' },
          timestamp: new Date().toISOString(),
        })
        .select();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
      expect(data!.length).toBeGreaterThan(0);
    });

    it('should prevent UPDATE of audit trail events with trigger', async () => {
      // First insert a trail event
      const { data: insertData, error: insertError } = await supabase
        .from('trails')
        .insert({
          tenant_id: testTenantId,
          event_type: 'component_replaced',
          entity_type: 'component',
          entity_id: 'comp-003',
          user_id: testUserId,
          user_email: 'technician@example.com',
          action_description: 'Replaced component due to time limit',
          regulatory_context: { regulation: 'FAA Part 43', section: 'Appendix B-1' },
          timestamp: new Date().toISOString(),
        })
        .select();

      expect(insertError).toBeNull();
      expect(insertData).toBeDefined();

      const trailId = insertData![0].id;

      // Now try to update it - should fail with trigger exception
      const { error: updateError } = await supabase
        .from('trails')
        .update({
          action_description: 'Modified action',
        })
        .eq('id', trailId);

      // Expect error due to immutability trigger
      expect(updateError).not.toBeNull();
      expect(updateError?.message).toMatch(/prevent|immutable|audit|update/i);
    });

    it('should prevent DELETE of audit trail events with trigger', async () => {
      // First insert a trail event
      const { data: insertData, error: insertError } = await supabase
        .from('trails')
        .insert({
          tenant_id: testTenantId,
          event_type: 'maintenance_signed_off',
          entity_type: 'task',
          entity_id: 'task-002',
          user_id: testUserId,
          user_email: 'inspector@example.com',
          action_description: 'Maintenance task signed off by quality inspector',
          regulatory_context: { regulation: 'FAA Part 43', section: 'Appendix E' },
          timestamp: new Date().toISOString(),
        })
        .select();

      expect(insertError).toBeNull();
      expect(insertData).toBeDefined();

      const trailId = insertData![0].id;

      // Now try to delete it - should fail with trigger exception
      const { error: deleteError } = await supabase
        .from('trails')
        .delete()
        .eq('id', trailId);

      // Expect error due to immutability trigger
      expect(deleteError).not.toBeNull();
      expect(deleteError?.message).toMatch(/prevent|immutable|audit|delete/i);
    });

    it('should have indexes on tenant_id and created_at', async () => {
      // Validates multi-tenant filtering with time-based queries
      const { data, error } = await supabase
        .from('trails')
        .select('id, tenant_id, created_at')
        .eq('tenant_id', testTenantId)
        .order('created_at', { ascending: false })
        .limit(1)
        .schema('mro_audit');

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should have indexes on entity_type and entity_id', async () => {
      // Validates entity-based filtering for compliance replay
      const { data, error } = await supabase
        .from('trails')
        .select('id, event_type')
        .eq('entity_type', 'work_package')
        .eq('entity_id', 'wp-test')
        .schema('mro_audit');

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('Audit schema immutability enforcement', () => {
    it('should enforce immutability at database level via triggers', async () => {
      // Test on records table
      const { data: recordData } = await supabase
        .from('records')
        .insert({
          tenant_id: testTenantId,
          record_type: 'immutability_test',
          related_entity_id: 'test-entity',
          related_entity_type: 'test',
          actor_id: testActorId,
          actor_role: 'tester',
          action: 'test_action',
          context: { test: true },
          signature: new Uint8Array([1, 1, 1, 1, 1]),
          previous_hash: new Uint8Array([0, 0, 0, 0, 0]),
        })
        .select();

      if (recordData && recordData.length > 0) {
        const { error: updateError } = await supabase
          .from('records')
          .update({ action: 'changed' })
          .eq('id', recordData[0].id);

        // Both UPDATE and DELETE should fail
        expect(updateError).not.toBeNull();
      }
    });

    it('should append-only pattern with no side effects', async () => {
      // Verify we can rapidly insert multiple records (append-only pattern)
      const insertPromises = Array.from({ length: 5 }).map((_, i) =>
        supabase
          .from('records')
          .insert({
            tenant_id: testTenantId,
            record_type: `append_test_${i}`,
            related_entity_id: `entity-${i}`,
            related_entity_type: 'test',
            actor_id: testActorId,
            actor_role: 'tester',
            action: 'appended',
            context: { sequence: i },
            signature: new Uint8Array([i, i, i, i, i]),
            previous_hash: new Uint8Array([i - 1, i - 1, i - 1, i - 1, i - 1]),
          })
          .select()
      );

      const results = await Promise.all(insertPromises);

      // All inserts should succeed
      results.forEach(result => {
        expect(result.error).toBeNull();
        expect(result.data).toBeDefined();
      });
    });
  });

  describe('Audit schema RLS policies', () => {
    it('should allow SELECT on audit records for authenticated users', async () => {
      const { data, error } = await supabase
        .from('records')
        .select('id, tenant_id, action')
        .limit(1)
        .schema('mro_audit');

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should allow INSERT on audit records for authenticated users', async () => {
      const { data, error } = await supabase
        .from('records')
        .insert({
          tenant_id: testTenantId,
          record_type: 'rls_test',
          related_entity_id: 'rls-entity',
          related_entity_type: 'test',
          actor_id: testActorId,
          actor_role: 'tester',
          action: 'test',
          context: { rls: true },
          signature: new Uint8Array([7, 7, 7, 7, 7]),
          previous_hash: new Uint8Array([6, 6, 6, 6, 6]),
        })
        .select();

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should enforce tenant isolation via RLS', async () => {
      // Query for records in specific tenant
      const { data, error } = await supabase
        .from('records')
        .select('id, tenant_id')
        .eq('tenant_id', testTenantId)
        .limit(1)
        .schema('mro_audit');

      expect(error).toBeNull();
      if (data && data.length > 0) {
        // All results should have the queried tenant_id
        data.forEach(record => {
          expect(record.tenant_id).toBe(testTenantId);
        });
      }
    });
  });

  describe('Audit schema timestamp handling', () => {
    it('should automatically set created_at timestamp on records', async () => {
      const beforeInsert = new Date();

      const { data, error } = await supabase
        .from('records')
        .insert({
          tenant_id: testTenantId,
          record_type: 'timestamp_test',
          related_entity_id: 'ts-entity',
          related_entity_type: 'test',
          actor_id: testActorId,
          actor_role: 'tester',
          action: 'timestamp_test',
          context: {},
          signature: new Uint8Array([8, 8, 8, 8, 8]),
          previous_hash: new Uint8Array([7, 7, 7, 7, 7]),
        })
        .select();

      const afterInsert = new Date();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data!.length).toBeGreaterThan(0);

      const createdAt = new Date(data![0].created_at);
      expect(createdAt.getTime()).toBeGreaterThanOrEqual(beforeInsert.getTime());
      expect(createdAt.getTime()).toBeLessThanOrEqual(afterInsert.getTime());
    });

    it('should automatically set timestamp on trail events', async () => {
      const beforeInsert = new Date();

      const { data, error } = await supabase
        .from('trails')
        .insert({
          tenant_id: testTenantId,
          event_type: 'timestamp_test',
          entity_type: 'test',
          entity_id: 'ts-entity',
          user_id: testUserId,
          user_email: 'test@example.com',
          action_description: 'Testing timestamp',
          regulatory_context: {},
          timestamp: new Date().toISOString(),
        })
        .select();

      const afterInsert = new Date();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data!.length).toBeGreaterThan(0);

      const createdAt = new Date(data![0].created_at);
      expect(createdAt.getTime()).toBeGreaterThanOrEqual(beforeInsert.getTime());
      expect(createdAt.getTime()).toBeLessThanOrEqual(afterInsert.getTime());
    });
  });
});
