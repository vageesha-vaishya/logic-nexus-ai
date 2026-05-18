import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { GoalProgressAnchor } from './GoalProgressAnchor';

describe('GoalProgressAnchor', () => {
  it('shows progress percentage and goal label', () => {
    render(
      <GoalProgressAnchor
        currentValue={482300}
        targetValue={800000}
        goalLabel="Retirement"
        targetYear={2038}
      />,
    );
    // 482300 / 800000 = 60.2875 → rounds to 60%
    expect(screen.getByText(/60%/)).toBeInTheDocument();
    expect(screen.getByText(/Retirement/)).toBeInTheDocument();
    expect(screen.getByText(/2038/)).toBeInTheDocument();
  });

  it('caps progress at 100% when currentValue exceeds target', () => {
    render(
      <GoalProgressAnchor
        currentValue={1000000}
        targetValue={800000}
        goalLabel="Home"
        targetYear={2030}
      />,
    );
    expect(screen.getByText(/100%/)).toBeInTheDocument();
  });
});
