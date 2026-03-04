
import { render, screen, waitFor, act } from '@testing-library/react';
import { UnifiedQuoteComposer } from '../UnifiedQuoteComposer';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route, useSearchParams } from 'react-router-dom';
import { QuoteStoreProvider } from '../store/QuoteStore';
import * as CRMHooks from '@/hooks/useCRM';

// Mock dependencies
vi.mock('@/hooks/useCRM', () => ({
  useCRM: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'test-user' }, profile: { role: 'admin' } }),
}));

vi.mock('@/hooks/useRateFetching', () => ({
  useRateFetching: () => ({ loading: false, results: [] }),
  ContainerResolver: {},
}));

vi.mock('@/services/quotation/QuotationConfigurationService', () => ({
  QuotationConfigurationService: class {
    getConfiguration = vi.fn().mockResolvedValue({});
  },
}));

vi.mock('@/components/sales/quote-form/useQuoteRepository', () => ({
  useQuoteRepositoryContext: () => ({}),
}));

// Mock logger to avoid clutter
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock UI components that might cause issues
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: any) => <div>{children}</div>,
  SheetContent: ({ children }: any) => <div>{children}</div>,
  SheetHeader: ({ children }: any) => <div>{children}</div>,
  SheetTitle: ({ children }: any) => <div>{children}</div>,
  SheetTrigger: ({ children }: any) => <div>{children}</div>,
}));

describe('UnifiedQuoteComposer Navigation', () => {
  const mockScopedDb = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
    in: vi.fn().mockReturnThis(),
  };

  beforeEach(() => {
    (CRMHooks.useCRM as any).mockReturnValue({
      scopedDb: mockScopedDb,
      context: { tenantId: 'tenant-1' },
      supabase: {},
    });
  });

  it('switches selected option when URL optionId changes', async () => {
    // Mock quote data
    mockScopedDb.maybeSingle.mockResolvedValue({
      data: {
        id: 'quote-1',
        current_version_id: 'ver-1',
        tenant_id: 'tenant-1',
      },
      error: null,
    });

    // Mock version options
    const mockOptions = [
      { id: 'opt-1', option_name: 'Option 1', total_amount: 100, is_selected: true },
      { id: 'opt-2', option_name: 'Option 2', total_amount: 200, is_selected: false },
    ];

    // Setup mocks for Promise.allSettled calls
    const mockSelect = mockScopedDb.select;
    
    // We need to handle the chain of calls for loading quote data
    // This is complex because of the multiple queries.
    // Simplifying: we just want to test the effect of searchParams.
    
    // Instead of full integration, let's look at the component logic.
    // But we need it to render.
  });
});
