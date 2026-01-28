
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CoreQuoteService } from './CoreQuoteService';
import { DomainService } from '../DomainService';
import { RequestContext, LineItem } from './types';

// Mock DomainService to return different domains
vi.mock('../DomainService', () => ({
  DomainService: {
    getAllDomains: vi.fn(),
  },
}));

describe('Mock Adapters Integration (Multi-Tenancy)', () => {
  const mockDomains = [
    { id: 'domain-logistics', code: 'LOGISTICS', name: 'Logistics' },
    { id: 'domain-banking', code: 'BANKING', name: 'Banking' },
    { id: 'domain-telecom', code: 'TELECOM', name: 'Telecom' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (DomainService.getAllDomains as any).mockResolvedValue(mockDomains);
  });

  describe('Banking Adapter', () => {
    it('should process a loan application for a banking tenant', async () => {
      const context: RequestContext = {
        tenantId: 'tenant-banking-1',
        domainId: 'domain-banking',
        userId: 'applicant-1',
        currency: 'USD'
      };

      const items: LineItem[] = [
        {
          description: 'Car Loan',
          quantity: 25000, // Amount
          attributes: { type: 'LOAN_APPLICATION', termMonths: 36 }
        }
      ];

      const result = await CoreQuoteService.calculate(context, items);

      expect(result.currency).toBe('USD');
      expect(result.breakdown.offers).toHaveLength(1);
      
      const offer = result.breakdown.offers[0];
      expect(offer.status).toBeDefined();
      expect(offer.amount).toBe(25000);
      
      // If approved, interest rate should be calculated
      if (offer.status === 'APPROVED') {
        expect(result.totalAmount).toBeGreaterThan(0); // Total Interest
      }
    });

    it('should reject a loan exceeding tenant risk limit', async () => {
      // tenant-banking-1 has 50k limit
      const context: RequestContext = {
        tenantId: 'tenant-banking-1',
        domainId: 'domain-banking',
        userId: 'applicant-2',
        currency: 'USD'
      };

      const items: LineItem[] = [
        {
          description: 'Huge Loan',
          quantity: 1000000, // Exceeds limit
          attributes: { type: 'LOAN_APPLICATION' }
        }
      ];

      const result = await CoreQuoteService.calculate(context, items);
      const offer = result.breakdown.offers[0];
      expect(offer.status).toBe('REJECTED');
    });
  });

  describe('Telecom Adapter', () => {
    it('should calculate cost for a valid telecom plan', async () => {
      const context: RequestContext = {
        tenantId: 'tenant-telecom-1',
        domainId: 'domain-telecom',
        userId: 'subscriber-1',
        currency: 'USD'
      };

      // Plan 'p1' exists in tenant-telecom-1
      const items: LineItem[] = [
        {
          description: 'New Connection',
          quantity: 2, // 2 lines
          attributes: { planId: 'p1' }
        }
      ];

      const result = await CoreQuoteService.calculate(context, items);

      // p1 price is 10 * 2 = 20
      expect(result.totalAmount).toBe(20);
      expect(result.breakdown.plans).toHaveLength(1);
      expect(result.breakdown.plans[0].name).toBe('Basic Starter');
    });

    it('should handle invalid plan for tenant', async () => {
      const context: RequestContext = {
        tenantId: 'tenant-telecom-1',
        domainId: 'domain-telecom',
        userId: 'subscriber-1',
        currency: 'USD'
      };

      // Plan 'p3' exists in telecom-2, not telecom-1
      const items: LineItem[] = [
        {
          description: 'Invalid Plan',
          quantity: 1,
          attributes: { planId: 'p3' }
        }
      ];

      const result = await CoreQuoteService.calculate(context, items);

      expect(result.breakdown.plans[0].error).toBeDefined();
    });
  });
});
