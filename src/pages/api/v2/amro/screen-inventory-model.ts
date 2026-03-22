export type AmroScreenDevice = 'Desktop' | 'Tablet' | 'Mobile';
export type AmroModuleId =
  | 'MOD-AMRO-01'
  | 'MOD-AMRO-02'
  | 'MOD-AMRO-03'
  | 'MOD-AMRO-04'
  | 'MOD-AMRO-05'
  | 'MOD-AMRO-06'
  | 'MOD-AMRO-07'
  | 'MOD-AMRO-08'
  | 'MOD-AMRO-09'
  | 'MOD-AMRO-10';

export type AmroScreenInventoryRow = {
  screenId: string;
  screenName: string;
  module: string;
  primaryPersona: string[];
  device: AmroScreenDevice[];
};

export type AmroLayoutContractSection = {
  region: string;
  requirements: string[];
};

export type AmroScreenLayoutContract = {
  screenId: 'SCR-AMRO-001' | 'SCR-AMRO-002' | 'SCR-AMRO-004' | 'SCR-AMRO-005';
  screenName: string;
  sections: AmroLayoutContractSection[];
  guardrails?: string[];
};

export type AmroActionState = 'enabled' | 'disabled-with-reason' | 'hidden-by-permission';
export type AmroSemanticColor = 'success' | 'warning' | 'critical' | 'blocked' | 'informational';

export type AmroUiUxBehaviorRules = {
  stableActionOrder: string[];
  primaryActionStates: AmroActionState[];
  deterministicColorSemantics: AmroSemanticColor[];
  persistence: {
    view: 'browser-storage';
    theme: 'browser-storage';
    restoreOnRemount: boolean;
  };
  serverPagination: {
    defaultEnabled: boolean;
    preserveUserPageSize: boolean;
  };
  irreversibleActionProtection: {
    dualConfirmationRequired: boolean;
    rationaleCaptureRequired: boolean;
  };
};

export type AmroAccessibilityRequirement = {
  area: 'Keyboard navigation' | 'Screen reader labels' | 'Dynamic updates' | 'Language/locale' | 'Color safety';
  requirement: string;
  acceptanceCriteria: string;
};

export type AmroUiUxMappingMatrixRow = {
  moduleId: AmroModuleId;
  primaryScreens: string[];
  wireframeReferences: string[];
  userFlowReferences: string[];
  interfaceSpecifications: string[];
};

export const AMRO_SCREEN_INVENTORY: ReadonlyArray<AmroScreenInventoryRow> = [
  {
    screenId: 'SCR-AMRO-001',
    screenName: 'Overview Dashboard',
    module: 'Overview',
    primaryPersona: ['Management', 'Planner'],
    device: ['Desktop', 'Tablet'],
  },
  {
    screenId: 'SCR-AMRO-002',
    screenName: 'Work Package List',
    module: 'Work Package',
    primaryPersona: ['Planner', 'Engineer'],
    device: ['Desktop', 'Tablet'],
  },
  {
    screenId: 'SCR-AMRO-003',
    screenName: 'Work Package Create Drawer',
    module: 'Work Package',
    primaryPersona: ['Planner'],
    device: ['Desktop', 'Tablet'],
  },
  {
    screenId: 'SCR-AMRO-004',
    screenName: 'Work Package Detail Sheet',
    module: 'Work Package',
    primaryPersona: ['Engineer', 'Inspector'],
    device: ['Desktop', 'Tablet'],
  },
  {
    screenId: 'SCR-AMRO-005',
    screenName: 'Task Execution Card',
    module: 'Task Execution',
    primaryPersona: ['Technician'],
    device: ['Mobile', 'Tablet'],
  },
  {
    screenId: 'SCR-AMRO-006',
    screenName: 'Scheduling Board',
    module: 'Scheduling',
    primaryPersona: ['Planner'],
    device: ['Desktop'],
  },
  {
    screenId: 'SCR-AMRO-007',
    screenName: 'Materials Reservation Panel',
    module: 'Parts',
    primaryPersona: ['Store', 'Planner'],
    device: ['Desktop', 'Tablet'],
  },
  {
    screenId: 'SCR-AMRO-008',
    screenName: 'Compliance Gate Modal',
    module: 'Compliance',
    primaryPersona: ['Inspector'],
    device: ['Desktop', 'Tablet'],
  },
  {
    screenId: 'SCR-AMRO-009',
    screenName: 'Certification Decision Panel',
    module: 'Certification',
    primaryPersona: ['Certifying Engineer'],
    device: ['Desktop', 'Tablet'],
  },
  {
    screenId: 'SCR-AMRO-010',
    screenName: 'Audit Replay Timeline',
    module: 'Audit',
    primaryPersona: ['Compliance', 'Auditor'],
    device: ['Desktop'],
  },
  {
    screenId: 'SCR-AMRO-011',
    screenName: 'Integration Monitor Console',
    module: 'Integration',
    primaryPersona: ['Integration Ops'],
    device: ['Desktop'],
  },
  {
    screenId: 'SCR-AMRO-012',
    screenName: 'Forecast Recommendation Hub',
    module: 'Intelligence',
    primaryPersona: ['Planner', 'Management'],
    device: ['Desktop', 'Tablet'],
  },
] as const;

