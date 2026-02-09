import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ReviewAndSaveStep } from '../ReviewAndSaveStep';
import { useQuoteStore } from '../store/QuoteStore';

// Mock DocumentPreview since we test it separately
vi.mock('../DocumentPreview', () => ({
  DocumentPreview: () => <div data-testid="document-preview">Document Preview Component</div>
}));

vi.mock('../store/QuoteStore', () => ({
  useQuoteStore: vi.fn(),
  QuoteStoreProvider: ({ children }: any) => <div>{children}</div>
}));

describe('ReviewAndSaveStep', () => {
  const mockState = {
    quoteData: {
      reference: 'REF-123',
      validUntil: '2023-12-31',
      currencyId: 'USD',
      incoterms: 'FOB',
      commodity: 'Electronics',
      total_weight: 1000,
      total_volume: 10,
      notes: 'Test notes'
    },
    legs: [
      {
        id: 'leg-1',
        legType: 'main',
        mode: 'ocean',
        origin: 'Shanghai',
        destination: 'Los Angeles',
        carrierName: 'Cosco',
        charges: [
          {
            id: 'charge-1',
            category: 'Freight',
            sell: { quantity: 1, rate: 1000 },
            buy: { quantity: 1, rate: 800 }
          }
        ]
      }
    ],
    charges: [ // Combined charges
      {
        id: 'combined-1',
        description: 'Insurance',
        category: 'Insurance',
        sell: { quantity: 1, rate: 100 },
        buy: { quantity: 1, rate: 50 }
      }
    ],
    referenceData: {
      currencies: [{ id: 'USD', code: 'USD', symbol: '$' }]
    }
  };

  beforeEach(() => {
    (useQuoteStore as any).mockReturnValue({
      state: mockState,
      dispatch: vi.fn()
    });
  });

  it('renders quote details correctly', () => {
    render(<ReviewAndSaveStep />);
    
    expect(screen.getByText('REF-123')).toBeInTheDocument();
    expect(screen.getByText('Electronics')).toBeInTheDocument();
    expect(screen.getByText('1000 kg / 10 cbm')).toBeInTheDocument();
  });

  it('calculates and displays totals correctly', () => {
    render(<ReviewAndSaveStep />);
    
    // Leg sell: 1 * 1000 = 1000
    // Combined sell: 1 * 100 = 100
    // Total Sell: 1100
    expect(screen.getByText('$1100.00')).toBeInTheDocument();

    // Leg buy: 1 * 800 = 800
    // Combined buy: 1 * 50 = 50
    // Total Buy: 850
    expect(screen.getByText('$850.00')).toBeInTheDocument();

    // Profit: 1100 - 850 = 250
    expect(screen.getByText('$250.00')).toBeInTheDocument();

    // Margin: (250 / 1100) * 100 = 22.73%
    expect(screen.getByText('22.73%')).toBeInTheDocument();
  });

  it('renders legs summary', () => {
    render(<ReviewAndSaveStep />);
    expect(screen.getByText(/Main Leg 1 - OCEAN/i)).toBeInTheDocument();
    expect(screen.getByText(/Shanghai → Los Angeles/i)).toBeInTheDocument();
  });

  it('renders notes if present', () => {
    render(<ReviewAndSaveStep />);
    expect(screen.getByText('Test notes')).toBeInTheDocument();
  });

  it('renders document preview component', () => {
    render(<ReviewAndSaveStep />);
    expect(screen.getByTestId('document-preview')).toBeInTheDocument();
  });
});
