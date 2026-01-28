
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaxEngine } from './TaxEngine';
import { NexusDeterminationRequest, TaxCalculationRequest } from './types';

// Mock functions
const mockSchema = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockLte = vi.fn();
const mockOr = vi.fn();
const mockOrder = vi.fn();

// Mock the supabase client module
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    schema: (schema: string) => mockSchema(schema)
  }
}));

describe('TaxEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock chain
    mockSchema.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ lte: mockLte });
    mockLte.mockReturnValue({ or: mockOr });
    mockOr.mockReturnValue({ order: mockOrder });
  });

  describe('determineNexus', () => {
    it('should determine nexus based on destination and mock tenant settings', async () => {
      // Mock Data Response
      const mockNexusData = [
        { jurisdiction_id: '1', tax_jurisdictions: { code: 'US' } },
        { jurisdiction_id: '2', tax_jurisdictions: { code: 'US-CA' } },
        { jurisdiction_id: '3', tax_jurisdictions: { code: 'US-NY' } },
        { jurisdiction_id: '4', tax_jurisdictions: { code: 'US-TX' } },
        { jurisdiction_id: '5', tax_jurisdictions: { code: 'CA' } },
        { jurisdiction_id: '6', tax_jurisdictions: { code: 'GB' } }
      ];

      mockOr.mockResolvedValue({ data: mockNexusData, error: null });

      const request: NexusDeterminationRequest = {
        origin: {
          street: '123 Origin St',
          city: 'Origin City',
          state: 'TX',
          zip: '75001',
          country: 'US'
        },
        destination: {
          street: '456 Dest St',
          city: 'Los Angeles',
          state: 'CA',
          zip: '90001',
          country: 'US'
        },
        tenantId: 'tenant-123'
      };

      const result = await TaxEngine.determineNexus(request);

      // Verify Supabase calls
      expect(mockSchema).toHaveBeenCalledWith('finance');
      expect(mockFrom).toHaveBeenCalledWith('tenant_nexus');
      expect(mockEq).toHaveBeenCalledWith('tenant_id', 'tenant-123');
      
      // Verify Logic
      expect(result.hasNexus).toBe(true);
      expect(result.jurisdictions).toContain('US');
      expect(result.jurisdictions).toContain('US-CA');
    });

    it('should return no nexus if destination is not in tenant nexus list', async () => {
       const request: NexusDeterminationRequest = {
        origin: {
          street: '123 Origin St',
          city: 'Origin City',
          state: 'TX',
          zip: '75001',
          country: 'US'
        },
        destination: {
          street: '789 Dest St',
          city: 'Paris',
          state: 'IDF',
          zip: '75000',
          country: 'FR'
        },
        tenantId: 'tenant-123'
      };

      // Mock Data Response (Same nexus list, but destination is FR)
      const mockNexusData = [
        { jurisdiction_id: '1', tax_jurisdictions: { code: 'US' } },
        { jurisdiction_id: '2', tax_jurisdictions: { code: 'US-CA' } }
      ];
      
      mockOr.mockResolvedValue({ data: mockNexusData, error: null });

      const result = await TaxEngine.determineNexus(request);

      expect(result.hasNexus).toBe(false);
      expect(result.jurisdictions).toHaveLength(0);
    });
    
    it('should handle database errors gracefully', async () => {
        const request: NexusDeterminationRequest = {
            origin: { street: '', city: '', state: '', zip: '', country: '' },
            destination: { street: '', city: '', state: 'CA', zip: '', country: 'US' },
            tenantId: 'tenant-error'
        };

        mockOr.mockResolvedValue({ data: null, error: { message: 'DB Error' } });

        const result = await TaxEngine.determineNexus(request);

        expect(result.hasNexus).toBe(false);
        expect(result.jurisdictions).toEqual([]);
    });
  });

  describe('calculate', () => {
    it('should calculate tax using standard rate when no specific tax code matches', async () => {
      // Mock Rules: Standard Rate 8.25% (0.0825)
      const mockRules = [
        {
          rate: 0.0825,
          rule_type: 'STANDARD',
          tax_codes: null,
          tax_jurisdictions: { code: 'US-TX' }
        }
      ];

      mockOrder.mockResolvedValue({ data: mockRules, error: null });

      const request: TaxCalculationRequest = {
        jurisdictionCode: 'US-TX',
        items: [
          { amount: 100 }
        ]
      };

      const result = await TaxEngine.calculate(request);

      expect(mockSchema).toHaveBeenCalledWith('finance');
      expect(mockFrom).toHaveBeenCalledWith('tax_rules');
      expect(mockEq).toHaveBeenCalledWith('tax_jurisdictions.code', 'US-TX');
      
      expect(result.totalTax).toBe(8.25);
      expect(result.breakdown).toHaveLength(1);
      expect(result.breakdown[0].rate).toBe(0.0825);
    });

    it('should apply specific tax code override if available', async () => {
      // Mock Rules: Standard Rate 10%, Reduced Rate 5% for 'BOOKS'
      const mockRules = [
        {
          rate: 0.05,
          rule_type: 'REDUCED',
          tax_codes: { code: 'BOOKS' },
          tax_jurisdictions: { code: 'GB' }
        },
        {
          rate: 0.10,
          rule_type: 'STANDARD',
          tax_codes: null,
          tax_jurisdictions: { code: 'GB' }
        }
      ];

      mockOrder.mockResolvedValue({ data: mockRules, error: null });

      const request: TaxCalculationRequest = {
        jurisdictionCode: 'GB',
        items: [
          { amount: 100, taxCode: 'BOOKS' }, // Should be 5%
          { amount: 200 } // Should be 10%
        ]
      };

      const result = await TaxEngine.calculate(request);

      // Item 1: 100 * 0.05 = 5.00
      // Item 2: 200 * 0.10 = 20.00
      // Total: 25.00
      expect(result.totalTax).toBe(25.00);
      
      // Verify line items
      expect(result.lineItems).toHaveLength(2);
      expect(result.lineItems[0].taxAmount).toBe(5.00);
      expect(result.lineItems[0].taxRate).toBe(0.05);
      expect(result.lineItems[1].taxAmount).toBe(20.00);
      expect(result.lineItems[1].taxRate).toBe(0.10);
    });
    
    it('should default to 0 tax if no rules found', async () => {
        mockOrder.mockResolvedValue({ data: [], error: null });

        const request: TaxCalculationRequest = {
            jurisdictionCode: 'NOWHERE',
            items: [{ amount: 100 }]
        };

        const result = await TaxEngine.calculate(request);

        expect(result.totalTax).toBe(0.00);
        expect(result.breakdown).toEqual([]);
    });
  });
});
