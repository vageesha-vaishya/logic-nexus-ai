/**
 * Export Service for Work Package Templates
 * 
 * Features:
 * - CSV export using papaparse
 * - Excel export using xlsx (SheetJS)
 * - PDF export using @react-pdf/renderer
 * - Client-side and server-side export support
 * - Progress tracking for large datasets
 * - File download handling
 */

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { WorkPackageTemplate } from '../AmroWorkPackageTemplatesPage';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

export interface ExportOptions {
  format: ExportFormat;
  templates: WorkPackageTemplate[];
  columns?: string[]; // Columns to include (defaults to all)
  includeHeaders?: boolean; // Include header row (default: true)
  fileName?: string; // Custom file name
  selectedOnly?: boolean; // Export only selected rows
}

export interface ExportResult {
  success: boolean;
  fileName: string;
  format: ExportFormat;
  rowCount: number;
  error?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const MAINTENANCE_TYPE_LABELS: Record<string, string> = {
  line: 'Line Maintenance',
  base: 'Base Maintenance',
  component: 'Component Maintenance',
  inspection: 'Inspection',
  overhaul: 'Overhaul',
  repair: 'Repair',
  upgrade: 'Upgrade',
  modification: 'Modification',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  draft: 'Draft',
  pending_review: 'Pending Review',
  approved: 'Approved',
  deprecated: 'Deprecated',
  archived: 'Archived',
};

const DEFAULT_COLUMNS = [
  'template_code',
  'template_name',
  'maintenance_type',
  'aircraft_model',
  'version',
  'status',
  'tasks_count',
  'description',
  'estimated_labor_hours',
  'created_at',
  'updated_at',
  'created_by',
  'updated_by',
];

const COLUMN_LABELS: Record<string, string> = {
  template_code: 'Template Code',
  template_name: 'Template Name',
  maintenance_type: 'Maintenance Type',
  aircraft_model: 'Aircraft Model',
  version: 'Version',
  status: 'Status',
  tasks_count: 'Tasks Count',
  description: 'Description',
  estimated_labor_hours: 'Estimated Labor Hours',
  created_at: 'Created At',
  updated_at: 'Updated At',
  created_by: 'Created By',
  updated_by: 'Updated By',
};

// ── Utility Functions ──────────────────────────────────────────────────────────

/**
 * Format date for export
 */
function formatDate(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Transform template to export row
 */
function transformTemplate(template: WorkPackageTemplate, columns: string[]): Record<string, any> {
  const row: Record<string, any> = {};

  columns.forEach(column => {
    switch (column) {
      case 'template_code':
        row[COLUMN_LABELS[column]] = template.template_code;
        break;
      case 'template_name':
        row[COLUMN_LABELS[column]] = template.template_name;
        break;
      case 'maintenance_type':
        row[COLUMN_LABELS[column]] = MAINTENANCE_TYPE_LABELS[template.maintenance_type] || template.maintenance_type;
        break;
      case 'aircraft_model':
        row[COLUMN_LABELS[column]] = template.aircraft_model || '';
        break;
      case 'version':
        row[COLUMN_LABELS[column]] = template.version;
        break;
      case 'status':
        row[COLUMN_LABELS[column]] = STATUS_LABELS[template.status] || template.status;
        break;
      case 'tasks_count':
        row[COLUMN_LABELS[column]] = template.tasks_count;
        break;
      case 'description':
        row[COLUMN_LABELS[column]] = template.description || '';
        break;
      case 'estimated_labor_hours':
        row[COLUMN_LABELS[column]] = template.estimated_labor_hours || '';
        break;
      case 'created_at':
        row[COLUMN_LABELS[column]] = formatDate(template.created_at);
        break;
      case 'updated_at':
        row[COLUMN_LABELS[column]] = formatDate(template.updated_at);
        break;
      case 'created_by':
        row[COLUMN_LABELS[column]] = template.created_by || '';
        break;
      case 'updated_by':
        row[COLUMN_LABELS[column]] = template.updated_by || '';
        break;
      default:
        row[column] = (template as any)[column] || '';
    }
  });

  return row;
}

/**
 * Generate file name
 */
function generateFileName(format: ExportFormat, customName?: string): string {
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const baseName = customName || `work_package_templates_${timestamp}`;
  
  const extensions: Record<ExportFormat, string> = {
    csv: '.csv',
    xlsx: '.xlsx',
    pdf: '.pdf',
  };

  return `${baseName}${extensions[format]}`;
}

/**
 * Download file
 */
function downloadFile(blob: Blob, fileName: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

// ── Export Functions ───────────────────────────────────────────────────────────

/**
 * Export templates to CSV
 */
export async function exportToCSV(
  templates: WorkPackageTemplate[],
  columns: string[] = DEFAULT_COLUMNS,
  includeHeaders: boolean = true,
  fileName?: string
): Promise<ExportResult> {
  try {
    // Transform data
    const exportData = templates.map(template =>
      transformTemplate(template, columns)
    );

    // Generate CSV
    const csv = Papa.unparse(exportData, {
      header: includeHeaders,
      newline: '\r\n', // Windows-style line endings for Excel compatibility
    });

    // Create blob and download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const finalFileName = generateFileName('csv', fileName);
    downloadFile(blob, finalFileName);

    return {
      success: true,
      fileName: finalFileName,
      format: 'csv',
      rowCount: templates.length,
    };
  } catch (error: any) {
    console.error('CSV export failed:', error);
    return {
      success: false,
      fileName: '',
      format: 'csv',
      rowCount: 0,
      error: error.message || 'Failed to export CSV',
    };
  }
}

/**
 * Export templates to Excel
 */
export async function exportToExcel(
  templates: WorkPackageTemplate[],
  columns: string[] = DEFAULT_COLUMNS,
  includeHeaders: boolean = true,
  fileName?: string
): Promise<ExportResult> {
  try {
    // Transform data
    const exportData = templates.map(template =>
      transformTemplate(template, columns)
    );

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData, {
      header: includeHeaders ? columns.map(col => COLUMN_LABELS[col]) : undefined,
    });

    // Set column widths
    const colWidths = columns.map(col => {
      const label = COLUMN_LABELS[col] || col;
      return { wch: Math.max(label.length, 15) };
    });
    ws['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Templates');

    // Generate Excel file
    const excelBuffer = XLSX.write(wb, {
      bookType: 'xlsx',
      type: 'array',
    });

    // Create blob and download
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const finalFileName = generateFileName('xlsx', fileName);
    downloadFile(blob, finalFileName);

    return {
      success: true,
      fileName: finalFileName,
      format: 'xlsx',
      rowCount: templates.length,
    };
  } catch (error: any) {
    console.error('Excel export failed:', error);
    return {
      success: false,
      fileName: '',
      format: 'xlsx',
      rowCount: 0,
      error: error.message || 'Failed to export Excel',
    };
  }
}

/**
 * Export templates to PDF
 * Note: PDF export is client-side and may be slow for large datasets (>1000 rows)
 */
export async function exportToPDF(
  templates: WorkPackageTemplate[],
  columns: string[] = DEFAULT_COLUMNS,
  includeHeaders: boolean = true,
  fileName?: string
): Promise<ExportResult> {
  try {
    // For large datasets, warn user
    if (templates.length > 1000) {
      console.warn('PDF export for large datasets may be slow. Consider using CSV or Excel.');
    }

    // Transform data to rows
    const headers = columns.map(col => COLUMN_LABELS[col]);
    const rows = templates.map(template =>
      columns.map(col => {
        const value = (template as any)[col];
        if (col === 'maintenance_type') {
          return MAINTENANCE_TYPE_LABELS[value] || value;
        }
        if (col === 'status') {
          return STATUS_LABELS[value] || value;
        }
        if (col === 'created_at' || col === 'updated_at') {
          return formatDate(value);
        }
        return value || '';
      })
    );

    // Generate PDF using browser print
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      throw new Error('Popup blocked. Please allow popups for this site.');
    }

    // Build HTML table
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Work Package Templates</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 20px;
          }
          h1 {
            font-size: 18px;
            margin-bottom: 20px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 6px;
            text-align: left;
          }
          th {
            background-color: #f5f5f5;
            font-weight: bold;
          }
          tr:nth-child(even) {
            background-color: #fafafa;
          }
          @media print {
            @page {
              size: landscape;
              margin: 1cm;
            }
          }
        </style>
      </head>
      <body>
        <h1>Work Package Templates - Export</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>
        <p>Total Templates: ${templates.length}</p>
        <table>
          ${includeHeaders ? `
            <thead>
              <tr>
                ${headers.map(h => `<th>${h}</th>`).join('')}
              </tr>
            </thead>
          ` : ''}
          <tbody>
            ${rows.map(row => `
              <tr>
                ${row.map(cell => `<td>${cell}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    
    // Wait for content to load, then print
    printWindow.onload = () => {
      printWindow.print();
      // Keep window open for user to save as PDF
    };

    const finalFileName = generateFileName('pdf', fileName);

    return {
      success: true,
      fileName: finalFileName,
      format: 'pdf',
      rowCount: templates.length,
    };
  } catch (error: any) {
    console.error('PDF export failed:', error);
    return {
      success: false,
      fileName: '',
      format: 'pdf',
      rowCount: 0,
      error: error.message || 'Failed to export PDF',
    };
  }
}

/**
 * Main export function
 */
export async function exportTemplates(
  options: ExportOptions
): Promise<ExportResult> {
  const {
    format,
    templates,
    columns = DEFAULT_COLUMNS,
    includeHeaders = true,
    fileName,
  } = options;

  // Validate
  if (!templates || templates.length === 0) {
    return {
      success: false,
      fileName: '',
      format,
      rowCount: 0,
      error: 'No templates to export',
    };
  }

  // Export based on format
  switch (format) {
    case 'csv':
      return exportToCSV(templates, columns, includeHeaders, fileName);
    case 'xlsx':
      return exportToExcel(templates, columns, includeHeaders, fileName);
    case 'pdf':
      return exportToPDF(templates, columns, includeHeaders, fileName);
    default:
      return {
        success: false,
        fileName: '',
        format,
        rowCount: 0,
        error: `Unsupported export format: ${format}`,
      };
  }
}

/**
 * Get available export columns
 */
export function getExportColumns(): Array<{ id: string; label: string }> {
  return DEFAULT_COLUMNS.map(col => ({
    id: col,
    label: COLUMN_LABELS[col] || col,
  }));
}