export const AMRO_SCREEN_LAYOUT_CONTRACTS: ReadonlyArray<AmroScreenLayoutContract> = [
  {
    screenId: 'SCR-AMRO-001',
    screenName: 'Overview Dashboard',
    sections: [
      {
        region: 'Header',
        requirements: ['Date range', 'Regulator profile', 'Fleet filters', 'Station filters', 'Export', 'Refresh'],
      },
      {
        region: 'Body region A',
        requirements: ['Open WPs KPI', 'AOG KPI', 'Compliance Risk KPI', 'Deferred KPI', 'Fill Rate KPI'],
      },
      {
        region: 'Body region B',
        requirements: ['Work package status pipeline', 'Risk heatmap'],
      },
      {
        region: 'Body region C',
        requirements: ['Forecast panel', 'Confidence segmentation', 'Recommended actions'],
      },
      {
        region: 'Footer',
        requirements: ['SLA trend strip (7d/30d)', 'Data freshness indicator', 'Sync health'],
      },
    ],
  },
  {
    screenId: 'SCR-AMRO-002',
    screenName: 'Work Package List',
    sections: [
      {
        region: 'Header',
        requirements: ['Global search', 'Advanced filters', 'Saved view selector', 'Create action'],
      },
      {
        region: 'Grid',
        requirements: ['Frozen identifiers', 'Sortable columns', 'Quick-status chips', 'Overdue highlight rules'],
      },
      {
        region: 'Right rail',
        requirements: ['Parts readiness', 'Compliance blockers', 'Assignee'],
      },
      {
        region: 'Footer',
        requirements: ['Pagination', 'Bulk action toolbar', 'Export state indicator'],
      },
    ],
  },
  {
    screenId: 'SCR-AMRO-004',
    screenName: 'Work Package Detail Sheet',
    sections: [
      {
        region: 'Sticky top actions',
        requirements: ['Assign', 'Schedule', 'Run gate check', 'Hold', 'Close'],
      },
      {
        region: 'Tab body',
        requirements: ['Overview', 'Tasks', 'Materials', 'Compliance', 'Notes', 'Attachments', 'Audit'],
      },
      {
        region: 'Side panel',
        requirements: ['Activity feed', 'Signature state', 'Pending blockers', 'Escalation shortcuts'],
      },
    ],
    guardrails: ['Unsaved changes warning', 'State-transition confirmation', 'Role-based button visibility'],
  },
  {
    screenId: 'SCR-AMRO-005',
    screenName: 'Task Execution Card',
    sections: [
      {
        region: 'Card top',
        requirements: ['Task number', 'Status', 'Elapsed/target time', 'Offline queue indicator'],
      },
      {
        region: 'Main body',
        requirements: ['Ordered steps', 'Explicit state', 'Mandatory evidence markers'],
      },
      {
        region: 'Evidence tray',
        requirements: ['Camera control', 'Upload control', 'Note control', 'Integrity status'],
      },
      {
        region: 'Action row',
        requirements: ['Save offline', 'Submit', 'Request support', 'Disabled states linked to policy checks'],
      },
    ],
  },
] as const;

export const AMRO_UIUX_BEHAVIOR_RULES: AmroUiUxBehaviorRules = {
  stableActionOrder: ['search', 'filter', 'view', 'create', 'refresh', 'import-export', 'theme'],
  primaryActionStates: ['enabled', 'disabled-with-reason', 'hidden-by-permission'],
  deterministicColorSemantics: ['success', 'warning', 'critical', 'blocked', 'informational'],
  persistence: {
    view: 'browser-storage',
    theme: 'browser-storage',
    restoreOnRemount: true,
  },
  serverPagination: {
    defaultEnabled: true,
    preserveUserPageSize: true,
  },
  irreversibleActionProtection: {
    dualConfirmationRequired: true,
    rationaleCaptureRequired: true,
  },
} as const;

export const AMRO_ACCESSIBILITY_I18N_REQUIREMENTS: ReadonlyArray<AmroAccessibilityRequirement> = [
  {
    area: 'Keyboard navigation',
    requirement: 'Full workflow keyboard-operable',
    acceptanceCriteria: '100% core actions without pointer input',
  },
  {
    area: 'Screen reader labels',
    requirement: 'Semantic labels and landmarks',
    acceptanceCriteria: 'Zero blocker issues in accessibility scan',
  },
  {
    area: 'Dynamic updates',
    requirement: 'Announce async status/gate outcomes',
    acceptanceCriteria: 'ARIA-live regions validated for critical updates',
  },
  {
    area: 'Language/locale',
    requirement: 'Unit/date/time localization support',
    acceptanceCriteria: 'Locale switch does not break validation or sort behavior',
  },
  {
    area: 'Color safety',
    requirement: 'Non-color-only status communication',
    acceptanceCriteria: 'Status icon/text present for all color-coded states',
  },
] as const;

