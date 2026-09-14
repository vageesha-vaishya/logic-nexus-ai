import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EnterpriseDashboardShell } from './EnterpriseDashboardShell';
import type { EnterpriseFeedRow, EnterpriseKpi, EnterpriseLane } from '@/hooks/useEnterpriseDashboardData';

const kpis: EnterpriseKpi[] = [
  { label: 'Active Shipments', value: '128', delta: '12% flow ratio', tone: 'text-status-success-foreground' },
];

const lanes: EnterpriseLane[] = [
  { name: 'Intake Queue', value: 42, progress: 60, badge: 'Needs Triage', badgeTone: 'secondary' },
  { name: 'Quote Execution', value: 18, progress: 30, badge: 'Healthy', badgeTone: 'outline' },
];

const activityRows: EnterpriseFeedRow[] = [
  { account: 'Account 1', event: 'Activity update received', owner: 'Operations Desk', status: 'In Progress', eta: 'Next' },
];

describe('EnterpriseDashboardShell', () => {
  it('names every progress bar after its lane', () => {
    render(
      <EnterpriseDashboardShell
        profile="operations"
        heading="Execution Overview"
        subheading="Live operational status"
        kpis={kpis}
        lanes={lanes}
        activityRows={activityRows}
      />,
    );

    for (const bar of screen.getAllByRole('progressbar')) {
      expect(bar).toHaveAccessibleName();
    }
  });
});
