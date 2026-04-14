/**
 * Work Package Templates Services
 * 
 * Barrel export for all API services
 */

export {
  fetchTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  cloneTemplate,
  bulkDeleteTemplates,
  bulkUpdateTemplateStatus,
  fetchAircraftModels,
} from './templateService';

export {
  exportTemplates,
  exportToCSV,
  exportToExcel,
  exportToPDF,
  getExportColumns,
} from './exportService';

export type {
  FetchTemplatesParams,
  FetchTemplatesResponse,
  TemplateServiceError,
} from './templateService';

export type {
  ExportFormat,
  ExportOptions,
  ExportResult,
} from './exportService';
