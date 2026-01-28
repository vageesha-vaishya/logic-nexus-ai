
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaxManagementService } from './TaxManagementService';

// Mock functions
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockSingle = vi.fn();
const mockSchema = vi.fn();
const mockFrom = vi.fn();

// Mock the supabase client module
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    schema: (schema: string) => mockSchema(schema)
  }
}));

describe('TaxManagementService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default chainable mocks
    mockSchema.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ 
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete
    });
    
    // Select chain
    mockSelect.mockReturnValue({ 
      eq: mockEq, 
      order: mockOrder,
      single: mockSingle
    });
    
    // Insert chain
    mockInsert.mockReturnValue({ 
      select: () => ({ single: mockSingle }) 
    });

    // Update chain
    mockUpdate.mockReturnValue({ 
      eq: () => ({ 
        select: () => ({ single: mockSingle }) 
      }) 
    });

    // Delete chain
    mockDelete.mockReturnValue({ eq: mockEq });
    
    // Query modifiers
    mockEq.mockReturnValue({ single: mockSingle });
  });

  describe('getJurisdictions', () => {
    it('should fetch all jurisdictions when no parentId is provided', async () => {
      const mockData = [
        { id: '1', code: 'US', name: 'United States', type: 'COUNTRY', parent_id: null }
      ];
      mockOrder.mockResolvedValue({ data: mockData, error: null });

      const result = await TaxManagementService.getJurisdictions();

      expect(mockSchema).toHaveBeenCalledWith('finance');
      expect(mockFrom).toHaveBeenCalledWith('tax_jurisdictions');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('US');
    });

    it('should filter by parentId when provided', async () => {
      const mockData = [
        { id: '2', code: 'US-CA', name: 'California', type: 'STATE', parent_id: '1' }
      ];
      // When parentId is provided, the chain is select -> eq -> order
      // We need to adjust the mock for this specific flow if needed, 
      // but our default mockSelect returns an object with eq which returns... 
      // Wait, let's fix the mock chain for this case.
      
      const mockEqReturn = { order: mockOrder };
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue(mockEqReturn);
      mockOrder.mockResolvedValue({ data: mockData, error: null });

      const result = await TaxManagementService.getJurisdictions('1');

      expect(mockEq).toHaveBeenCalledWith('parent_id', '1');
      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('US-CA');
    });
  });

  describe('createJurisdiction', () => {
    it('should create a new jurisdiction', async () => {
      const newJurisdiction = {
        code: 'US-NY',
        name: 'New York',
        type: 'STATE' as const,
        parentId: '1'
      };

      const mockResponse = {
        id: '3',
        code: 'US-NY',
        name: 'New York',
        type: 'STATE',
        parent_id: '1',
        created_at: '2026-01-28T12:00:00Z'
      };

      mockSingle.mockResolvedValue({ data: mockResponse, error: null });

      const result = await TaxManagementService.createJurisdiction(newJurisdiction);

      expect(mockInsert).toHaveBeenCalledWith({
        code: 'US-NY',
        name: 'New York',
        type: 'STATE',
        parent_id: '1'
      });
      expect(result.id).toBe('3');
      expect(result.code).toBe('US-NY');
    });
  });

  describe('createTaxRule', () => {
    it('should create a new tax rule', async () => {
      const newRule = {
        jurisdictionId: '3',
        rate: 0.08875,
        priority: 1,
        effectiveFrom: new Date('2026-01-01'),
        ruleType: 'STANDARD' as const
      };

      const mockResponse = {
        id: 'rule-1',
        jurisdiction_id: '3',
        tax_code_id: null,
        rate: 0.08875,
        priority: 1,
        effective_from: '2026-01-01T00:00:00.000Z',
        rule_type: 'STANDARD'
      };

      mockSingle.mockResolvedValue({ data: mockResponse, error: null });

      const result = await TaxManagementService.createTaxRule(newRule);

      expect(mockSchema).toHaveBeenCalledWith('finance');
      expect(mockFrom).toHaveBeenCalledWith('tax_rules');
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        jurisdiction_id: '3',
        rate: 0.08875
      }));
      expect(result.id).toBe('rule-1');
      expect(result.rate).toBe(0.08875);
    });
  });
});
