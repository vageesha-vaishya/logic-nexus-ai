import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { GoalProgressAnchor } from './GoalProgressAnchor';

describe('GoalProgressAnchor', () => {
  it('shows percentage, label, and target year', () => {
    render(
      <GoalProgressAnchor
        currentValue={482300}
        targetValue={800000}
        goalLabel="Retirement"
        targetYear={2038}
      />,
    );
    expect(screen.getByText(/60%/)).toBeInTheDocument();
    expect(screen.getByText(/Retirement/)).toBeInTheDocument();
    expect(screen.getByText(/2038/)).toBeInTheDocument();
  });

  it('caps progress at 100% when current exceeds target', () => {
    render(
      <GoalProgressAnchor
        currentValue={1_500_000}
        targetValue={1_000_000}
        goalLabel="Emergency Fund"
        targetYear={2027}
      />,
    );
    expect(screen.getByText(/100%/)).toBeInTheDocument();
  });

  it('handles zero target without dividing by zero', () => {
    render(
      <GoalProgressAnchor
        currentValue={10_000}
        targetValue={0}
        goalLabel="Wealth Growth"
        targetYear={2040}
      />,
    );
    // Should render *some* progress label without throwing or NaN.
    expect(screen.getByText(/Wealth Growth/)).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });
});
