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
});
