import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuoteDetailsStep } from '../QuoteDetailsStep';
import { LegsConfigurationStep } from '../LegsConfigurationStep';

// Mock dependencies
vi.mock('@/hooks/useAiAdvisor', () => ({
  useAiAdvisor: () => ({
    invokeAiAdvisor: vi.fn().mockResolvedValue({ 
      data: { 
        suggestions: [{ label: 'Shanghai', details: 'China' }],
        hts: '1234.56',
        type: 'Test Commodity',
        compliant: true
      }, 
      error: null 
    })
  })
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() })
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: [], isLoading: false })
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [] })
        })
      })
    })
  }
}));

describe('Quote Synchronization Tests', () => {
  
  describe('QuoteDetailsStep', () => {
    it('renders AI analysis button and new fields when populated', () => {
      const mockOnChange = vi.fn();
      const mockProps = {
        quoteData: {
          commodity: 'Electronics',
          total_weight: '100',
          total_volume: '1',
          hts_code: '8517.12',
          schedule_b: '8517.12.0000'
        },
        currencies: [],
        onChange: mockOnChange
      };

      render(<QuoteDetailsStep {...mockProps} />);

      // Check for AI Button
      expect(screen.getByTitle('Analyze with AI')).toBeDefined();

      // Check for populated HTS fields
      expect(screen.getByDisplayValue('8517.12')).toBeDefined();
      expect(screen.getByDisplayValue('8517.12.0000')).toBeDefined();
    });
  });

  describe('LegsConfigurationStep', () => {
    it('renders LocationAutocomplete for Origin/Destination', () => {
      const mockOnUpdate = vi.fn();
      const mockProps = {
        legs: [{
          id: '1',
          mode: 'ocean',
          origin: '',
          destination: '',
          serviceTypeId: '1',
          charges: []
        }],
        serviceTypes: [],
        onAddLeg: vi.fn(),
        onUpdateLeg: mockOnUpdate,
        onRemoveLeg: vi.fn()
      };

      render(<LegsConfigurationStep {...mockProps} />);

      // Check inputs are present (LocationAutocomplete uses Input internally)
      const inputs = screen.getAllByPlaceholderText(/e.g.,/);
      expect(inputs.length).toBeGreaterThanOrEqual(2);
    });
  });

});
