import { describe, it, expect, vi } from 'vitest';
import { QuotationNumberService, DEFAULT_CONFIG } from '../QuotationNumberService';

describe('QuotationNumberService', () => {
  it('formats preview with prefix, date and padded sequence', () => {
    const cfg = { ...DEFAULT_CONFIG, prefix: 'QT', dateFormat: 'YYYYMM' as const, separator: '-' as const, padLength: 4 };
    const d = new Date('2025-02-01T00:00:00Z');
    const res = QuotationNumberService.preview(cfg, 7, d);
    expect(res).toBe('QT-202502-0007');
  });

  it('isUnique returns true when no rows', async () => {
    const scopedDb = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    };
    (scopedDb as any).select.mockResolvedValueOnce({ data: [] });
    const ok = await QuotationNumberService.isUnique(scopedDb, 'tenant-1', 'QT-202502-0001');
    expect(ok).toBe(true);
  });

  it('isUnique returns false when a row exists', async () => {
    const scopedDb = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    };
    (scopedDb as any).select.mockResolvedValueOnce({ data: [{ id: 'q1' }] });
    const ok = await QuotationNumberService.isUnique(scopedDb, 'tenant-1', 'QT-202502-0001');
    expect(ok).toBe(false);
  });
});
