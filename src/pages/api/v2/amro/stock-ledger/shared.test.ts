import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RECONCILIATION_POLICY,
  parseReconciliationPolicy,
  validateStockLedgerMutation,
  validateSourceReferenceForModule,
} from './shared';

describe('stock-ledger shared validation', () => {
  it('validates source reference format for procurement and rejects invalid references', () => {
    expect(() => validateSourceReferenceForModule('procurement', 'PO-2026-001')).not.toThrow();
    expect(() => validateSourceReferenceForModule('procurement', 'invalid-ref')).toThrow(
      /Invalid source_reference format/,
    );
  });

  it('accepts UUID source references for strict source modules', () => {
    expect(() =>
      validateSourceReferenceForModule(
        'maintenance',
        '7f4f5b8a-3d18-4d7a-927f-6a95e5f18b91',
      ),
    ).not.toThrow();
  });

  it('enforces source reference on mutation payload for non UI modules', () => {
    expect(() =>
      validateStockLedgerMutation({
        part_inventory_id: 'part-1',
        movement_type: 'issue',
        quantity_delta: -1,
        source_module: 'sales',
      }),
    ).toThrow(/source_reference is required/);
  });

  it('normalizes reconciliation policy bounds', () => {
    const policy = parseReconciliationPolicy({
      enabled: true,
      frequency_hours: 999,
      variance_threshold: -1,
      approval_sla_hours: 0,
      notify_channels: ['email', 'in_app'],
    });
    expect(policy.frequency_hours).toBe(168);
    expect(policy.variance_threshold).toBe(0);
    expect(policy.approval_sla_hours).toBe(1);
    expect(policy.notify_channels).toEqual(['email', 'in_app']);
  });

  it('falls back to defaults when policy input is invalid', () => {
    const policy = parseReconciliationPolicy('invalid');
    expect(policy).toEqual(DEFAULT_RECONCILIATION_POLICY);
  });
});
