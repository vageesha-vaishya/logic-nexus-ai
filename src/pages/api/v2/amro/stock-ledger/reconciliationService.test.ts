import { describe, expect, it, vi } from 'vitest';
import { executeStockLedgerReconciliationRun } from './reconciliationService';

describe('reconciliationService', () => {
  it('creates a reconciliation run and compares balances', async () => {
    const supabase: any = {
      from: vi.fn((table: string) => {
        if (table === 'amro_stock_reconciliation_runs') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                limit: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'run-1' }, error: null }),
                })),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({ error: null }),
              })),
            })),
          };
        }
        if (table === 'amro_stock_balance_summary') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { part_inventory_id: 'part-1', current_on_hand: 105, ledger_net_quantity: 100 },
                  { part_inventory_id: 'part-2', current_on_hand: 50, ledger_net_quantity: 50 },
                ],
                error: null,
              }),
            })),
          };
        }
        if (table === 'amro_stock_valuation_summary') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { part_inventory_id: 'part-1', total_available_value: 10000, total_available_quantity: 100 },
                  { part_inventory_id: 'part-2', total_available_value: 5000, total_available_quantity: 50 },
                ],
                error: null,
              }),
            })),
          };
        }
        if (table === 'amro_stock_reconciliation_items') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const result = await executeStockLedgerReconciliationRun({
      supabase,
      tenantId: 'tenant-1',
      franchiseId: null,
      userId: 'u1',
      parameters: { trigger: 'manual' },
    });

    expect(result.runId).toBe('run-1');
    expect(result.inspectedItems).toBe(2);
    expect(result.varianceItems).toBe(1); // Only part-1 has variance
  });

  it('calculates variance cost using valuation data', async () => {
    const insertedItems: any[] = [];
    const supabase: any = {
      from: vi.fn((table: string) => {
        if (table === 'amro_stock_reconciliation_runs') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                limit: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'run-2' }, error: null }),
                })),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({ error: null }),
              })),
            })),
          };
        }
        if (table === 'amro_stock_balance_summary') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({
                data: [{ part_inventory_id: 'part-1', current_on_hand: 90, ledger_net_quantity: 100 }],
                error: null,
              }),
            })),
          };
        }
        if (table === 'amro_stock_valuation_summary') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({
                data: [{ part_inventory_id: 'part-1', total_available_value: 10000, total_available_quantity: 100 }],
                error: null,
              }),
            })),
          };
        }
        if (table === 'amro_stock_reconciliation_items') {
          return {
            insert: vi.fn((items: any) => {
              const itemsArray = Array.isArray(items) ? items : [items];
              insertedItems.push(...itemsArray);
              return { error: null };
            }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const result = await executeStockLedgerReconciliationRun({
      supabase,
      tenantId: 'tenant-1',
      franchiseId: null,
      userId: 'u1',
      parameters: { trigger: 'scheduled' },
    });

    expect(result.varianceItems).toBe(1);
    expect(insertedItems.length).toBe(1);
    // Variance = 90 - 100 = -10, avg cost = 10000/100 = 100, variance_cost = 10 * 100 = 1000
    expect(insertedItems[0].variance_cost).toBe(1000);
  });

  it('handles balance query failure gracefully', async () => {
    const supabase: any = {
      from: vi.fn((table: string) => {
        if (table === 'amro_stock_reconciliation_runs') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                limit: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'run-3' }, error: null }),
                })),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({ error: null }),
              })),
            })),
          };
        }
        if (table === 'amro_stock_balance_summary') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'Table does not exist' } }),
            })),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    await expect(executeStockLedgerReconciliationRun({
      supabase,
      tenantId: 'tenant-1',
      franchiseId: null,
      userId: 'u1',
      parameters: { trigger: 'manual' },
    })).rejects.toThrow('Failed to evaluate balances: Table does not exist');
  });
});
