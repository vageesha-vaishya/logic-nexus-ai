import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { KanbanCard, KanbanItem } from './KanbanCard';

const sampleItem: KanbanItem = {
  id: 'item-1',
  title: 'Acme Corp',
  status: 'new',
};

describe('KanbanCard', () => {
  it('separates the drag handle from the action buttons', () => {
    render(<KanbanCard item={sampleItem} onView={vi.fn()} onDelete={vi.fn()} />);

    const handle = screen.getByRole('button', { name: /drag .* to another column/i });
    expect(handle.querySelector('button')).toBeNull();
    expect(screen.getByRole('button', { name: /view .*/i })).toBeInTheDocument();
  });

  it('names the view and actions buttons after the card title', () => {
    render(<KanbanCard item={sampleItem} onView={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByRole('button', { name: /view acme corp/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /actions for acme corp/i })).toBeInTheDocument();
  });
});
