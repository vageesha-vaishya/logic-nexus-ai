// Work Order Management Components
export { AmroWorkOrdersListPage } from './AmroWorkOrdersListPage';
export { AmroWorkPackageDetailPage } from './AmroWorkPackageDetailPage';
export { AmroEmergencyQuickAccessPanel } from './AmroEmergencyQuickAccessPanel';
export { AmroNonScheduledTaskPanel } from './AmroNonScheduledTaskPanel';
export { AmroComplianceDashboard } from './AmroComplianceDashboard';
export { AmroWorkPackageCreateWizard } from './AmroWorkPackageCreateWizard';

// Template Version Management Hooks
export {
  useListTemplateVersions,
  useTemplateVersion,
  useCreateTemplateVersion,
  useUpdateTemplateVersion,
  useDeleteTemplateVersion,
  useSubmitTemplateVersion,
  useReviewTemplateVersion,
  useTemplateVersionActions,
} from './useTemplateVersionState';

export type {
  TemplateVersion,
  TemplateVersionStatus,
  TemplateVersionListResponse,
} from './useTemplateVersionState';

// Emergency Work Package Hooks
export {
  useListEmergencyWP,
  useCreateEmergencyWP,
  useResolveEmergencyWP,
  useEmergencyWPActions,
} from './useEmergencyWPState';

export type {
  EmergencyWorkPackage,
  EmergencyWPListResponse,
  EmergencyType,
  UrgencyLevel,
} from './useEmergencyWPState';

// Non-Scheduled Task Hooks
export {
  useListNonScheduledTasks,
  useNonScheduledTask,
  useCreateNonScheduledTask,
  useConvertNonScheduledTaskToWP,
  useNonScheduledTaskActions,
} from './useNonScheduledTaskState';

export type {
  NonScheduledTask,
  NonScheduledTaskListResponse,
  TaskSource,
  TaskPriority,
  TaskStatus,
} from './useNonScheduledTaskState';

// Compliance Management Hooks
export {
  useListComplianceRecords,
  useCreateComplianceRecord,
  useCreateCertificate,
  useComplianceActions,
} from './useComplianceState';

export type {
  ComplianceRecord,
  ComplianceRecordListResponse,
  ComplianceType,
  ComplianceStatus,
} from './useComplianceState';

// State Management - Work Packages
export {
  useListWorkPackages,
  useWorkPackage,
  useCreateWorkPackage,
  useUpdateWorkPackage,
  useTransitionWorkPackage,
  useDeleteWorkPackage,
  useWorkPackageActions,
} from './useWorkPackageState';

// Aircraft State
export {
  useAircraftList,
  useAircraftOptions,
  useAircraftById,
} from './useAircraftState';

// Types - Work Packages
export type {
  WorkPackageListItem,
  WorkPackageDetail,
  WorkPackageTask,
  WorkPackageMaterial,
  MaintenanceEvent,
  WorkPackageStatus,
  WorkPackagePriority,
  MaintenanceType,
} from './useWorkPackageState';
