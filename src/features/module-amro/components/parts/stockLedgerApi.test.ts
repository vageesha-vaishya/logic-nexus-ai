import { describe, expect, it, vi } from 'vitest';
import {
  closeStockLedgerPeriod,
  createStockLedgerBatch,
  createStockLedgerRecord,
  decideStockLedgerApproval,
  exportStockLedgerAudit,
  exportStockLedgerReport,
  listStockLedgerApprovals,
  listStockLedgerPeriods,
  listStockLedgerRecords,
  openStockLedgerPeriod,
  requestReopenStockLedgerPeriod,
  reopenStockLedgerPeriod,
} from './stockLedgerApi';

describe('stockLedgerApi', () => {
  it('lists stock ledger records', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        output: {
          total: 1,
          records: [{
            id: 'txn-1',
            partInventoryId: 'part-1',
            movementType: 'receipt',
            valuationMethod: 'fifo',
            quantityDelta: 10,
            balanceAfter: 10,
            unitCost: 100,
            totalCost: 1000,
            currency: 'USD',
            effectiveAt: '2026-04-08T10:00:00Z',
            metadata: {},
            createdAt: '2026-04-08T10:00:00Z',
          }],
        },
      }),
    });
    const result = await listStockLedgerRecords({ page: 1, pageSize: 20 }, fetchMock as never);
    expect(result.total).toBe(1);
    expect(result.records[0]?.movementType).toBe('receipt');
  });

  it('creates single stock ledger record', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        output: {
          record: {
            id: 'txn-2',
            partInventoryId: 'part-2',
            movementType: 'issue',
            valuationMethod: 'weighted_average',
            quantityDelta: -1,
            balanceAfter: 9,
            unitCost: 50,
            totalCost: 50,
            currency: 'USD',
            effectiveAt: '2026-04-08T11:00:00Z',
            metadata: {},
            createdAt: '2026-04-08T11:00:00Z',
          },
        },
      }),
    });
    const result = await createStockLedgerRecord({
      partInventoryId: 'part-2',
      movementType: 'issue',
      quantityDelta: -1,
    }, fetchMock as never);
    expect(result.quantityDelta).toBe(-1);
  });

  it('creates stock ledger batch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        output: {
          batch_id: 'batch-1',
          created_count: 2,
          rejected_count: 0,
        },
      }),
    });
    const result = await createStockLedgerBatch([
      { partInventoryId: 'part-1', movementType: 'receipt', quantityDelta: 2 },
      { partInventoryId: 'part-2', movementType: 'issue', quantityDelta: -1 },
    ], fetchMock as never);
    expect(result.batchId).toBe('batch-1');
    expect(result.createdCount).toBe(2);
  });

  it('exports csv report', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        output: {
          records: [
            { part_number: 'AMRO-001', current_on_hand: 10 },
            { part_number: 'AMRO-002', current_on_hand: 5 },
          ],
        },
      }),
    });
    const csv = await exportStockLedgerReport('stock-balance', fetchMock as never);
    expect(csv).toContain('part_number,current_on_hand');
    expect(csv).toContain('AMRO-001');
  });

  it('handles period open/close workflow calls', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ output: { record: { id: 'p1', period_code: '2026-04', close_status: 'open' } } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ output: { record: { id: 'p1', period_code: '2026-04', close_status: 'closed' } } }),
      });
    const opened = await openStockLedgerPeriod({
      periodCode: '2026-04',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
      valuationMethod: 'weighted_average',
    }, fetchMock as never);
    const closed = await closeStockLedgerPeriod('p1', 'close', fetchMock as never);
    expect(opened.close_status).toBe('open');
    expect(closed.close_status).toBe('closed');
  });

  it('handles approval list/decision and reopen actions', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ output: { records: [{ id: 'a1', request_type: 'period_reopen', request_status: 'pending' }] } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ output: { record: { id: 'a1', request_status: 'approved' } } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ output: { record: { id: 'a2', request_status: 'pending', request_type: 'period_reopen' } } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ output: { record: { id: 'p1', close_status: 'reopened' } } }),
      });
    const approvals = await listStockLedgerApprovals('pending', fetchMock as never);
    const decided = await decideStockLedgerApproval('a1', 'approved', '', fetchMock as never);
    const request = await requestReopenStockLedgerPeriod('p1', 'need adjust', fetchMock as never);
    const reopened = await reopenStockLedgerPeriod('p1', 'a1', fetchMock as never);
    expect(approvals[0]?.id).toBe('a1');
    expect(decided.request_status).toBe('approved');
    expect(request.request_type).toBe('period_reopen');
    expect(reopened.close_status).toBe('reopened');
  });

  it('lists periods and exports audit csv', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ output: { records: [{ id: 'p1', period_code: '2026-05', close_status: 'open' }] } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ output: { records: [{ event_type: 'period.opened', reference_id: 'p1' }] } }),
      });
    const periods = await listStockLedgerPeriods(fetchMock as never);
    const csv = await exportStockLedgerAudit(fetchMock as never);
    expect(periods[0]?.period_code).toBe('2026-05');
    expect(csv).toContain('event_type,reference_id');
  });
});
