import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { InlineEducation } from './InlineEducation';

describe('InlineEducation', () => {
  it('renders nothing when educationId is null', () => {
    const { container } = render(
      <InlineEducation educationId={null} experienceLevel="beginner" onDismiss={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the title and beginner copy for high_conviction_signal at beginner level', () => {
    render(
      <InlineEducation
        educationId="high_conviction_signal"
        experienceLevel="beginner"
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText('About this signal')).toBeInTheDocument();
    expect(screen.getByText(/right more often than most/i)).toBeInTheDocument();
  });

  it('switches copy at casual level', () => {
    render(
      <InlineEducation
        educationId="high_conviction_signal"
        experienceLevel="casual"
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText(/~68% of the time/)).toBeInTheDocument();
  });

  it('switches copy at self_directed level (mentions sample / CI / accuracy)', () => {
    render(
      <InlineEducation
        educationId="high_conviction_signal"
        experienceLevel="self_directed"
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText(/847 signals/)).toBeInTheDocument();
  });

  it('dismiss button calls onDismiss with the educationId', () => {
    const onDismiss = vi.fn();
    render(
      <InlineEducation
        educationId="high_conviction_signal"
        experienceLevel="beginner"
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledWith('high_conviction_signal');
  });

  it('renders nothing when educationId is unknown (defensive)', () => {
    const { container } = render(
      <InlineEducation
        // @ts-expect-error — deliberately testing an out-of-union value
        educationId="not_a_real_card"
        experienceLevel="beginner"
        onDismiss={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
