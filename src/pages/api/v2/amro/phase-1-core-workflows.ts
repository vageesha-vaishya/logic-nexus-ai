export type AmroPhase1DeliverableId =
  | 'UX-AMRO-001'
  | 'UX-AMRO-002'
  | 'UX-AMRO-003'
  | 'UX-AMRO-004'
  | 'UX-AMRO-005'
  | 'UX-AMRO-006'
  | 'UX-AMRO-017'
  | 'API-AMRO-METRICS'
  | 'API-AMRO-WORK-PACKAGE-CRUD'
  | 'API-AMRO-TASKS'
  | 'QA-AMRO-UNIT-TESTS'
  | 'QA-AMRO-INTEGRATION-TESTS'
  | 'DEVOPS-AMRO-FEATURE-FLAGS';

export type AmroPhase1Owner = 'Frontend' | 'Backend' | 'QA' | 'DevOps';
export type AmroPhase1Status = 'not-started' | 'in-progress' | 'completed';

export type AmroPhase1Deliverable = {
  id: AmroPhase1DeliverableId;
  title: string;
  acceptanceCriteria: string;
  owner: AmroPhase1Owner;
  effort: string;
};

export const AMRO_PHASE_1_SCOPE = {
  phase: 'Phase 1',
  title: 'Core UI Components & Basic Workflows',
  duration: 'Weeks 1-6',
  allocation: '4.5 FTE',
  goals: [
    'Establish AMRO domain routes and navigation',
    'Implement overview dashboard with real-time metrics',
    'Enable work package CRUD with full detail view',
    'Enforce role-based action visibility',
    'Pass end-to-end integration tests',
  ],
  blockersAndDependencies: [
    'Requires AMRO schema foundation (M0 completion)',
    'Requires platform auth and RBAC infrastructure',
    'Unblocks Phase 2 mobile and compliance features',
  ],
  successMetrics: [
    'All work packages visible in list and detail',
    'Status transitions work with audit events',
    'Role-based visibility enforced',
    'p99 latency <1s for dashboard load',
    'Zero data leakage across tenants',
  ],
} as const;

export const AMRO_PHASE_1_DELIVERABLES: ReadonlyArray<AmroPhase1Deliverable> = [
  {
    id: 'UX-AMRO-001',
    title: 'Overview Dashboard',
    acceptanceCriteria: 'KPI load <1s, role-filtered, live metrics via WebSocket',
    owner: 'Frontend',
    effort: '2 eng-days',
  },
  {
    id: 'UX-AMRO-002',
    title: 'Kanban Board',
    acceptanceCriteria: 'Drag-drop status changes, audit events, valid transitions',
    owner: 'Frontend',
    effort: '4 eng-days',
  },
  {
    id: 'UX-AMRO-003',
    title: 'Work Package List',
    acceptanceCriteria: 'Filters, search, sorting, pagination, saved views',
    owner: 'Frontend',
    effort: '3 eng-days',
  },
  {
    id: 'UX-AMRO-004',
    title: 'Create Drawer',
    acceptanceCriteria: 'Form validation, defaults, tenant-scoped, required fields',
    owner: 'Frontend',
    effort: '2 eng-days',
  },
  {
    id: 'UX-AMRO-005',
    title: 'Detail Sheet',
    acceptanceCriteria: 'Inline editing, tab persistence, unsaved warning',
    owner: 'Frontend',
    effort: '3 eng-days',
  },
  {
    id: 'UX-AMRO-006',
    title: 'Task List (in detail)',
    acceptanceCriteria: 'Step ordering, inline status, task modal',
    owner: 'Frontend',
    effort: '2 eng-days',
  },
  {
    id: 'UX-AMRO-017',
    title: 'Role Controls',
    acceptanceCriteria: 'Permission matrix, hidden/disabled actions',
    owner: 'Frontend',
    effort: '1.5 eng-days',
  },
  {
    id: 'API-AMRO-METRICS',
    title: 'Metrics & KPI APIs',
    acceptanceCriteria: 'Real-time dashboard endpoint, list filters API',
    owner: 'Backend',
    effort: '2 eng-days',
  },
  {
    id: 'API-AMRO-WORK-PACKAGE-CRUD',
    title: 'Work Package CRUD APIs',
    acceptanceCriteria: 'Create, read, update, list endpoints',
    owner: 'Backend',
    effort: '2.5 eng-days',
  },
  {
    id: 'API-AMRO-TASKS',
    title: 'Task APIs',
    acceptanceCriteria: 'Task list, update, status transition endpoints',
    owner: 'Backend',
    effort: '2 eng-days',
  },
  {
    id: 'QA-AMRO-UNIT-TESTS',
    title: 'Unit Tests (Phase 1)',
    acceptanceCriteria: '75%+ coverage for components and services',
    owner: 'QA',
    effort: '1.5 eng-days',
  },
  {
    id: 'QA-AMRO-INTEGRATION-TESTS',
    title: 'Integration Tests (Phase 1)',
    acceptanceCriteria: 'Create-plan-view flow, role controls, tenant isolation',
    owner: 'QA',
    effort: '1 eng-day',
  },
  {
    id: 'DEVOPS-AMRO-FEATURE-FLAGS',
    title: 'Feature flag setup',
    acceptanceCriteria: 'Rollout control for Phase 1 features',
    owner: 'DevOps',
    effort: '0.5 eng-days',
  },
] as const;

function parseStatus(value: string | undefined): AmroPhase1Status {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'completed') return 'completed';
  if (normalized === 'in-progress') return 'in-progress';
  return 'not-started';
}

function toEnvKey(id: AmroPhase1DeliverableId): string {
  return `AMRO_PHASE_1_${id.replace(/-/g, '_').toUpperCase()}_STATUS`;
}

export function resolveAmroPhase1DeliverableStatuses(): Record<AmroPhase1DeliverableId, AmroPhase1Status> {
  return AMRO_PHASE_1_DELIVERABLES.reduce(
    (acc, item) => {
      acc[item.id] = parseStatus(process.env[toEnvKey(item.id)]);
      return acc;
    },
    {} as Record<AmroPhase1DeliverableId, AmroPhase1Status>
  );
}

export function buildAmroPhase1ReadinessEnvelope() {
  const statuses = resolveAmroPhase1DeliverableStatuses();
  const deliverables = AMRO_PHASE_1_DELIVERABLES.map((item) => ({
    ...item,
    status: statuses[item.id],
  }));
  const completed = deliverables.filter((item) => item.status === 'completed').length;
  const inProgress = deliverables.filter((item) => item.status === 'in-progress').length;
  const progressRatio = Number((completed / deliverables.length).toFixed(2));
  return {
    scope: AMRO_PHASE_1_SCOPE,
    deliverables,
    summary: {
      total: deliverables.length,
      completed,
      inProgress,
      notStarted: deliverables.length - completed - inProgress,
      progressRatio,
    },
  };
}
