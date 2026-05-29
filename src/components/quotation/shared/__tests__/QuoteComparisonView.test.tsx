import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { QuoteComparisonView } from '../QuoteComparisonView';
import { RateOption } from '@/types/quote-breakdown';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => options?.defaultValue || key,
  }),
}));

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () =>
    ({
      user: { id: 'test-user' },
      context: {
        isPlatformAdmin: false,
        isTenantAdmin: true,
        isFranchiseAdmin: false,
        isUser: true,
        tenantId: 'test-tenant',
        franchiseId: null,
        adminOverrideEnabled: false,
        userId: 'test-user',
        _version: 1,
      },
      supabase: {},
      scopedDb: {},
      preferences: null,
      loadingPreferences: false,
      setScopePreference: vi.fn(),
      setAdminOverride: vi.fn(),
      setFranchisePreference: vi.fn(),
    }) as any,
}));

vi.mock('@/components/ui/table', () => ({
  Table: ({ children }: any) => <table>{children}</table>,
  TableBody: ({ children }: any) => <tbody>{children}</tbody>,
  TableCell: ({ children }: any) => <td>{children}</td>,
  TableHead: ({ children }: any) => <th>{children}</th>,
  TableHeader: ({ children }: any) => <thead>{children}</thead>,
  TableRow: ({ children }: any) => <tr>{children}</tr>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.join(' '),
  formatCurrency: (amount: number, currency: string) => `${currency} ${amount}`,
}));

vi.mock('@/services/pricing.service', () => {
  return {
    PricingService: class {
      constructor(_db: any) {}
      async calculateFinancials(total: number) {
        return {
          buyPrice: total * 0.8,
          marginAmount: total * 0.2,
          markupPercent: 25,
          marginPercent: 20,
        };
      }
    },
  };
});

describe('QuoteComparisonView', () => {
  const mockRateOption: RateOption = {
    id: 'opt-1',
    carrier: 'Test Carrier',
    name: 'Test Option',
    price: 1000,
    currency: 'USD',
    transitTime: '20 days',
    tier: 'standard',
    legs: [
      {
        id: 'leg-1',
        mode: 'ocean',
        leg_type: 'transport',
        origin: 'Shanghai',
        destination: 'Los Angeles',
        charges: [{ category: 'Freight', amount: 800, currency: 'USD', name: 'Ocean Freight' }],
      },
    ],
    charges: [{ category: 'Fee', amount: 200, currency: 'USD', name: 'Doc Fee' }],
  };

  it('renders options correctly', async () => {
    const { getByText } = render(<QuoteComparisonView options={[mockRateOption]} onSelect={vi.fn()} />);

    await waitFor(() => {
      expect(getByText('USD 1000')).toBeDefined();
    });
  });

  it('bifurcates charges correctly', async () => {
    const { getByText } = render(<QuoteComparisonView options={[mockRateOption]} onSelect={vi.fn()} />);

    await waitFor(() => {
      expect(getByText('$1,000.00')).toBeDefined();
    });
  });

  it('handles missing direct totals and still renders comparison deltas safely', async () => {
    const optionWithoutPrice: RateOption = {
      ...mockRateOption,
      id: 'opt-2',
      price: 0,
      total_amount: 0 as any,
      transitTime: '',
      legs: [
        {
          id: 'leg-x',
          mode: 'road',
          leg_type: 'pickup',
          origin: 'A',
          destination: 'B',
          charges: [{ category: 'Freight', amount: 300, currency: 'USD', name: 'Road Freight' }],
        },
      ],
      charges: [{ category: 'Fee', amount: 50, currency: 'USD', name: 'Doc Fee' }],
    };

    const { getByText } = render(<QuoteComparisonView options={[mockRateOption, optionWithoutPrice]} onSelect={vi.fn()} />);

    await waitFor(() => {
      expect(getByText('Cost Delta vs Cheapest')).toBeDefined();
      expect(getByText('Transit Delta vs Fastest')).toBeDefined();
      expect(getByText('Mode Coverage')).toBeDefined();
      expect(getByText('USD 350')).toBeDefined();
    });
  });

  it('uses composer charges instead of direct total when both are present', async () => {
    const mismatchedOption: RateOption = {
      ...mockRateOption,
      id: 'opt-mismatch',
      price: 6646.3,
      total_amount: 6646.3,
      legs: [
        {
          id: 'leg-1',
          mode: 'ocean',
          leg_type: 'transport',
          origin: 'Shanghai',
          destination: 'Los Angeles',
          charges: [{ category: 'Freight', amount: 2000, currency: 'USD', name: 'Ocean Freight' }],
        },
      ],
      charges: [
        { category: 'Fee', amount: 1555, currency: 'USD', name: 'Doc Fee' },
        { category: 'Adjustment', amount: 3091.3, currency: 'USD', name: 'Ancillary Fees', note: 'Unitemized surcharges' },
      ],
    };

    const { getByText } = render(<QuoteComparisonView options={[mismatchedOption]} onSelect={vi.fn()} />);

    await waitFor(() => {
      expect(getByText('USD 3555')).toBeDefined();
    });
  });

  it('falls back to option name when carrier is empty', async () => {
    const optionWithoutCarrier: RateOption = {
      ...mockRateOption,
      id: 'opt-3',
      carrier: '',
      name: 'Fallback Carrier Name',
    };

    const { getAllByText } = render(<QuoteComparisonView options={[optionWithoutCarrier]} onSelect={vi.fn()} />);

    await waitFor(() => {
      expect(getAllByText('Fallback Carrier Name').length).toBeGreaterThan(0);
    });
  });
});
