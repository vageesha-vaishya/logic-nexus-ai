import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ResultsZone } from '../ResultsZone';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/components/sales/shared/AiMarketAnalysis', () => ({
  AiMarketAnalysis: ({ analysis }: any) => (
    <div data-testid="ai-market-analysis">{analysis || 'No Analysis'}</div>
  ),
}));

vi.mock('@/components/sales/shared/QuoteResultsList', () => ({
  QuoteResultsList: ({ results }: any) => (
    <div data-testid="quote-results-list">
      {results.map((r: any) => (
        <div key={r.id} data-testid={`result-item-${r.id}`}>{r.carrier}</div>
      ))}
    </div>
  ),
}));

describe('ResultsZone', () => {
  const mockResults: any[] = [
    { id: 'rate-1', carrier: 'Maersk', name: 'Standard', price: 1000, currency: 'USD', transitTime: '20 days', tier: 'standard' },
  ];
  const mockAvailable: any[] = [
    { id: 'rate-2', carrier: 'MSC', name: 'Standard', price: 1200, currency: 'USD', transitTime: '18 days', tier: 'standard' },
  ];

  it('Standard Mode: Renders Options and Available Rates', () => {
    render(
      <MemoryRouter>
        <ResultsZone
          results={mockResults}
          availableOptions={mockAvailable}
          smartMode={false}
          marketAnalysis="Analysis"
          onSelect={() => {}}
        />
      </MemoryRouter>
    );

    // AI Analysis
    expect(screen.getByTestId('ai-market-analysis')).toHaveTextContent('Analysis');
    
    // Options Section (Header + List)
    expect(screen.getByText('Rate Options')).toBeInTheDocument();
    expect(screen.getByTestId('quote-results-list')).toBeInTheDocument();
    
    // Available Market Rates Section
    expect(screen.getByText('Available Market Rates')).toBeInTheDocument();
  });

  it('Smart Mode: Renders AI Analysis and Available Rates, but NO Options if results empty', () => {
    // In Smart Mode, results might be empty initially
    render(
      <MemoryRouter>
        <ResultsZone
          results={[]}
          availableOptions={mockAvailable}
          smartMode={true}
          marketAnalysis="Analysis"
          onSelect={() => {}}
        />
      </MemoryRouter>
    );

    // AI Analysis
    expect(screen.getByTestId('ai-market-analysis')).toHaveTextContent('Analysis');
    
    // Options Section should be HIDDEN because results is empty
    expect(screen.queryByText('Rate Options')).not.toBeInTheDocument();
    expect(screen.queryByTestId('quote-results-list')).not.toBeInTheDocument();
    
    // Available Market Rates Section should be VISIBLE
    expect(screen.getByText('Available Market Rates')).toBeInTheDocument();
  });

  it('Smart Mode: Renders Options if results provided (e.g. after adding one)', () => {
    render(
      <MemoryRouter>
        <ResultsZone
          results={mockResults}
          availableOptions={mockAvailable}
          smartMode={true}
          marketAnalysis="Analysis"
          onSelect={() => {}}
        />
      </MemoryRouter>
    );

    // Options Section should be VISIBLE now
    expect(screen.getByText('Rate Options')).toBeInTheDocument();
    expect(screen.getByTestId('quote-results-list')).toBeInTheDocument();
  });
});
