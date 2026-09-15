import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { KanbanColumn } from './KanbanColumn';

const sampleColumn = {
  id: 'new',
  title: 'New',
  items: [],
};

describe('KanbanColumn', () => {
  it('names the add and menu buttons and keeps them reachable by keyboard', () => {
    render(<KanbanColumn column={sampleColumn} />);

    expect(screen.getByRole('button', { name: /add card to new/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /column options for new/i })).toBeInTheDocument();
  });

  it('reveals the hover-only buttons when they receive keyboard focus', () => {
    render(<KanbanColumn column={sampleColumn} />);

    const addButton = screen.getByRole('button', { name: /add card to new/i });
    const wrapper = addButton.parentElement;

    expect(wrapper?.className).toContain('focus-within:opacity-100');
  });

  it('names the column drag handle separately from the header', () => {
    render(<KanbanColumn column={sampleColumn} />);

    expect(screen.getByRole('button', { name: /drag new to reorder/i })).toBeInTheDocument();
  });

  it('wires the drag handle to dnd-kit (useSortable attributes actually spread onto it)', () => {
    render(<KanbanColumn column={sampleColumn} />);

    const handle = screen.getByRole('button', { name: /drag new to reorder/i });
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
