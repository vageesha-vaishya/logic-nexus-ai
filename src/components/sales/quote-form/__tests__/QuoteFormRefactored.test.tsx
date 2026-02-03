
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuoteFormRefactored } from '../QuoteFormRefactored';
import { vi, describe, it, expect, beforeAll } from 'vitest';
import { BrowserRouter } from 'react-router-dom';

// Mock ResizeObserver
beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

// Mock dependencies
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
    session: { access_token: 'test-token' }
  })
}));

vi.mock('../QuoteContext', () => ({
  QuoteDataProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useQuoteContext: () => ({
    serviceTypes: [],
    services: [],
    carriers: [],
    ports: [],
    accounts: [],
    contacts: [],
    opportunities: [],
    isLoadingOpportunities: false,
    setResolvedTenantId: vi.fn(),
    resolvedTenantId: 'test-tenant',
    setAccounts: vi.fn(),
    setOpportunities: vi.fn(),
    setServices: vi.fn(),
    setContacts: vi.fn(),
    setResolvedServiceLabels: vi.fn()
  })
}));

vi.mock('../useQuoteData', () => ({
  useQuoteData: () => ({
    serviceTypes: [],
    services: [],
    carriers: [],
    ports: [],
    accounts: [],
    contacts: [],
    opportunities: [],
    isLoadingOpportunities: false,
    setResolvedTenantId: vi.fn(),
    resolvedTenantId: 'test-tenant',
    setAccounts: vi.fn(),
    setOpportunities: vi.fn(),
    setServices: vi.fn(),
    setContacts: vi.fn(),
    setResolvedServiceLabels: vi.fn()
  })
}));

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    supabase: {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null }),
            data: []
          }),
          data: []
        })
      }),
      rpc: () => Promise.resolve({ data: null, error: null })
    },
    context: { tenantId: 'test-tenant' },
    scopedDb: {
        from: () => ({
            select: () => ({
                eq: () => ({
                    single: () => Promise.resolve({ data: null })
                }),
                data: []
            })
        })
    }
  })
}));

vi.mock('@/services/plugins/PluginRegistry', () => ({
  PluginRegistry: {
    getPlugin: () => ({
      getQuotationEngine: () => ({
        calculate: () => Promise.resolve({
          totalAmount: 1000,
          breakdown: { freight: 1000 }
        })
      })
    })
  }
}));

describe('QuoteFormRefactored', () => {
  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <QuoteFormRefactored />
      </BrowserRouter>
    );
  };

  it('renders all main sections', async () => {
    renderComponent();
    
    // Check for section headers (numbered steps)
    expect(screen.getByText('General Information')).toBeInTheDocument();
    expect(screen.getByText('Logistics & Routing')).toBeInTheDocument();
    expect(screen.getAllByText('Cargo Details').length).toBeGreaterThan(0);
    expect(screen.getByText('Financials')).toBeInTheDocument();
  });

  it('allows adding line items with discount field', async () => {
    renderComponent();

    // Find "Add Item" button
    const addButton = screen.getByText('Add Item');
    fireEvent.click(addButton);

    // Check if item fields appear
    await waitFor(() => {
        expect(screen.getByText('Product / Commodity')).toBeInTheDocument();
        expect(screen.getByText('Disc %')).toBeInTheDocument();
    });

    // Check inputs exist
    const inputs = screen.getAllByRole('spinbutton');
    // We expect Quantity, Unit Price, Discount, Weight, Volume (5 inputs per item)
    // Plus potentially others if default values render inputs
    expect(inputs.length).toBeGreaterThanOrEqual(5);
  });

  it('shows calculate estimate button in financials', async () => {
    renderComponent();
    expect(screen.getByText('Calculate Estimate')).toBeInTheDocument();
  });
});
