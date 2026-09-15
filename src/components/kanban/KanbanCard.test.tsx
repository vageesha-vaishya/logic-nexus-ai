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

  it('wires the drag handle to dnd-kit (useSortable attributes actually spread onto it)', () => {
    render(<KanbanCard item={sampleItem} onView={vi.fn()} onDelete={vi.fn()} />);

    const handle = screen.getByRole('button', { name: /drag .* to another column/i });
    // dnd-kit's useSortable spreads `roleDescription: 'sortable'` (see
    // @dnd-kit/sortable's useSortable default) into useDraggable's
    // `attributes`, which sets these on the activator node. Their presence
    // is the wiring smoke test: {...attributes} is really spread here.
    expect(handle).toHaveAttribute('aria-roledescription', 'sortable');
    // Not wrapped in a DndContext here (matching this file's other tests), so dnd-kit's
    // internal id defaults to '' — presence of the attribute is what proves the spread.
    expect(handle).toHaveAttribute('aria-describedby');
  });
});
