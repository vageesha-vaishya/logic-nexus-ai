
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResultsZone } from '../ResultsZone';
import { RateOption } from '@/types/quote-breakdown';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/components/sales/shared/AiMarketAnalysis', () => ({
  AiMarketAnalysis: () => <div data-testid="ai-analysis">AI Analysis</div>
}));

// Mock useCRM
vi.mock('@/hooks/useCRM', () => {
  const client = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ data: [], error: null })),
        order: vi.fn(() => ({ data: [], error: null })),
        single: vi.fn(() => ({ data: null, error: null }))
      }))
    })),
    rpc: vi.fn()
  };
  
  return {
    useCRM: () => ({
      scopedDb: client,
      supabase: client
    })
  };
});

// Mock PricingService
vi.mock('@/services/pricing.service', () => {
  const PricingService = vi.fn();
  PricingService.prototype.calculateFinancials = vi.fn().mockResolvedValue({
    buyPrice: 800,
    marginAmount: 200,
    marginPercent: 20,
    markupPercent: 25
  });
  return { PricingService };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          data: [],
          error: null
        }))
      }))
    }))
  }
}));

const mockOptions: RateOption[] = [
  {
    id: 'opt1',
    carrier: 'Carrier A',
    name: 'Carrier A Option',
    price: 1000,
    tier: 'standard',
    total_amount: 1000,
    currency: 'USD',
    transitTime: '15 days',
    legs: [
        { id: 'l1', mode: 'road', leg_type: 'pickup', sequence: 0, origin: 'A', destination: 'B' },
        { id: 'l2', mode: 'ocean', leg_type: 'main', sequence: 1, origin: 'B', destination: 'C' },
        { id: 'l3', mode: 'road', leg_type: 'delivery', sequence: 2, origin: 'C', destination: 'D' }
    ],
    charges: [
        { id: 'c1', name: 'Pickup', amount: 100, currency: 'USD', leg_id: 'l1', category: 'Pickup' },
        { id: 'c2', name: 'Freight', amount: 800, currency: 'USD', leg_id: 'l2', category: 'Freight' },
        { id: 'c3', name: 'Delivery', amount: 100, currency: 'USD', leg_id: 'l3', category: 'Delivery' }
    ]
  },
  {
    id: 'opt2',
    carrier: 'Carrier B',
    name: 'Carrier B Option',
    price: 1200,
    tier: 'standard',
    total_amount: 1200,
    currency: 'USD',
    transitTime: '12 days',
    legs: [
        { id: 'l4', mode: 'road', leg_type: 'pickup', sequence: 0, origin: 'A', destination: 'B' },
        { id: 'l5', mode: 'air', leg_type: 'main', sequence: 1, origin: 'B', destination: 'C' },
        { id: 'l6', mode: 'road', leg_type: 'delivery', sequence: 2, origin: 'C', destination: 'D' }
    ],
    charges: [
        { id: 'c4', name: 'Pickup', amount: 150, currency: 'USD', leg_id: 'l4', category: 'Pickup' },
        { id: 'c5', name: 'Freight', amount: 900, currency: 'USD', leg_id: 'l5', category: 'Freight' },
        { id: 'c6', name: 'Delivery', amount: 150, currency: 'USD', leg_id: 'l6', category: 'Delivery' }
    ]
  }
];

describe('ResultsZone Integration', () => {
  it('renders list view by default', () => {
    render(
      <ResultsZone
        results={mockOptions}
        onSelect={vi.fn()}
        onAddManualOption={vi.fn()}
      />
    );
    
    expect(screen.getByText('Carrier A')).toBeInTheDocument();
    expect(screen.getByText('Carrier B')).toBeInTheDocument();
  });

  it('switches to compare view and displays options', async () => {
    const user = userEvent.setup();
    render(
      <ResultsZone
        results={mockOptions}
        onSelect={vi.fn()}
        onAddManualOption={vi.fn()}
      />
    );

    // Click Compare tab
    const compareTab = screen.getByRole('tab', { name: /compare/i });
    await user.click(compareTab);

    // Verify tab switch
    await waitFor(() => {
        expect(compareTab).toHaveAttribute('data-state', 'active');
    });

    // In Compare view, QuoteComparisonView should be rendered.
    // We expect to see carrier names and maybe totals.
    // QuoteComparisonView usually renders a table or grid.
    
    // Wait for the comparison view to appear (it might show "No options" briefly)
    await waitFor(() => {
        expect(screen.getByTestId('quote-comparison-view')).toBeInTheDocument();
    });

    // Wait for the data to be populated (async enrichment)
    await waitFor(() => {
        expect(screen.getByText('Carrier A')).toBeInTheDocument();
        expect(screen.getByText('Carrier B')).toBeInTheDocument();
        // Check for totals if possible
        expect(screen.getByText(/1,000/)).toBeInTheDocument();
        expect(screen.getByText(/1,200/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
