import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DataTable, ColumnDef } from '../DataTable';

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

type Row = {
  id: string;
  quote_number: string;
  account: string;
};

const columns: ColumnDef<Row>[] = [
  { key: 'quote_number', header: 'Quote #' },
  { key: 'account', header: 'Account' },
];

describe('DataTable search navigation', () => {
  const scrollIntoViewMock = vi.fn();

  beforeEach(() => {
    scrollIntoViewMock.mockReset();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoViewMock,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('focuses first match and navigates with arrow keys', async () => {
    const rows: Row[] = [
      { id: 'q-1', quote_number: 'QUO-0001', account: 'Globex' },
      { id: 'q-2', quote_number: 'QUO-0002', account: 'Acme Alpha' },
      { id: 'q-3', quote_number: 'QUO-0003', account: 'Acme Beta' },
    ];

    render(
      <DataTable<Row>
        data={rows}
        columns={columns}
        viewMode="table"
        search={{
          query: 'acme',
          onQueryChange: vi.fn(),
          placeholder: 'Search quotes...',
        }}
        searchNavigation={{
          enabled: true,
          getRowId: (row) => row.id,
          getRowSearchText: (row) => `${row.quote_number} ${row.account}`,
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('1 / 2 matches')).toBeInTheDocument();
    });

    await waitFor(() => {
      const activeRow = document.querySelector('[data-row-id="q-2"]');
      expect(activeRow?.className).toContain('ring-amber-500/80');
    });

    const searchInput = screen.getByPlaceholderText('Search quotes...');
    fireEvent.keyDown(searchInput, { key: 'ArrowDown' });

    await waitFor(() => {
      const activeRow = document.querySelector('[data-row-id="q-3"]');
      expect(activeRow?.className).toContain('ring-amber-500/80');
    });

    expect(scrollIntoViewMock).toHaveBeenCalled();
  });
});
