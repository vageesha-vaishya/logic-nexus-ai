import { describe, expect, it } from 'vitest';
import {
  buildReceivablesAndMarginAnalytics,
  canRunFinanceMutation,
  getCompensatingWorkflowPath,
  isImmutableFinanceRecord,
} from './financeWorkspaceModel';

describe('financeWorkspaceModel', () => {
  it('locks immutable records after commit state', () => {
    expect(isImmutableFinanceRecord('committed')).toBe(true);
    expect(isImmutableFinanceRecord('draft')).toBe(false);
  });

  it('restricts mutation when unauthorized or committed', () => {
    expect(canRunFinanceMutation(false, 'draft')).toBe(false);
    expect(canRunFinanceMutation(true, 'committed')).toBe(false);
    expect(canRunFinanceMutation(true, 'review')).toBe(true);
  });

  it('builds compensating workflow paths for locked invoices', () => {
    expect(getCompensatingWorkflowPath('inv-44')).toBe('/dashboard/finance/invoices/inv-44?workflow=compensating-adjustment');
  });

  it('aggregates receivables and margin analytics', () => {
    const result = buildReceivablesAndMarginAnalytics([
      {
        id: 'i1',
        invoiceNumber: 'INV-1',
        lifecycle: 'draft',
        currencyCode: 'USD',
        taxJurisdiction: 'US-CA',
        receivableAmount: 1000,
        marginAmount: 200,
        quoteReferenceId: 'Q-1',
        shipmentReferenceId: 'S-1',
        accountReferenceId: 'A-1',
      },
      {
        id: 'i2',
        invoiceNumber: 'INV-2',
        lifecycle: 'committed',
        currencyCode: 'USD',
        taxJurisdiction: 'US-CA',
        receivableAmount: 500,
        marginAmount: 100,
        quoteReferenceId: 'Q-2',
        shipmentReferenceId: 'S-2',
        accountReferenceId: 'A-2',
      },
    ]);
    expect(result.receivablesTotal).toBe(1500);
    expect(result.marginTotal).toBe(300);
    expect(result.committedCount).toBe(1);
    expect(result.averageMarginRate).toBe(20);
  });
});
