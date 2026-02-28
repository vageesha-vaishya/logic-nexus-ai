import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuotationVersionService } from '../QuotationVersionService';

describe('QuotationVersionService', () => {
  let mockDb: any;
  let service: QuotationVersionService;

  beforeEach(() => {
    mockDb = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      single: vi.fn(),
      maybeSingle: vi.fn(),
      rpc: vi.fn(),
    };
    service = new QuotationVersionService(mockDb);
  });

  describe('saveVersion', () => {
    it('should increment minor version by default', async () => {
      // Mock latest version
      mockDb.maybeSingle.mockResolvedValueOnce({
        data: { major: 1, minor: 0, version_number: 1 }
      });

      // Mock insert return
      mockDb.single.mockResolvedValueOnce({
        data: { id: 'v2', version_number: 2 }
      });

      await service.saveVersion('q1', 't1', {}, 'minor', 'u1');

      expect(mockDb.insert).toHaveBeenCalledWith(expect.objectContaining({
        major: 1,
        minor: 1,
        version_number: 2
      }));
    });

    it('should increment major version and reset minor', async () => {
      mockDb.maybeSingle.mockResolvedValueOnce({
        data: { major: 1, minor: 5, version_number: 6 }
      });
      mockDb.single.mockResolvedValueOnce({ data: { id: 'v7' } });

      await service.saveVersion('q1', 't1', {}, 'major', 'u1');

      expect(mockDb.insert).toHaveBeenCalledWith(expect.objectContaining({
        major: 2,
        minor: 0,
        version_number: 7
      }));
    });
  });

  describe('getVersion', () => {
    it('should return specific version if ID provided', async () => {
      mockDb.maybeSingle.mockResolvedValueOnce({ data: { id: 'v1' } });
      const res = await service.getVersion('q1', 'v1');
      expect(mockDb.eq).toHaveBeenCalledWith('id', 'v1');
      expect(res).toEqual({ id: 'v1' });
    });

    it('should return latest active version if no ID', async () => {
      mockDb.maybeSingle.mockResolvedValueOnce({ data: { id: 'latest' } });
      await service.getVersion('q1');
      expect(mockDb.eq).toHaveBeenCalledWith('is_active', true);
      expect(mockDb.order).toHaveBeenCalledWith('version_number', { ascending: false });
    });
  });

  describe('purgeVersions', () => {
    it('should call rpc with correct params', async () => {
      mockDb.rpc.mockResolvedValueOnce({ data: 5, error: null });
      const count = await service.purgeVersions(60);
      expect(mockDb.rpc).toHaveBeenCalledWith('purge_old_quotation_versions', { retention_days: 60 });
      expect(count).toBe(5);
    });
  });
});
