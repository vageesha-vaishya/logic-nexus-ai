import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { LeadsViewStateProvider, useLeadsViewState } from './useLeadsViewState';

function StateProbe() {
  const { state, setWorkspace } = useLeadsViewState();
  const statuses = ['all', 'new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'] as const;
  return (
    <div>
      <span data-testid="group-by">{state.workspace.groupBy}</span>
      <span data-testid="status-filter">{state.workspace.statusFilter}</span>
      <button type="button" onClick={() => setWorkspace({ groupBy: 'industry' })}>
        set-group
      </button>
      {statuses.map((status) => (
        <button key={status} type="button" onClick={() => setWorkspace({ statusFilter: status, page: 1 })}>
          {`set-status-${status}`}
        </button>
      ))}
    </div>
  );
}

describe('useLeadsViewState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults workspace grouping to none', async () => {
    render(
      <LeadsViewStateProvider>
        <StateProbe />
      </LeadsViewStateProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('group-by')).toHaveTextContent('none');
      expect(screen.getByTestId('status-filter')).toHaveTextContent('all');
    });
  });

  it('persists workspace grouping changes', async () => {
    render(
      <LeadsViewStateProvider>
        <StateProbe />
      </LeadsViewStateProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'set-group' }));

    await waitFor(() => {
      expect(screen.getByTestId('group-by')).toHaveTextContent('industry');
    });

    const raw = localStorage.getItem('leads.viewState.v1');
    expect(raw).toContain('"groupBy":"industry"');
  });

  it('updates status filter for every supported option', async () => {
    render(
      <LeadsViewStateProvider>
        <StateProbe />
      </LeadsViewStateProvider>,
    );

    const statuses = ['all', 'new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
    for (const status of statuses) {
      fireEvent.click(screen.getByRole('button', { name: `set-status-${status}` }));
      await waitFor(() => {
        expect(screen.getByTestId('status-filter')).toHaveTextContent(status);
      });
    }
  });
});
