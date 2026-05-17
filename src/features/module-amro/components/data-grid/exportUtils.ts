/**
 * AMRO Data Grid Export Utility
 *
 * Export functionality supporting:
 * - CSV export with column selection
 * - Excel (XLSX) export
 * - PDF export (print-friendly)
 */

import { ColumnConfig } from './store/useDataGridStore';
import { logger } from "@/lib/logger";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ExportOptions {
  format: 'csv' | 'xlsx' | 'pdf';
  columns?: string[]; // Column IDs to include
  selectedRowsOnly?: boolean;
  fileName?: string;
}

// ── CSV Export ─────────────────────────────────────────────────────────────────

function escapeCSV(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCSV(
  data: Record<string, any>[],
  columns: ColumnConfig[],
  options: ExportOptions
): void {
  const { columns: selectedColumns, fileName = 'export' } = options;

  // Filter columns
  const exportColumns = selectedColumns
    ? columns.filter((col) => selectedColumns.includes(col.id))
    : columns.filter((col) => col.id !== 'select' && col.id !== 'actions');

  // Header row
  const headers = exportColumns.map((col) => escapeCSV(col.label));
  const rows = [headers.join(',')];

  // Data rows
  data.forEach((row) => {
    const rowValues = exportColumns.map((col) => {
      let value = typeof col.accessor === 'function' ? col.accessor(row) : row[col.accessor];

      // Format based on column type
      if (col.format === 'currency' && value) {
        value = Number(value).toFixed(2);
      } else if (col.format === 'date' && value) {
        value = new Date(value).toISOString().split('T')[0];
      } else if (col.format === 'badge' && value) {
        value = String(value).replace(/_/g, ' ');
      }

      return escapeCSV(value);
    });
    rows.push(rowValues.join(','));
  });

  // Create and download file
  const csvContent = rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ── Excel Export ───────────────────────────────────────────────────────────────

export function exportToExcel(
  data: Record<string, any>[],
  columns: ColumnConfig[],
  options: ExportOptions
): void {
  // For Excel, we'll generate a CSV that Excel can open
  // In production, you'd use a library like xlsx or exceljs
  exportToCSV(data, columns, { ...options, format: 'xlsx' });

  // Note: For true XLSX export, integrate with:
  // - SheetJS (xlsx): npm install xlsx
  // - ExcelJS: npm install exceljs
  //
  // Example with SheetJS:
  // import * as XLSX from 'xlsx';
  //
  // const exportColumns = selectedColumns
  //   ? columns.filter((col) => selectedColumns.includes(col.id))
  //   : columns.filter((col) => col.id !== 'select' && col.id !== 'actions');
  //
  // const headers = exportColumns.map((col) => col.label);
  // const rows = data.map((row) =>
  //   exportColumns.map((col) => {
  //     let value = typeof col.accessor === 'function' ? col.accessor(row) : row[col.accessor];
  //     if (col.format === 'date' && value) value = new Date(value);
  //     return value;
  //   })
  // );
  //
  // const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  // const wb = XLSX.utils.book_new();
  // XLSX.utils.book_append_sheet(wb, ws, 'Data');
  // XLSX.writeFile(wb, `${fileName}.xlsx`);
}

// ── PDF Export ─────────────────────────────────────────────────────────────────

export function exportToPDF(
  data: Record<string, any>[],
  columns: ColumnConfig[],
  options: ExportOptions
): void {
  const { fileName = 'export' } = options;

  // Filter columns
  const exportColumns = columns.filter(
    (col) => col.id !== 'select' && col.id !== 'actions'
  );

  // Create print-friendly HTML
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow pop-ups to export PDF');
    return;
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatValue = (value: any, col: ColumnConfig) => {
    if (value === null || value === undefined) return '—';
    switch (col.format) {
      case 'currency':
        return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
      case 'date':
        return formatDate(value);
      case 'number':
        return Number(value).toLocaleString();
      case 'badge':
        return String(value).replace(/_/g, ' ');
      default:
        return String(value);
    }
  };

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${fileName}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 40px;
          color: #1a1a1a;
        }
        h1 {
          font-size: 24px;
          margin-bottom: 8px;
        }
        .subtitle {
          color: #666;
          font-size: 14px;
          margin-bottom: 24px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        th {
          background: #f5f5f5;
          padding: 10px 12px;
          text-align: left;
          font-weight: 600;
          border-bottom: 2px solid #ddd;
        }
        td {
          padding: 8px 12px;
          border-bottom: 1px solid #eee;
        }
        tr:nth-child(even) {
          background: #fafafa;
        }
        .footer {
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid #ddd;
          font-size: 12px;
          color: #666;
        }
        @media print {
          body { padding: 20px; }
        }
      </style>
    </head>
    <body>
      <h1>${fileName.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</h1>
      <p class="subtitle">Exported on ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} • ${data.length} records</p>
      <table>
        <thead>
          <tr>
            ${exportColumns.map((col) => `<th>${col.label}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${data
            .map(
              (row) => `
            <tr>
              ${exportColumns
                .map((col) => {
                  const value = typeof col.accessor === 'function' ? col.accessor(row) : row[col.accessor];
                  return `<td>${formatValue(value, col)}</td>`;
                })
                .join('')}
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
      <div class="footer">
        Generated by AMRO Data Grid Export
      </div>
      <script>
        window.onload = function() {
          window.print();
          window.onafterprint = function() { window.close(); };
        };
      </script>
    </body>
    </html>
  `);

  printWindow.document.close();
}

// ── Main Export Function ───────────────────────────────────────────────────────

export function exportData(
  data: Record<string, any>[],
  columns: ColumnConfig[],
  options: ExportOptions
): void {
  switch (options.format) {
    case 'csv':
      exportToCSV(data, columns, options);
      break;
    case 'xlsx':
      exportToExcel(data, columns, options);
      break;
    case 'pdf':
      exportToPDF(data, columns, options);
      break;
    default:
      logger.error(`Unsupported export format: ${options.format}`);
  }
}
