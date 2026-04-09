import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AmroPartsInventoryWorkbench } from './AmroPartsInventoryWorkbench';
import { generatePartInventoryRecords } from './mockPartsInventoryData';

describe('AmroPartsInventoryWorkbench', () => {
  const records = generatePartInventoryRecords({ count: 30, seed: 18 });

  it('renders loading state', () => {
    render(
      <AmroPartsInventoryWorkbench
        state="loading"
        records={records}
      />,
    );

    expect(screen.getByText('Loading parts inventory...')).toBeInTheDocument();
  });

  it('renders empty state', () => {
    render(
      <AmroPartsInventoryWorkbench
        state="empty"
        records={[]}
      />,
    );

    expect(screen.getByText('No parts inventory records match the current filters.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset Filters' })).toBeInTheDocument();
  });

  it('renders error state and retries', () => {
    const onRetry = vi.fn();
    render(
      <AmroPartsInventoryWorkbench
        state="error"
        records={records}
        onRetry={onRetry}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders ready state and key controls', () => {
    render(
      <AmroPartsInventoryWorkbench
        state="ready"
        records={records}
      />,
    );

    expect(screen.getByText('Parts Inventory Operations')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Inventory layout mode' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Warehouse Status - Multi-Warehouse' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Automated Low-Stock Alerts' })).toBeInTheDocument();
  });

  it('updates status filter via select control', () => {
    render(
      <AmroPartsInventoryWorkbench
        state="ready"
        records={records}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show Advanced Filters' }));
    fireEvent.click(screen.getByRole('combobox', { name: 'Filter by inventory status' }));
    fireEvent.click(screen.getByRole('option', { name: 'Status: low_stock' }));

    expect(screen.getByText(/Visible:/)).toBeInTheDocument();
  });
});
