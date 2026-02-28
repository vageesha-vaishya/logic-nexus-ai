import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuotationConfigurationService } from '../QuotationConfigurationService';

describe('QuotationConfigurationService', () => {
  let mockDb: any;
  let service: QuotationConfigurationService;

  beforeEach(() => {
    mockDb = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
      single: vi.fn(),
    };
    service = new QuotationConfigurationService(mockDb);
  });

  describe('getConfiguration', () => {
    it('should return existing configuration', async () => {
      const mockConfig = { id: 'c1', default_module: 'composer' };
      mockDb.maybeSingle.mockResolvedValue({ data: mockConfig, error: null });

      const result = await service.getConfiguration('t1');
      expect(result).toEqual(mockConfig);
      expect(mockDb.from).toHaveBeenCalledWith('quotation_configuration');
    });

    it('should create default configuration if missing', async () => {
      mockDb.maybeSingle.mockResolvedValue({ data: null, error: null });
      const defaultConfig = { 
        id: 'c2', 
        tenant_id: 't1', 
        default_module: 'composer',
        smart_mode_enabled: false,
        multi_option_enabled: true
      };
      mockDb.single.mockResolvedValue({ data: defaultConfig, error: null });

      const result = await service.getConfiguration('t1');
      expect(mockDb.insert).toHaveBeenCalledWith(expect.objectContaining({
        tenant_id: 't1',
        default_module: 'composer'
      }));
      expect(result).toEqual(defaultConfig);
    });
  });

  describe('updateConfiguration', () => {
    it('should update configuration fields', async () => {
      const updatedConfig = { id: 'c1', smart_mode_enabled: true };
      mockDb.single.mockResolvedValue({ data: updatedConfig, error: null });

      const result = await service.updateConfiguration('t1', { smart_mode_enabled: true });
      expect(mockDb.update).toHaveBeenCalledWith({ smart_mode_enabled: true });
      expect(result).toEqual(updatedConfig);
    });
  });

  describe('setUserSmartModePreference', () => {
    it('should update user profile preferences', async () => {
      // Setup mock chain for SELECT
      mockDb.single.mockResolvedValue({ 
        data: { quotation_preferences: { existing_setting: true } }, 
        error: null 
      });
      
      // Setup mock chain for UPDATE
      mockDb.update.mockReturnThis(); 
      mockDb.eq.mockReturnThis(); // .eq returns query builder, which has .single() if needed or promise

      await service.setUserSmartModePreference('u1', true);

      expect(mockDb.update).toHaveBeenCalledWith({
        quotation_preferences: { 
          existing_setting: true,
          smart_mode_active: true 
        }
      });
    });
  });
});
