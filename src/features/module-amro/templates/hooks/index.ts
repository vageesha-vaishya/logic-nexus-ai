/**
 * Work Package Templates Hooks
 * 
 * Barrel export for all hooks
 */

export {
  useTemplateList,
  useAircraftModels,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  useCloneTemplate,
  useBulkDeleteTemplates,
  useBulkUpdateTemplateStatus,
  templateQueryKeys,
} from './useTemplateQueries';

export {
  useRealTimeUpdates,
  useRealTimeSupport,
} from './useRealTimeUpdates';

export {
  useKeyboardNavigation,
  useFocusTrap,
} from './useKeyboardNavigation';

export type {
  TemplateEventType,
  TemplateEvent,
  ConnectionStatus,
  UseRealTimeUpdatesOptions,
} from './useRealTimeUpdates';

export type {
  GridPosition,
  KeyboardNavigationOptions,
  UseKeyboardNavigationReturn,
} from './useKeyboardNavigation';
