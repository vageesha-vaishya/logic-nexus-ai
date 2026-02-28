import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuoteResultsList } from '../QuoteResultsList';

describe('QuoteResultsList', () => {
  it('calls onRemoveOption after confirmation', async () => {
    const onRemoveOption = vi.fn();
    render(
      <QuoteResultsList
        results={[
          {
            id: 'opt-1',
            carrier: 'Carrier A',
            name: 'Option A',
            price: 100,
            currency: 'USD',
            transitTime: '10 days',
            tier: 'custom',
          },
        ]}
        onSelect={vi.fn()}
        selectedIds={[]}
        onRemoveOption={onRemoveOption}
      />
    );

    fireEvent.click(screen.getByLabelText('Delete option'));

    expect(await screen.findByText('Delete this option?')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Delete'));
    expect(onRemoveOption).toHaveBeenCalledWith('opt-1');
  });

  it('calls onRemoveOption in List View', async () => {
    const onRemoveOption = vi.fn();
    render(
      <QuoteResultsList
        results={[
          {
            id: 'opt-1',
            carrier: 'Carrier A',
            name: 'Option A',
            price: 100,
            currency: 'USD',
            transitTime: '10 days',
            tier: 'custom',
          },
        ]}
        onSelect={vi.fn()}
        selectedIds={[]}
        onRemoveOption={onRemoveOption}
      />
    );

    // Switch to List View
    fireEvent.click(screen.getByText('List'));

    // Find and click delete button
    fireEvent.click(screen.getByLabelText('Delete option'));

    expect(await screen.findByText('Delete this option?')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Delete'));
    expect(onRemoveOption).toHaveBeenCalledWith('opt-1');
  });

  it('calls onRemoveOption in Table View', async () => {
    const onRemoveOption = vi.fn();
    render(
      <QuoteResultsList
        results={[
          {
            id: 'opt-1',
            carrier: 'Carrier A',
            name: 'Option A',
            price: 100,
            currency: 'USD',
            transitTime: '10 days',
            tier: 'custom',
          },
        ]}
        onSelect={vi.fn()}
        selectedIds={[]}
        onRemoveOption={onRemoveOption}
      />
    );

    // Switch to Table View (labeled as "Grid")
    fireEvent.click(screen.getByText('Grid'));

    // Find and click delete button
    fireEvent.click(screen.getByLabelText('Delete option'));

    expect(await screen.findByText('Delete this option?')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Delete'));
    expect(onRemoveOption).toHaveBeenCalledWith('opt-1');
  });
});
