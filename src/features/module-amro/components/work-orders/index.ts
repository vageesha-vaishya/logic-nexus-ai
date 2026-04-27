// Work Order Management Components
export { AmroWorkOrdersListPage } from './AmroWorkOrdersListPage';
export { AmroWorkOrderDetailPage } from './AmroWorkOrderDetailPage';
export { AmroEmergencyQuickAccessPanel } from './AmroEmergencyQuickAccessPanel';
export { AmroNonScheduledTaskPanel } from './AmroNonScheduledTaskPanel';
export { AmroComplianceDashboard } from './AmroComplianceDashboard';
export { AmroWorkOrderCreateWizard } from './AmroWorkOrderCreateWizard';

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
  EmergencyWorkOrder,
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
  useListWorkOrders,
  useWorkOrder,
  useCreateWorkOrder,
  useUpdateWorkOrder,
  useTransitionWorkOrder,
  useDeleteWorkOrder,
  useWorkOrderActions,
} from './useWorkOrderState';

// Aircraft State
export {
  useAircraftList,
  useAircraftOptions,
  useAircraftById,
} from './useAircraftState';

// Template Options
export {
  useWorkOrderTemplateOptions,
} from './useWorkOrderTemplates';

export type {
  WorkOrderTemplateOption,
} from './useWorkOrderTemplates';

// Types - Work Packages
export type {
  WorkOrderListItem,
  WorkOrderDetail,
  WorkOrderTask,
  WorkOrderMaterial,
  MaintenanceEvent,
  WorkOrderStatus,
  WorkOrderPriority,
  MaintenanceType,
} from './useWorkOrderState';
