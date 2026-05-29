import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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
    expect(screen.getAllByText('0%').length).toBeGreaterThan(0);
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
    expect(screen.getAllByText('-').length).toBeGreaterThan(0);
  });

  it('triggers delete callback from row actions', () => {
    const onDeleteQuote = vi.fn();
    render(
      <MemoryRouter>
        <QuotesList
          quotes={[{ ...baseQuote, margin_percentage: 20 } as any]}
          selectedQuotes={new Set()}
          onToggleSelection={() => {}}
          onSelectAll={() => {}}
          bulkMode={false}
          onDeleteQuote={onDeleteQuote}
          canDelete
          deleteInProgress={false}
        />
      </MemoryRouter>
    );

    const menuButton = screen.getByRole('button', { name: /open menu/i });
    fireEvent.pointerDown(menuButton);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete Quote' }));
    expect(onDeleteQuote).toHaveBeenCalledWith('q-1');
  });
});
