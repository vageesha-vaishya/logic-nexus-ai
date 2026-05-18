import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockMutate = vi.fn();
vi.mock('./useBehavioralEvents', () => ({
  useLogBehavioralEvent: () => ({ mutate: mockMutate }),
}));

beforeEach(() => vi.clearAllMocks());

describe('InlineEducation', () => {
  it('renders nothing when educationId is null', async () => {
    const { InlineEducation } = await import('./InlineEducation');
    const { container } = render(
      <InlineEducation educationId={null} experienceLevel="beginner" onDismiss={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows beginner content for high_conviction_signal', async () => {
    const { InlineEducation } = await import('./InlineEducation');
    render(
      <InlineEducation
        educationId="high_conviction_signal"
        experienceLevel="beginner"
        onDismiss={vi.fn()}
      />,
    );
    // Beginner content about signal accuracy
    expect(screen.getByText(/signal|accuracy|wrong|guaranteed/i)).toBeInTheDocument();
  });

  it('shows self_directed content (more detailed) when available', async () => {
    const { InlineEducation } = await import('./InlineEducation');
    render(
      <InlineEducation
        educationId="high_conviction_signal"
        experienceLevel="self_directed"
        onDismiss={vi.fn()}
      />,
    );
    // Self-directed content should be more technical/detailed
    expect(screen.getByText(/historical|CI|sample|failure|confidence interval/i)).toBeInTheDocument();
  });

  it('dismiss button calls onDismiss with the educationId', async () => {
    const onDismiss = vi.fn();
    const { InlineEducation } = await import('./InlineEducation');
    render(
      <InlineEducation
        educationId="high_conviction_signal"
        experienceLevel="beginner"
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onDismiss).toHaveBeenCalledWith('high_conviction_signal');
  });
});