export const AMRO_UIUX_MAPPING_MATRIX: ReadonlyArray<AmroUiUxMappingMatrixRow> = [
  {
    moduleId: 'MOD-AMRO-01',
    primaryScreens: ['SCR-AMRO-001 Overview Dashboard'],
    wireframeReferences: ['5.3.1'],
    userFlowReferences: ['5.4.1', '17.1'],
    interfaceSpecifications: ['16.2 dashboard layout contract', '16.3 behavior rules'],
  },
  {
    moduleId: 'MOD-AMRO-02',
    primaryScreens: ['SCR-AMRO-002 List', 'SCR-AMRO-003 Create Drawer', 'SCR-AMRO-004 Detail Sheet'],
    wireframeReferences: ['5.3.2', '5.3.3'],
    userFlowReferences: ['5.4.1', '17.1'],
    interfaceSpecifications: ['16.2 list/detail contracts', '16.3 role-gated actions'],
  },
  {
    moduleId: 'MOD-AMRO-03',
    primaryScreens: ['SCR-AMRO-005 Task Execution Card'],
    wireframeReferences: ['5.3.4'],
    userFlowReferences: ['5.4.2', '17.2'],
    interfaceSpecifications: ['16.2 task card contract', '16.4 accessibility'],
  },
  {
    moduleId: 'MOD-AMRO-04',
    primaryScreens: ['SCR-AMRO-006 Scheduling Board'],
    wireframeReferences: ['5.3.1 context', '16.2 board contract'],
    userFlowReferences: ['5.4.1', '17.1'],
    interfaceSpecifications: ['16.3 action ordering and constraint feedback rules'],
  },
  {
    moduleId: 'MOD-AMRO-05',
    primaryScreens: ['SCR-AMRO-007 Materials Reservation Panel'],
    wireframeReferences: ['5.3.3 materials tab context'],
    userFlowReferences: ['17.1'],
    interfaceSpecifications: ['16.2 detail-side material panel behavior'],
  },
  {
    moduleId: 'MOD-AMRO-06',
    primaryScreens: ['SCR-AMRO-008 Compliance Gate Modal'],
    wireframeReferences: ['5.3.3 compliance tab context'],
    userFlowReferences: ['17.3'],
    interfaceSpecifications: ['16.3 irreversible action protections', '16.4 non-color status'],
  },
  {
    moduleId: 'MOD-AMRO-07',
    primaryScreens: ['SCR-AMRO-009 Certification Decision Panel'],
    wireframeReferences: ['5.3.3 signature/release context'],
    userFlowReferences: ['17.1', '17.3'],
    interfaceSpecifications: ['16.3 permission visibility', '16.4 keyboard operability'],
  },
  {
    moduleId: 'MOD-AMRO-08',
    primaryScreens: ['SCR-AMRO-011 Integration Monitor Console'],
    wireframeReferences: ['18.2 integration flow'],
    userFlowReferences: ['17.2 sync error path'],
    interfaceSpecifications: ['23.1 retry/replay contract visibility rules'],
  },
  {
    moduleId: 'MOD-AMRO-09',
    primaryScreens: ['SCR-AMRO-012 Forecast Recommendation Hub'],
    wireframeReferences: ['5.3.1 forecast signals'],
    userFlowReferences: ['17.1 planning decision points'],
    interfaceSpecifications: ['16.2 recommendation panel and confidence display'],
  },
  {
    moduleId: 'MOD-AMRO-10',
    primaryScreens: ['SCR-AMRO-010 Audit Replay Timeline'],
    wireframeReferences: ['5.3.3 activity/audit context'],
    userFlowReferences: ['17.3 gate rationale path'],
    interfaceSpecifications: ['19.2 API-AMRO-014 replay interface requirements'],
  },
] as const;

export function buildAmroScreenInventoryEnvelope() {
  const screens = [...AMRO_SCREEN_INVENTORY];
  const layoutContracts = [...AMRO_SCREEN_LAYOUT_CONTRACTS];
  const accessibilityAndI18n = [...AMRO_ACCESSIBILITY_I18N_REQUIREMENTS];
  const uiUxMappingMatrix = [...AMRO_UIUX_MAPPING_MATRIX];
  return {
    screens,
    layoutContracts,
    uiUxMappingMatrix,
    behaviorRules: AMRO_UIUX_BEHAVIOR_RULES,
    accessibilityAndI18n,
    summary: {
      totalScreens: screens.length,
      totalModules: new Set(screens.map((screen) => screen.module)).size,
      mappingMatrixModules: uiUxMappingMatrix.length,
      mobileEnabledScreens: screens.filter((screen) => screen.device.includes('Mobile')).length,
      layoutContractScreens: layoutContracts.length,
      accessibilityAreas: accessibilityAndI18n.length,
    },
  };
}
