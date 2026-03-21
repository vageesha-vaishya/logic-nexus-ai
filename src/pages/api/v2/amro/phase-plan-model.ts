export type AmroPhaseId = 'phase-1' | 'phase-2' | 'phase-3' | 'phase-4';
export type AmroPhaseStatus = 'not-started' | 'in-progress' | 'completed';

export type AmroPhasePlanRow = {
  id: AmroPhaseId;
  label: string;
  duration: string;
  primaryFocus: string;
  deliverables: string[];
  exitCriteria: string;
};

export const AMRO_PHASE_PLAN_MATRIX: ReadonlyArray<AmroPhasePlanRow> = [
  {
    id: 'phase-1',
    label: 'Phase 1',
    duration: 'Weeks 1-6',
    primaryFocus: 'Core UI & APIs',
    deliverables: ['Overview', 'List', 'Detail', 'Task list', 'Role controls'],
    exitCriteria: 'Users can create-plan-view work packages',
  },
  {
    id: 'phase-2',
    label: 'Phase 2',
    duration: 'Weeks 7-12',
    primaryFocus: 'Advanced UX & mobile',
    deliverables: ['Mobile execution', 'Offline sync', 'Compliance gates', 'Scheduling'],
    exitCriteria: 'Offline-to-online flow validated, gates enforce rules',
  },
  {
    id: 'phase-3',
    label: 'Phase 3',
    duration: 'Weeks 13-20',
    primaryFocus: 'Optimization & polish',
    deliverables: ['Performance hardening', 'Accessibility', 'Error recovery'],
    exitCriteria: 'WCAG 2.1 AA, p95/p99 targets met',
  },
  {
    id: 'phase-4',
    label: 'Phase 4',
    duration: 'Weeks 21-26',
    primaryFocus: 'Integration & scale',
    deliverables: ['ERP adapters', 'Reporting', 'Predictive maintenance'],
    exitCriteria: 'Integrations tested, ready for enterprise',
  },
] as const;

function parseStatus(value: string | undefined): AmroPhaseStatus {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'completed') return 'completed';
  if (normalized === 'in-progress') return 'in-progress';
  return 'not-started';
}

export function resolveAmroPhasePlanStatuses(): Record<AmroPhaseId, AmroPhaseStatus> {
  return {
    'phase-1': parseStatus(process.env.AMRO_PHASE_1_STATUS),
    'phase-2': parseStatus(process.env.AMRO_PHASE_2_STATUS),
    'phase-3': parseStatus(process.env.AMRO_PHASE_3_STATUS),
    'phase-4': parseStatus(process.env.AMRO_PHASE_4_STATUS),
  };
}

export function buildAmroPhasePlanProgressEnvelope() {
  const statuses = resolveAmroPhasePlanStatuses();
  const rows = AMRO_PHASE_PLAN_MATRIX.map((row) => ({
    ...row,
    status: statuses[row.id],
  }));
  const completedCount = rows.filter((row) => row.status === 'completed').length;
  const inProgressCount = rows.filter((row) => row.status === 'in-progress').length;
  const completionRatio = Number((completedCount / rows.length).toFixed(2));
  return {
    rows,
    summary: {
      totalPhases: rows.length,
      completedPhases: completedCount,
      inProgressPhases: inProgressCount,
      notStartedPhases: rows.length - completedCount - inProgressCount,
      completionRatio,
    },
  };
}
