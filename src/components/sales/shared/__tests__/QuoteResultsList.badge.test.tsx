import { render, screen, fireEvent } from '@testing-library/react';
import { QuoteResultsList } from '../QuoteResultsList';
import { describe, it, expect, vi } from 'vitest';
import { RateOption } from '@/types/quote-breakdown';

// Mocks
vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    scopedDb: {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: null }),
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
            order: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    },
    context: { tenantId: 'test-tenant' },
    supabase: {},
  }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user' },
    profile: { role: 'admin' },
  }),
}));

describe('QuoteResultsList Badge Logic', () => {
    const mockManualOption: RateOption = {
        id: 'manual-1',
        carrier: 'Manual Option',
        name: 'Manual Option 1',
        is_manual: true,
        source_attribution: 'Manual Quote',
        price: 1000,
        currency: 'USD',
        transitTime: '10 days',
        tier: 'custom',
        legs: [],
        charges: []
    };

    const mockMarketOption: RateOption = {
        id: 'market-1',
        carrier: 'Maersk',
        name: 'Maersk Spot',
        is_manual: false,
        source_attribution: 'Standard Rate Engine',
        price: 1200,
        currency: 'USD',
        transitTime: '12 days',
        tier: 'standard',
        legs: [],
        charges: []
    };

    it('renders Manual badge for manual options in Card view', () => {
        render(
            <QuoteResultsList 
                results={[mockManualOption]} 
                onSelect={() => {}} 
            />
        );
        const manualBadge = screen.getByText('Manual');
        expect(manualBadge).toBeInTheDocument();
    });

    it('renders Market Rate badge for market options in Card view', () => {
        render(
            <QuoteResultsList 
                results={[mockMarketOption]} 
                onSelect={() => {}} 
            />
        );
        const marketBadge = screen.getByText('Market Rate');
        expect(marketBadge).toBeInTheDocument();
    });

    it('renders Manual badge in List view', () => {
        render(
            <QuoteResultsList 
                results={[mockManualOption]} 
                onSelect={() => {}} 
            />
        );
        // Switch to List view
        const listBtn = screen.getByText('List');
        fireEvent.click(listBtn);
        
        const manualBadge = screen.getByText('Manual');
        expect(manualBadge).toBeInTheDocument();
    });

    it('renders Manual badge in Table view', () => {
        render(
            <QuoteResultsList 
                results={[mockManualOption]} 
                onSelect={() => {}} 
            />
        );
        // Switch to Table view
        const gridBtn = screen.getByText('Grid'); // The button says "Grid" for table view based on code
        fireEvent.click(gridBtn);
        
        const manualBadge = screen.getByText('Manual');
        expect(manualBadge).toBeInTheDocument();
    });
});
