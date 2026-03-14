export type RolloutPhase = {
  name: string;
  weeks: string;
  scope: string[];
  successCriteria: string[];
};

export const crmDesignSystemRolloutPlan: RolloutPhase[] = [
  {
    name: 'Pilot Contacts',
    weeks: 'week 1-2',
    scope: ['Contacts module', 'ContactList page', 'FormField and DataTable adoption'],
    successCriteria: ['No critical regressions', 'Zero accessibility violations', 'User completion rate maintained']
  },
  {
    name: 'Expand Deals & Quotes',
    weeks: 'week 3-4',
    scope: ['Deals pipeline', 'Quotes module', 'Navigation and FilterBar adoption'],
    successCriteria: ['Visual diffs approved', 'Cross-browser smoke pass', 'Performance budgets pass']
  },
  {
    name: 'Codemod Legacy Components',
    weeks: 'week 5-6',
    scope: ['Automated replacement of legacy button/form/table primitives', 'Template migration to CRMPageShell'],
    successCriteria: ['Codemod produces clean diffs', 'No blocking defects', 'Coverage remains 100%']
  },
  {
    name: 'Archive Deprecated Assets',
    weeks: '30 days after migration',
    scope: ['Remove deprecated assets', 'Disable old component exports', 'Finalize cleanup'],
    successCriteria: ['No runtime references to deprecated assets', 'Bundle size reduced', 'Release notes published']
  }
];

export const getRolloutPhaseNames = (): string[] => crmDesignSystemRolloutPlan.map((phase) => phase.name);
