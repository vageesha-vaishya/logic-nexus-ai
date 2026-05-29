// Phase 4 Sales Steps 2+3 — module-sales surface.
// Re-exports the sales-domain components moved from src/components/crm/Lead*
// and src/components/assignment/. New consumers should import from
// '@/features/module-sales' rather than reaching into components/ directly.

export { default as LeadActivitiesTimeline } from './components/LeadActivitiesTimeline';
export { default as LeadCard } from './components/LeadCard';
export { default as LeadForm } from './components/LeadForm';
export { default as LeadScoringCard } from './components/LeadScoringCard';
export { default as LeadWorkspaceSections } from './components/LeadWorkspaceSections';
export { default as LeadsMasterDataFormModal } from './components/LeadsMasterDataFormModal';
export * from './components/LeadsPipelineComponents';
export * from './components/lead-workspace-bus';

export { default as AssignmentAnalytics } from './components/assignment/AssignmentAnalytics';
export { default as AssignmentHistory } from './components/assignment/AssignmentHistory';
export { default as AssignmentQueue } from './components/assignment/AssignmentQueue';
export { default as AssignmentRuleForm } from './components/assignment/AssignmentRuleForm';
export { default as AssignmentRules } from './components/assignment/AssignmentRules';
export { default as ManualAssignment } from './components/assignment/ManualAssignment';
export { default as TerritoryGeographyManager } from './components/assignment/TerritoryGeographyManager';
export { default as TerritoryManagement } from './components/assignment/TerritoryManagement';
export { default as UserCapacity } from './components/assignment/UserCapacity';
