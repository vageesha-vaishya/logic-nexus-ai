import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuoteOptionsOverview } from '../QuoteOptionsOverview';
import { useQuoteStore } from '../store/QuoteStore';
import { useCRM } from '@/hooks/useCRM';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mocks
vi.mock('../store/QuoteStore', () => ({
  useQuoteStore: vi.fn()
}));

vi.mock('@/hooks/useCRM', () => ({
  useCRM: vi.fn()
}));

vi.mock('@/services/pricing.service', () => {
  return {
    PricingService: vi.fn().mockImplementation(() => ({
      calculateFinancials: vi.fn().mockResolvedValue({
        buyPrice: 800,
        marginAmount: 200,
        sellPrice: 1000,
        appliedRules: []
      })
    }))
  };
});

vi.mock('@/lib/quote-mapper', () => ({
  mapOptionToQuote: vi.fn((opt) => ({
    ...opt,
    total_amount: opt.total_amount || 1000,
    currency: opt.currency || 'USD',
    tier: opt.tier || 'standard'
  }))
}));

describe('QuoteOptionsOverview', () => {
  const mockDispatch = vi.fn();
  const mockOptions = [
    {
      id: 'opt-1',
      carrier_name: 'Ocean Line',
      option_name: 'Standard Service',
      total_amount: 1000,
      currency: 'USD',
      service_type: 'Sea Freight',
      mode: 'sea',
      tier: 'standard'
    },
    {
      id: 'opt-2',
      carrier_name: 'Air Express',
      option_name: 'Express Service',
      total_amount: 2000,
      currency: 'USD',
      service_type: 'Air Freight',
      mode: 'air',
      tier: 'premium'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (useQuoteStore as any).mockReturnValue({
      state: {
        options: mockOptions,
        optionId: 'opt-1',
        marketAnalysis: 'Market is stable',
        confidenceScore: 85,
        anomalies: [],
        referenceData: {}
      },
      dispatch: mockDispatch
    });
    (useCRM as any).mockReturnValue({
      scopedDb: { client: {} }
    });
  });

  it('renders options list', async () => {
    render(<QuoteOptionsOverview />);
    
    await waitFor(() => {
      expect(screen.getByText('Ocean Line')).toBeInTheDocument();
      expect(screen.getByText('Air Express')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Standard Service')).toBeInTheDocument();
    expect(screen.getByText('Express Service')).toBeInTheDocument();
  });

  it('renders market analysis when available', async () => {
    render(<QuoteOptionsOverview />);
    
    await waitFor(() => {
      expect(screen.getByText('AI Market Analysis')).toBeInTheDocument();
      expect(screen.getByText('Market is stable')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
    });
  });

  it('handles option selection', async () => {
    render(<QuoteOptionsOverview />);
    
    await waitFor(() => {
      expect(screen.getByText('Air Express')).toBeInTheDocument();
    });

    const card = screen.getByText('Air Express').closest('div[class*="cursor-pointer"]');
    if (card) {
      fireEvent.click(card);
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'INITIALIZE',
        payload: { optionId: 'opt-2' }
      });
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_VIEW_MODE',
        payload: 'composer'
      });
    } else {
      throw new Error('Card not found');
    }
  });

  it('toggles view modes', async () => {
    render(<QuoteOptionsOverview />);
    
    const listBtn = screen.getByText('List');
    fireEvent.click(listBtn);
    
    // In list mode, layout might change, but content should still be there
    await waitFor(() => {
      expect(screen.getByText('Ocean Line')).toBeInTheDocument();
    });
  });

  it('renders smart options button when callback provided', async () => {
    const onGenerate = vi.fn();
    render(<QuoteOptionsOverview onGenerateSmartOptions={onGenerate} />);
    
    const btn = screen.getByText('Generate Smart Options');
    expect(btn).toBeInTheDocument();
    
    fireEvent.click(btn);
    expect(onGenerate).toHaveBeenCalled();
  });
});
