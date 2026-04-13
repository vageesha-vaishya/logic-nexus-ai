// AMRO Unified Layout Components
// 
// These components provide a consistent, enterprise-grade layout model
// across all AMRO modules without breaking existing functionality.
//
// Usage:
// import {
//   AmroUnifiedPageLayout,
//   AmroUnifiedTable,
//   AmroUnifiedActions,
//   AmroUnifiedForm,
// } from '@/features/module-amro/components/unified';

export { AmroUnifiedPageLayout } from './AmroUnifiedPageLayout';
export { AmroUnifiedTable } from './AmroUnifiedTable';
export { AmroUnifiedActions, AmroActions } from './AmroUnifiedActions';
export { AmroUnifiedForm } from './AmroUnifiedForm';

export type {
  BreadcrumbItem,
  AmroUnifiedPageLayoutProps,
} from './AmroUnifiedPageLayout';

export type {
  Column,
  FilterOption,
  TableFilter,
  SearchConfig,
  PaginationConfig,
  AmroUnifiedTableProps,
} from './AmroUnifiedTable';

export type {
  ActionItem,
  AmroUnifiedActionsProps,
} from './AmroUnifiedActions';

export type {
  AmroUnifiedFormProps,
  FormSectionProps,
  FormFieldProps,
  FormTabProps,
  FormTabsProps,
} from './AmroUnifiedForm';
