
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CoreQuoteService } from './CoreQuoteService';
import { DomainService } from '../DomainService';
import { RequestContext, LineItem } from './types';

// Mock DomainService
vi.mock('../DomainService', () => ({
  DomainService: {
    getAllDomains: vi.fn(),
  },
}));

describe('CoreQuoteService', () => {
  const mockLogisticsDomainId = 'domain-123';
  const mockBankingDomainId = 'domain-456';
  const mockUnknownDomainId = 'domain-999';

  const mockDomains = [
    { id: mockLogisticsDomainId, code: 'LOGISTICS', name: 'Logistics' },
    { id: mockBankingDomainId, code: 'BANKING', name: 'Banking' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (DomainService.getAllDomains as any).mockResolvedValue(mockDomains);
  });

  it('should delegate to Logistics engine for logistics domain', async () => {
    const context: RequestContext = {
      tenantId: 'tenant-1',
      domainId: mockLogisticsDomainId,
      currency: 'USD'
    };
    
    const items: LineItem[] = [
      { description: 'Test Item', quantity: 5, attributes: {} }
    ];

    const result = await CoreQuoteService.calculate(context, items);

    // Logistics engine mock logic: quantity * 10
    expect(result.totalAmount).toBe(50);
    expect(result.currency).toBe('USD');
    expect(result.breakdown).toBeDefined();
  });

  it('should throw error if domain not found', async () => {
    const context: RequestContext = {
      tenantId: 'tenant-1',
      domainId: mockUnknownDomainId,
      currency: 'USD'
    };

    await expect(CoreQuoteService.calculate(context, [])).rejects.toThrow(`Domain with ID ${mockUnknownDomainId} not found`);
  });

  it('should throw error if no engine registered for domain', async () => {
    const context: RequestContext = {
      tenantId: 'tenant-1',
      domainId: mockBankingDomainId, // BANKING engine is not registered yet
      currency: 'USD'
    };

    await expect(CoreQuoteService.calculate(context, [])).rejects.toThrow('No quotation engine registered for domain code: BANKING');
  });

  it('should validate items before calculation', async () => {
    const context: RequestContext = {
      tenantId: 'tenant-1',
      domainId: mockLogisticsDomainId,
      currency: 'USD'
    };

    // Invalid item (quantity 0)
    const items: LineItem[] = [
      { description: 'Bad Item', quantity: 0, attributes: {} }
    ];

    await expect(CoreQuoteService.calculate(context, items)).rejects.toThrow('Validation failed');
  });
});
