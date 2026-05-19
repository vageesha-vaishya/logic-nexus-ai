import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { Term } from './Term';

describe('Term', () => {
  it('renders children with a popover trigger when the term is in the glossary', () => {
    render(<Term word="rebalancing">Rebalance</Term>);
    const trigger = screen.getByRole('button', { name: /define: rebalancing/i });
    expect(trigger).toHaveTextContent('Rebalance');
  });

  it('falls back to plain text (no button) when the term is unknown', () => {
    render(<Term word="not-a-real-term">Mystery</Term>);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Mystery')).toBeInTheDocument();
  });

  it('opens the popover and renders title + body on click', () => {
    render(<Term word="stop-loss">SL</Term>);
    // Trigger says "SL"; popover says "Stop-Loss".
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Stop-Loss')).toBeInTheDocument();
    expect(
      screen.getByText(/pre-set price that triggers an auto-sell/i),
    ).toBeInTheDocument();
  });

  it('is case-insensitive on the lookup', () => {
    render(<Term word="SIP">sip</Term>);
    expect(screen.getByRole('button', { name: /define: sip/i })).toBeInTheDocument();
  });

  it('falls back to the children string when no word prop is passed', () => {
    render(<Term>P/E ratio</Term>);
    expect(
      screen.getByRole('button', { name: /define: p\/e ratio/i }),
    ).toBeInTheDocument();
  });
});
