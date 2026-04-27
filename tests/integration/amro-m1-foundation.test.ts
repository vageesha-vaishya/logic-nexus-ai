import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { readFileSync } from 'node:fs';

function load(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

function expectContainsAll(source: string, expected: string[]): void {
  for (const fragment of expected) {
    expect(source).toContain(fragment);
  }
}

describe('AMRO M1 foundation static validation', () => {
  const schemaSql = load('supabase/migrations/20260319143000_create_amro_schema.sql');
  const auditSql = load('supabase/migrations/20260319143100_create_amro_audit_schema.sql');
  const authMiddlewareTs = load('services/amro-api/src/middleware/auth.middleware.ts');

  it('defines all required core AMRO tables and tenant indexes', () => {
    expectContainsAll(schemaSql, [
      'CREATE TABLE IF NOT EXISTS public.aircraft',
      'CREATE TABLE IF NOT EXISTS public.components',
      'CREATE TABLE IF NOT EXISTS public.work_orders',
      'CREATE TABLE IF NOT EXISTS public.tasks',
      'CREATE TABLE IF NOT EXISTS public.staff_qualifications',
      'CREATE TABLE IF NOT EXISTS public.maintenance_events',
      'CREATE TABLE IF NOT EXISTS public.work_order_materials',
      'CREATE INDEX IF NOT EXISTS idx_aircraft_tenant_id ON public.aircraft(tenant_id)',
      'CREATE INDEX IF NOT EXISTS idx_components_tenant_id ON public.components(tenant_id)',
      'CREATE INDEX IF NOT EXISTS idx_work_orders_tenant_id ON public.work_orders(tenant_id)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_tenant_id ON public.tasks(tenant_id)',
      'CREATE INDEX IF NOT EXISTS idx_staff_qualifications_tenant_id ON public.staff_qualifications(tenant_id)',
      'CREATE INDEX IF NOT EXISTS idx_maintenance_events_tenant_id ON public.maintenance_events(tenant_id)',
      'CREATE INDEX IF NOT EXISTS idx_work_order_materials_tenant_id ON public.work_order_materials(tenant_id)',
    ]);
  });

  it('enables RLS on all AMRO scoped operational and audit tables', () => {
    expectContainsAll(schemaSql, [
      'ALTER TABLE public.aircraft ENABLE ROW LEVEL SECURITY;',
      'ALTER TABLE public.components ENABLE ROW LEVEL SECURITY;',
      'ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;',
      'ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;',
      'ALTER TABLE public.staff_qualifications ENABLE ROW LEVEL SECURITY;',
      'ALTER TABLE public.maintenance_events ENABLE ROW LEVEL SECURITY;',
      'ALTER TABLE public.work_order_materials ENABLE ROW LEVEL SECURITY;',
    ]);
    expectContainsAll(auditSql, [
      'ALTER TABLE mro_audit.records ENABLE ROW LEVEL SECURITY;',
      'ALTER TABLE mro_audit.trails ENABLE ROW LEVEL SECURITY;',
    ]);
  });

  it('uses JWT verification via signing-key-backed Supabase auth only', () => {
    expect(authMiddlewareTs).toContain('supabase.auth.getUser(token)');
    expect(authMiddlewareTs).not.toContain('LEGACY_JWT_SECRET');
    expect(authMiddlewareTs).not.toContain('JWT_SECRET');
    expect(authMiddlewareTs).not.toContain('jsonwebtoken');
  });
});
