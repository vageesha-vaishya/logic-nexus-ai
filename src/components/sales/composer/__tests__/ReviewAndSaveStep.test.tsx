import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReviewAndSaveStep } from '../ReviewAndSaveStep';
import { useQuoteStore } from '../store/QuoteStore';

// Mock dependencies
vi.mock('../store/QuoteStore');
vi.mock('../DocumentPreview', () => ({
  DocumentPreview: () => <div data-testid="document-preview">Document Preview</div>
}));

// Mock utils
vi.mock('../utils', async () => {
  const actual = await vi.importActual('../utils');
  return {
    ...actual,
    calculateLegChargesTotal: (leg: any, type: 'sell' | 'buy') => {
      if (type === 'sell') return 1000;
      if (type === 'buy') return 800;
      return 0;
    },
    calculateChargesTotal: (charges: any[], type: 'sell' | 'buy') => {
      if (type === 'sell') return 200;
      if (type === 'buy') return 100;
      return 0;
    },
    getSafeName: (item: any, defaultName?: string) => item?.name || defaultName || ''
  };
});

describe('ReviewAndSaveStep', () => {
  const mockState = {
    legs: [
      { id: 'leg1', legType: 'transport', mode: 'ocean', origin: 'Origin', destination: 'Destination', charges: [] },
      { id: 'leg2', legType: 'transport', mode: 'air', origin: 'Origin2', destination: 'Destination2', charges: [] }
    ],
    quoteData: {
      reference: 'REF123',
      accounts: { name: 'Test Customer' },
      contacts: { first_name: 'John', last_name: 'Doe' },
      validUntil: '2023-12-31',
      currencyId: 'curr1',
      incoterms: 'FOB',
      shipping_term_id: 'term1',
      carrier_id: 'carr1',
      service_type_id: 'srv1',
      commodity: 'Electronics',
      total_weight: 1000,
      total_volume: 10,
      notes: 'Test notes'
    },
    charges: [{ id: 'chg1' }], // combined charges
    referenceData: {
      currencies: [{ id: 'curr1', code: 'USD', symbol: '$' }],
      shippingTerms: [{ id: 'term1', name: 'Prepaid' }],
      carriers: [{ id: 'carr1', carrier_name: 'Maersk' }],
      serviceTypes: [{ id: 'srv1', name: 'Door to Door' }]
    }
  };

  beforeEach(() => {
    (useQuoteStore as any).mockReturnValue({
      state: mockState,
      dispatch: vi.fn()
    });
  });

  it('renders correctly', () => {
    render(<ReviewAndSaveStep />);
    expect(screen.getByText('Review Quotation')).toBeInTheDocument();
    expect(screen.getByTestId('document-preview')).toBeInTheDocument();
  });

  it('displays quote details correctly', () => {
    render(<ReviewAndSaveStep />);
    expect(screen.getByText('REF123')).toBeInTheDocument();
    expect(screen.getByText('Test Customer')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Electronics')).toBeInTheDocument();
    expect(screen.getByText('1000 kg / 10 cbm')).toBeInTheDocument();
    expect(screen.getByText('Prepaid')).toBeInTheDocument();
    expect(screen.getByText('Maersk')).toBeInTheDocument();
    expect(screen.getByText('Door to Door')).toBeInTheDocument();
  });

  it('calculates and displays financials correctly', () => {
    // 2 legs * 1000 sell = 2000 leg sell
    // 1 combined charge * 200 sell = 200 combined sell
    // Total Sell = 2200
    
    // 2 legs * 800 buy = 1600 leg buy
    // 1 combined charge * 100 buy = 100 combined buy
    // Total Buy = 1700
    
    // Profit = 2200 - 1700 = 500
    // Margin = (500 / 2200) * 100 = 22.72%

    render(<ReviewAndSaveStep />);
    
    // Total Sell
    expect(screen.getByText('$2200.00')).toBeInTheDocument();
    
    // Total Buy
    expect(screen.getByText('$1700.00')).toBeInTheDocument();
    
    // Profit
    expect(screen.getByText('$500.00')).toBeInTheDocument();
    
    // Margin
    expect(screen.getByText('22.73%')).toBeInTheDocument(); // 22.7272... rounds to 22.73
  });

  it('renders legs list', () => {
    render(<ReviewAndSaveStep />);
    expect(screen.getByText(/Pickup Leg/)).toBeInTheDocument(); // First leg logic in component
    expect(screen.getByText(/Delivery Leg/)).toBeInTheDocument(); // Last leg logic
    expect(screen.getAllByText('$1000.00')).toHaveLength(2); // 2 legs sell price
  });

  it('renders combined charges section', () => {
    render(<ReviewAndSaveStep />);
    expect(screen.getByText('Combined Charges')).toBeInTheDocument();
    // $200.00 appears as Leg Profit (2 legs) and Combined Charges Sell Total (1)
    const amounts = screen.getAllByText('$200.00');
    expect(amounts.length).toBeGreaterThanOrEqual(1);
  });
});
