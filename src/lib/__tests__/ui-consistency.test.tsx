
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QuoteResultsList } from '@/components/sales/shared/QuoteResultsList';
import { QuoteOptionsOverview } from '@/components/sales/composer/QuoteOptionsOverview';
import { mapOptionToQuote } from '@/lib/quote-mapper';

// Mock UI components that might cause issues in testing environment
vi.mock('@/components/sales/shared/QuoteMapVisualizer', () => ({
  QuoteMapVisualizer: () => <div data-testid="map-visualizer">Map Visualizer</div>
}));

vi.mock('@/components/sales/shared/QuoteLegsVisualizer', () => ({
  QuoteLegsVisualizer: () => <div data-testid="legs-visualizer">Legs Visualizer</div>
}));

// Mock Data
const mockSmartQuote = {
  id: 'sq-1',
  carrier: 'AI Carrier',
  name: 'Smart Option',
  price: 5000,
  currency: 'USD',
  transitTime: '25 days',
  tier: 'best_value',
  ai_explanation: 'Optimal route',
  reliability: { score: 9, on_time_performance: '95%' },
  source_attribution: 'AI Generated'
};

const mockStandardQuote = {
  id: 'std-1',
  carrier: 'Standard Line',
  option_name: 'Standard Service',
  total_amount: 4500,
  currency: 'USD',
  transit_time: { details: '30 days' },
  tier: 'standard',
  legs: [
    {
      id: 'leg-1',
      mode: 'Ocean',
      charges: [
        { name: 'Ocean Freight', amount: 4000, currency: 'USD' },
        { name: 'Bunker Surcharge', amount: 500, currency: 'USD' }
      ]
    }
  ]
};

describe('UI Consistency Checks', () => {
  
  describe('QuoteResultsList (Quick Quote Module)', () => {
    it('renders AI Smart Quote with correct badges and details', () => {
      // The component expects raw options, it maps them internally if needed or displays as is
      // QuoteResultsList actually displays raw properties, but uses mapOptionToQuote for details view
      render(
        <QuoteResultsList 
          results={[mockSmartQuote]} 
          onSelect={() => {}} 
        />
      );

      expect(screen.getByText('AI Carrier')).toBeInTheDocument();
      expect(screen.getByText('Smart Option')).toBeInTheDocument();
      expect(screen.getByText('AI Generated')).toBeInTheDocument(); // Badge
      expect(screen.getByText('Optimal route')).toBeInTheDocument(); // Explanation
    });
  });

  describe('QuoteOptionsOverview (Smart Quote Module)', () => {
    it('renders Standard Quote using centralized mapper', () => {
      // This component uses mapOptionToQuote internally
      render(
        <QuoteOptionsOverview 
          options={[mockStandardQuote]} 
          onSelect={() => {}} 
        />
      );

      expect(screen.getByText('Standard Line')).toBeInTheDocument();
      expect(screen.getByText('Standard Service')).toBeInTheDocument();
      expect(screen.getByText('$4,500.00')).toBeInTheDocument();
    });

    it('renders AI Smart Quote consistent with Quick Quote', () => {
      render(
        <QuoteOptionsOverview 
          options={[mockSmartQuote]} 
          onSelect={() => {}} 
        />
      );

      expect(screen.getByText('AI Carrier')).toBeInTheDocument();
      // Note: mapOptionToQuote normalizes 'name' to 'option_name'
      expect(screen.getByText('Smart Option')).toBeInTheDocument(); 
      expect(screen.getByText('AI Generated')).toBeInTheDocument();
    });
  });

  describe('Data Mapping Consistency', () => {
    it('produces identical charge structure for ChargeBreakdown', () => {
      const mappedSmart = mapOptionToQuote(mockSmartQuote);
      const mappedStandard = mapOptionToQuote(mockStandardQuote);

      // Smart quote should have synthesized charges
      expect(mappedSmart.charges).toBeDefined();
      expect(mappedSmart.charges.length).toBeGreaterThan(0);
      expect(mappedSmart.charges[0]).toHaveProperty('unit');
      expect(mappedSmart.charges[0]).toHaveProperty('note');

      // Standard quote should PRESERVE leg structure if charges are present there
      // (Our mapper logic avoids synthesizing top-level charges if leg charges exist)
      expect(mappedStandard.legs).toBeDefined();
      expect(mappedStandard.legs.length).toBeGreaterThan(0);
      expect(mappedStandard.legs[0].charges).toBeDefined();
      expect(mappedStandard.legs[0].charges.length).toBeGreaterThan(0);
    });
  });
});
