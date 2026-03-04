
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { UnifiedQuoteComposer } from './UnifiedQuoteComposer';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  LogLevel: {
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR',
    DEBUG: 'DEBUG'
  }
}));

vi.mock('@/lib/supabase-functions', () => ({
  invokeAnonymous: vi.fn(),
  enrichPayload: vi.fn(),
}));

// Global mock for useCRM
const mockFrom = vi.fn();

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    scopedDb: {
      from: mockFrom,
    },
    context: { session: { user: { id: 'test-user' } }, tenantId: 'tenant-1' },
    supabase: {
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } } }) }
    }
  })
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'test-user' } })
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() })
}));

vi.mock('@/hooks/useContainerRefs', () => ({
  useContainerRefs: () => ({ containerTypes: [], containerSizes: [] })
}));

vi.mock('@/hooks/useRateFetching', () => ({
  useRateFetching: () => ({
    loading: false,
    results: [],
    fetchRates: vi.fn(),
    error: null
  }),
  ContainerResolver: { resolveContainerType: vi.fn() }
}));

vi.mock('@/hooks/useAiAdvisor', () => ({
  useAiAdvisor: () => ({ invokeAiAdvisor: vi.fn() })
}));

vi.mock('@/components/sales/quote-form/useQuoteRepository', () => ({
  useQuoteRepositoryContext: () => ({})
}));

// Mock services
vi.mock('@/services/quotation/QuotationNumberService', () => ({
  QuotationNumberService: {
    generateQuoteNumber: vi.fn().mockReturnValue('QT-123')
  }
}));

vi.mock('@/services/pricing.service', () => ({
  PricingService: {
    calculatePrice: vi.fn().mockReturnValue(100)
  }
}));

vi.mock('@/services/QuoteOptionService', () => ({
  QuoteOptionService: {
    saveOption: vi.fn()
  }
}));

vi.mock('@/services/quotation/QuotationOptionCrudService', () => ({
  QuotationOptionCrudService: {
    saveOption: vi.fn()
  }
}));

vi.mock('@/services/quotation/QuotationRankingService', () => ({
  QuotationRankingService: {
    rankOptions: vi.fn().mockImplementation((options) => options.map((o: any) => ({ ...o, rank_score: 1 })))
  }
}));

vi.mock('@/services/quotation/QuotationConfigurationService', () => {
  const mockGetConfiguration = vi.fn().mockResolvedValue({
    auto_ranking_criteria: {
      cost: 0.4,
      transit_time: 0.3,
      reliability: 0.3
    }
  });

  class MockService {
    constructor(db: any) {}
    getConfiguration = mockGetConfiguration;
  }

  return {
    QuotationConfigurationService: MockService
  };
});

// Mock UI components
vi.mock('./FormZone', () => ({
  FormZone: () => <div data-testid="form-zone">Form Zone</div>
}));

vi.mock('./ResultsZone', () => ({
  ResultsZone: ({ results, loading }: any) => (
    <div data-testid="results-zone">
      {loading ? 'Loading...' : `Results: ${results ? results.length : 0}`}
    </div>
  )
}));

vi.mock('./FinalizeSection', () => ({
  FinalizeSection: () => <div data-testid="finalize-section">Finalize Section</div>
}));

describe('UnifiedQuoteComposer Reproduction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load saved options when versionId is provided', async () => {
     const quoteId = '00000000-0000-0000-0000-000000000001';
     const versionId = '00000000-0000-0000-0000-000000000002';
     const optionId = '00000000-0000-0000-0000-000000000003';

     mockFrom.mockImplementation((table: string) => {
       const chain: any = {
         select: vi.fn().mockReturnThis(),
         eq: vi.fn().mockReturnThis(),
         in: vi.fn().mockReturnThis(),
         order: vi.fn().mockReturnThis(),
         maybeSingle: vi.fn(),
         single: vi.fn(),
         limit: vi.fn().mockReturnThis(),
         abortSignal: vi.fn().mockReturnThis(),
       };
       
       // Add promise interface
       const addData = (data: any) => {
           chain.then = (resolve: any, reject: any) => {
               return Promise.resolve({ data, error: null }).then(resolve, reject);
           };
       };

       if (table === 'quotes') {
         chain.maybeSingle.mockResolvedValue({ 
             data: { 
                 id: quoteId, 
                 current_version_id: versionId,
                 quote_number: 'QT-123',
                 tenant_id: 'tenant-1'
             }, 
             error: null 
         });
       } else if (table === 'quotation_version_options') {
         addData([{ id: optionId, option_name: 'Test Option', total_amount: 1000 }]);
       } else if (table === 'quotation_version_option_legs') {
         addData([]);
       } else if (table === 'quote_charges') {
         addData([]);
       } else {
         addData([]);
       }
       
       return chain;
     });

     render(
       <MemoryRouter>
         <UnifiedQuoteComposer quoteId={quoteId} versionId={versionId} />
       </MemoryRouter>
     );

     await waitFor(() => {
       expect(screen.getByTestId('results-zone')).toHaveTextContent('Results: 1');
     });
  });

  it('should load saved options when versionId is initially undefined but updated later', async () => {
     const quoteId = '00000000-0000-0000-0000-000000000001';
     const versionId = '00000000-0000-0000-0000-000000000002';
     const optionId = '00000000-0000-0000-0000-000000000003';

     mockFrom.mockImplementation((table: string) => {
       const chain: any = {
         select: vi.fn().mockReturnThis(),
         eq: vi.fn().mockReturnThis(),
         in: vi.fn().mockReturnThis(),
         order: vi.fn().mockReturnThis(),
         maybeSingle: vi.fn(),
         single: vi.fn(),
         limit: vi.fn().mockReturnThis(),
         abortSignal: vi.fn().mockReturnThis(),
       };
       
       const addData = (data: any) => {
           chain.then = (resolve: any, reject: any) => {
               return Promise.resolve({ data, error: null }).then(resolve, reject);
           };
       };

       if (table === 'quotes') {
         // Return quote with current_version_id
         chain.maybeSingle.mockResolvedValue({ 
             data: { 
                 id: quoteId, 
                 current_version_id: versionId,
                 quote_number: 'QT-123',
                 tenant_id: 'tenant-1'
             }, 
             error: null 
         });
       } else if (table === 'quotation_version_options') {
         addData([{ id: optionId, option_name: 'Test Option', total_amount: 1000 }]);
       } else if (table === 'quotation_version_option_legs') {
         addData([]);
       } else if (table === 'quote_charges') {
         addData([]);
       } else {
         addData([]);
       }
       
       return chain;
     });

     const { rerender } = render(
       <MemoryRouter>
         <UnifiedQuoteComposer quoteId={quoteId} versionId={undefined} />
       </MemoryRouter>
     );

     // It should load because current_version_id is on the quote
     await waitFor(() => {
       expect(screen.getByTestId('results-zone')).toHaveTextContent('Results: 1');
     });
     
     // Rerender with explicit versionId
     rerender(
       <MemoryRouter>
         <UnifiedQuoteComposer quoteId={quoteId} versionId={versionId} />
       </MemoryRouter>
     );
     
     await waitFor(() => {
       expect(screen.getByTestId('results-zone')).toHaveTextContent('Results: 1');
     });
  });
});
