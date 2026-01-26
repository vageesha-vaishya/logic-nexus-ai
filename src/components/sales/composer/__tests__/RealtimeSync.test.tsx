import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MultiModalQuoteComposer } from '../../MultiModalQuoteComposer';

// Create a chainable mock object
const mockQueryBuilder = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'opt-1', tenant_id: 'tenant-123' }, error: null }),
  single: vi.fn().mockResolvedValue({ data: { id: 'opt-1', tenant_id: 'tenant-123' }, error: null }),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  filter: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis()
};

// Make builder thenable for direct awaits
(mockQueryBuilder as any).then = (resolve: any) => resolve({ data: [], error: null });

const mockScopedDb = {
  client: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { user_metadata: { tenant_id: 'tenant-123' } } } })
    }
  },
  from: vi.fn(() => mockQueryBuilder),
};

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    scopedDb: mockScopedDb
  })
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() })
}));

vi.mock('@/hooks/useAiAdvisor', () => ({
  useAiAdvisor: () => ({ invokeAiAdvisor: vi.fn() })
}));

// Mock child components
vi.mock('../../composer/QuoteDetailsStep', () => ({ QuoteDetailsStep: () => <div>Quote Details</div> }));
vi.mock('../../composer/LegsConfigurationStep', () => ({ LegsConfigurationStep: () => <div>Legs Config</div> }));
vi.mock('../../composer/ChargesManagementStep', () => ({ ChargesManagementStep: () => <div>Charges</div> }));
vi.mock('../../composer/ReviewAndSaveStep', () => ({ ReviewAndSaveStep: () => <div>Review</div> }));
vi.mock('../../composer/QuoteOptionsOverview', () => ({ QuoteOptionsOverview: () => <div>Options Overview</div> }));

describe('MultiModalQuoteComposer Realtime Sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock responses
    // Specific response for options list query in ensureOptionExists
    mockQueryBuilder.select.mockReturnThis();
    mockQueryBuilder.eq.mockReturnThis();
    mockQueryBuilder.order.mockReturnThis();
    
    // Default resolve
    (mockQueryBuilder as any).then = (resolve: any) => resolve({ data: [], error: null });
  });

  it('reloads data when lastSyncTimestamp changes', async () => {
    // Setup specific mock for option data
    mockQueryBuilder.maybeSingle.mockResolvedValue({ data: { id: 'opt-1', tenant_id: 'tenant-123' }, error: null });
    
    const { rerender } = render(
      <MultiModalQuoteComposer 
        quoteId="quote-123" 
        versionId="ver-123" 
        optionId="opt-1" 
        lastSyncTimestamp={0} 
      />
    );

    // Initial load
    await waitFor(() => {
      expect(mockScopedDb.from).toHaveBeenCalledWith('quotation_version_options', true);
    });

    mockScopedDb.from.mockClear();

    // Trigger sync
    rerender(
      <MultiModalQuoteComposer 
        quoteId="quote-123" 
        versionId="ver-123" 
        optionId="opt-1" 
        lastSyncTimestamp={Date.now()} 
      />
    );

    // Should reload option data
    await waitFor(() => {
      expect(mockScopedDb.from).toHaveBeenCalledWith('quotation_version_options', true);
    });
  });

  it('refreshes options list when sync triggers (simulating AI adding an option)', async () => {
    // Mock response for options list
    const mockOptions = [
      { id: 'opt-1', option_name: 'Manual Option' },
      { id: 'opt-2', option_name: 'AI Generated Option' } // New option
    ];
    
    // When querying list (no single/maybeSingle called), return array
    (mockQueryBuilder as any).then = (resolve: any) => resolve({ data: mockOptions, error: null });

    const { rerender } = render(
      <MultiModalQuoteComposer 
        quoteId="quote-123" 
        versionId="ver-123" 
        optionId="opt-1" 
        lastSyncTimestamp={0} 
      />
    );

    await waitFor(() => {
        expect(mockScopedDb.from).toHaveBeenCalled();
    });

    mockScopedDb.from.mockClear();

    // Trigger sync
    rerender(
      <MultiModalQuoteComposer 
        quoteId="quote-123" 
        versionId="ver-123" 
        optionId="opt-1" 
        lastSyncTimestamp={Date.now()} 
      />
    );

    // Should query options list (ensureOptionExists calls this)
    await waitFor(() => {
      // It queries quotation_version_options with select including legs
      expect(mockScopedDb.from).toHaveBeenCalledWith('quotation_version_options', true);
    });
  });

  it('reloads data when AI Quote Request update triggers sync', async () => {
    // This test simulates the scenario where QuoteNew detects an ai_quote_requests change
    // and updates lastSyncTimestamp, prompting the Composer to refresh.
    
    const { rerender } = render(
      <MultiModalQuoteComposer 
        quoteId="quote-123" 
        versionId="ver-123" 
        optionId="opt-1" 
        lastSyncTimestamp={0} 
      />
    );

    await waitFor(() => {
        expect(mockScopedDb.from).toHaveBeenCalled();
    });

    mockScopedDb.from.mockClear();

    // Simulate sync triggered by AI request completion
    rerender(
      <MultiModalQuoteComposer 
        quoteId="quote-123" 
        versionId="ver-123" 
        optionId="opt-1" 
        lastSyncTimestamp={Date.now()} 
      />
    );

    // Should trigger reload of initial data/options
    await waitFor(() => {
      expect(mockScopedDb.from).toHaveBeenCalled();
    });
  });
});
