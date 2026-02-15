import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { QuotesList } from '../QuotesList';
import { MemoryRouter } from 'react-router-dom';

const baseQuote = {
  id: 'q-1',
  quote_number: 'Q-1001',
  title: 'Test Quote',
  status: 'draft',
  created_at: new Date().toISOString(),
  sell_price: 1000,
  accounts: { name: 'Acme Corp' },
};

describe('QuotesList margin display', () => {
  it('shows 0% when margin_percentage is 0', () => {
    render(
      <MemoryRouter>
        <QuotesList
          quotes={[{ ...baseQuote, margin_percentage: 0 } as any]}
          selectedQuotes={new Set()}
          onToggleSelection={() => {}}
          onSelectAll={() => {}}
          bulkMode={false}
        />
      </MemoryRouter>
    );
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('shows dash when margin_percentage is undefined', () => {
    render(
      <MemoryRouter>
        <QuotesList
          quotes={[{ ...baseQuote, margin_percentage: undefined } as any]}
          selectedQuotes={new Set()}
          onToggleSelection={() => {}}
          onSelectAll={() => {}}
          bulkMode={false}
        />
      </MemoryRouter>
    );
    expect(screen.getByText('-')).toBeInTheDocument();
  });
});
