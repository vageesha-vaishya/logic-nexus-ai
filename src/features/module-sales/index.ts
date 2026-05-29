// Phase 4 Sales Steps 2+3 — module-sales public surface.
// All sales-domain components moved from src/components/crm/Lead* and
// src/components/assignment/. New consumers should import from
// '@/features/module-sales' rather than reaching into components/ directly.

export { LeadActivitiesTimeline } from './components/LeadActivitiesTimeline';
export { LeadCard } from './components/LeadCard';
export { LeadForm } from './components/LeadForm';
export { LeadScoringCard } from './components/LeadScoringCard';
export { LeadWorkspaceSections } from './components/LeadWorkspaceSections';
export { LeadsMasterDataFormModal } from './components/LeadsMasterDataFormModal';
export * from './components/LeadsPipelineComponents';
export * from './components/lead-workspace-bus';

export { AssignmentAnalytics } from './components/assignment/AssignmentAnalytics';
export { AssignmentHistory } from './components/assignment/AssignmentHistory';
export { AssignmentQueue } from './components/assignment/AssignmentQueue';
export { AssignmentRuleForm } from './components/assignment/AssignmentRuleForm';
export { AssignmentRules } from './components/assignment/AssignmentRules';
export { ManualAssignment } from './components/assignment/ManualAssignment';
export { TerritoryGeographyManager } from './components/assignment/TerritoryGeographyManager';
export { TerritoryManagement } from './components/assignment/TerritoryManagement';
export { UserCapacity } from './components/assignment/UserCapacity';
