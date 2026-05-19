import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { WhyButton } from './WhyButton';

describe('WhyButton', () => {
  it('renders nothing when given an unknown glossary term', () => {
    const { container } = render(<WhyButton term="not-a-real-term" />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the glossary entry on click when term mode is used', () => {
    render(<WhyButton term="confidence" />);
    fireEvent.click(screen.getByRole('button', { name: /why: signal confidence/i }));
    expect(screen.getByText('Signal Confidence')).toBeInTheDocument();
    expect(screen.getByText(/how many indicators agree/i)).toBeInTheDocument();
  });

  it('renders inline title + children when in custom mode', () => {
    render(
      <WhyButton title="Why this signal?">
        Three indicators agreed on the breakout.
      </WhyButton>,
    );
    fireEvent.click(screen.getByRole('button', { name: /why: why this signal\?/i }));
    expect(screen.getByText('Why this signal?')).toBeInTheDocument();
    expect(
      screen.getByText(/three indicators agreed on the breakout/i),
    ).toBeInTheDocument();
  });

  it('accepts a custom srLabel for the trigger', () => {
    render(
      <WhyButton title="Explain" srLabel="Open explanation">
        Body
      </WhyButton>,
    );
    expect(
      screen.getByRole('button', { name: /open explanation/i }),
    ).toBeInTheDocument();
  });
});
