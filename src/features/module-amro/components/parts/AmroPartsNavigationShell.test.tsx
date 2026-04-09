import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AmroPartsNavigationShell } from './AmroPartsNavigationShell';

describe('AmroPartsNavigationShell', () => {
  it('renders role-filtered modules for technician', () => {
    render(
      <AmroPartsNavigationShell
        activeRole="technician"
        renderModule={(moduleId) => <div data-testid="module-surface">{moduleId}</div>}
      />,
    );
    expect(screen.getAllByText('Overview').length).toBeGreaterThan(0);
    expect(screen.queryByText('Item Master')).not.toBeInTheDocument();
    expect(screen.queryByText('Analytics')).not.toBeInTheDocument();
  });

  it('switches active module surface', () => {
    render(
      <AmroPartsNavigationShell
        activeRole="management"
        renderModule={(moduleId) => <div data-testid="module-surface">{moduleId}</div>}
      />,
    );
    expect(screen.getByTestId('module-surface').textContent).toBe('overview');
    fireEvent.click(screen.getAllByRole('button', { name: /stock ledger/i })[0]!);
    expect(screen.getByTestId('module-surface').textContent).toBe('stock-ledger');
    expect(screen.getByText(/Nav Response/i)).toBeInTheDocument();
  });
});
