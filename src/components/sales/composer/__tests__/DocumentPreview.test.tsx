import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { DocumentPreview } from '../DocumentPreview';
import { LandedCostService } from '@/services/quotation/LandedCostService';

// Mock dependencies
vi.mock('@/components/ui/tabs', () => {
  const React = require('react');
  const TabsContext = React.createContext({ value: 'quote', setValue: (v: string) => {} });

  return {
    Tabs: ({ children, defaultValue, className }: any) => {
      const [value, setValue] = React.useState(defaultValue || 'quote');
      return (
        <TabsContext.Provider value={{ value, setValue }}>
          <div className={className}>{children}</div>
        </TabsContext.Provider>
      );
    },
    TabsList: ({ children, className }: any) => <div className={className}>{children}</div>,
    TabsTrigger: ({ children, value, onClick, className }: any) => {
      const context = React.useContext(TabsContext);
      return (
        <button 
          className={className}
          onClick={(e) => {
            context.setValue(value);
            onClick && onClick(e);
          }}
          role="tab"
          aria-selected={context.value === value}
        >
          {children}
        </button>
      );
    },
    TabsContent: ({ children, value, className }: any) => {
      const context = React.useContext(TabsContext);
      if (context.value !== value) return null;
      return <div className={className} data-testid={`tab-content-${value}`}>{children}</div>;
    },
  };
});

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
  DialogTrigger: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/services/quotation/LandedCostService', () => ({
  LandedCostService: {
    calculate: vi.fn()
  }
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: { countries: { code_iso2: 'US' } } })
        }))
      }))
    }))
  }
}));

// Mock window.print
window.print = vi.fn();

describe('DocumentPreview', () => {
  const mockQuoteData = {
    reference: 'REF-123',
    account_id: 'Test Client',
    contact_id: 'John Doe',
    origin: 'New York',
    destination: 'London',
    destination_port_id: 'port-123',
    validUntil: '2023-12-31',
    incoterms: 'CIF',
    currency: 'USD',
    currencyId: 'usd',
    total_weight: 1000,
    total_volume: 10,
    commodity: 'Electronics',
    items: [
      { attributes: { hs_code: '8517.12', weight: 100 }, unit_price: 100, quantity: 10 }
    ]
  };

  const mockLegs = [
    {
      id: 'leg-1',
      mode: 'ocean',
      origin: 'New York',
      destination: 'London',
      carrierName: 'Maersk',
      charges: [
        { category: 'Freight', sell: { quantity: 1, rate: 1000 } }
      ]
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (LandedCostService.calculate as any).mockResolvedValue({
      summary: {
        total_duty: 100,
        estimated_mpf: 20,
        estimated_hmf: 10,
        grand_total_estimated_landed_cost: 1130
      }
    });
  });

  it('renders the generate documents button', async () => {
    render(<DocumentPreview quoteData={mockQuoteData} legs={mockLegs} />);
    expect(screen.getByText('Generate Documents')).toBeInTheDocument();
    // Wait for effect to settle to avoid "not wrapped in act" warning
    await waitFor(() => expect(LandedCostService.calculate).toHaveBeenCalled());
  });

  it('opens dialog and shows quotation preview', async () => {
    const user = userEvent.setup();
    render(<DocumentPreview quoteData={mockQuoteData} legs={mockLegs} />);
    
    await user.click(screen.getByText('Generate Documents'));
    
    // Check if dialog title appears
    await screen.findByText('Document Preview');

    // Check if tab content appears (using findByText which waits)
    // We expect the default tab (Quotation) to be active
    await screen.findByTestId('tab-content-quote', {}, { timeout: 5000 });
    
    expect(screen.getByRole('heading', { name: /QUOTATION/i })).toBeInTheDocument();
    expect(screen.getByText(/REF-123/i)).toBeInTheDocument();
  }, 10000);

  it('calculates and displays landed cost', async () => {
    const user = userEvent.setup();
    render(<DocumentPreview quoteData={mockQuoteData} legs={mockLegs} />);
    
    await user.click(screen.getByText('Generate Documents'));
    
    await waitFor(() => {
      expect(LandedCostService.calculate).toHaveBeenCalled();
    });

    await waitFor(() => {
       expect(screen.getByText('Total Estimated Landed Cost')).toBeInTheDocument();
       expect(screen.getByText(/1130/)).toBeInTheDocument();
    });
  });

  it('switches to Bill of Lading tab', async () => {
    const user = userEvent.setup();
    render(<DocumentPreview quoteData={mockQuoteData} legs={mockLegs} />);
    
    await user.click(screen.getByText('Generate Documents'));
    
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Bill of Lading/i })).toBeInTheDocument(); 
    });
    
    const bolTab = screen.getByRole('tab', { name: /Bill of Lading/i });
    await user.click(bolTab);
    
    await waitFor(() => {
        expect(screen.getByText('Forwarding Agent')).toBeInTheDocument();
        expect(screen.getByText('Shipper')).toBeInTheDocument();
    });
  });
});
