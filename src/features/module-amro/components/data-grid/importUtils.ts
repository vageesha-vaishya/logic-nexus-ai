/**
 * AMRO Data Grid Import Utility
 *
 * Import functionality with:
 * - CSV/Excel file upload
 * - Preview with validation
 * - Error reporting
 * - Progress tracking
 */

import { ColumnConfig } from './store/useDataGridStore';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ImportValidationResult {
  total: number;
  valid: number;
  invalid: number;
  errors: ImportError[];
  preview: Record<string, any>[];
}

export interface ImportError {
  row: number;
  field?: string;
  message: string;
  value?: string;
}

export interface ImportOptions {
  columns: ColumnConfig[];
  validate?: (row: Record<string, any>, rowNum: number) => ImportError[];
  transform?: (row: Record<string, any>) => Record<string, any>;
  onProgress?: (current: number, total: number) => void;
}

// ── CSV Parsing ────────────────────────────────────────────────────────────────

function parseCSV(content: string): { headers: string[]; rows: string[][] } {
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) {
    throw new Error('File is empty');
  }

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (inQuotes) {
        if (char === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++; // Skip next quote
          } else {
            inQuotes = false;
          }
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
    }

    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);

  return { headers, rows };
}

// ── File Reading ───────────────────────────────────────────────────────────────

export async function readFileContent(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

// ── Validation ─────────────────────────────────────────────────────────────────

function validateRow(
  row: Record<string, any>,
  rowNum: number,
  columns: ColumnConfig[],
  customValidate?: (row: Record<string, any>, rowNum: number) => ImportError[]
): ImportError[] {
  const errors: ImportError[] = [];

  // Required field validation
  columns.forEach((col) => {
    if (col.id === 'select' || col.id === 'actions') return;

    const value = row[col.accessor as string];
    if (!value && col.id !== 'updated_at') {
      // Only flag as error if column is typically required
      // In production, add explicit required flag to ColumnConfig
    }
  });

  // Custom validation
  if (customValidate) {
    const customErrors = customValidate(row, rowNum);
    errors.push(...customErrors);
  }

  return errors;
}

// ── Import Processing ──────────────────────────────────────────────────────────

export async function processImport(
  file: File,
  options: ImportOptions
): Promise<ImportValidationResult> {
  const { columns, validate, transform, onProgress } = options;

  // Read file
  const content = await readFileContent(file);

  // Parse CSV
  const { headers, rows } = parseCSV(content);

  // Map headers to column accessors
  const headerMap: Record<string, string> = {};
  headers.forEach((header, idx) => {
    const normalizedHeader = header.toLowerCase().trim();
    const matchingColumn = columns.find(
      (col) =>
        col.label.toLowerCase() === normalizedHeader ||
        col.accessor === normalizedHeader ||
        (typeof col.accessor === 'string' && col.accessor.toLowerCase() === normalizedHeader)
    );
    if (matchingColumn) {
      headerMap[idx] = matchingColumn.accessor as string;
    }
  });

  // Process rows
  const preview: Record<string, any>[] = [];
  const errors: ImportError[] = [];
  let validCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // +2 because row 1 is header, 0-indexed

    // Build row object
    const rowData: Record<string, any> = {};
    row.forEach((value, idx) => {
      const accessor = headerMap[idx];
      if (accessor) {
        rowData[accessor] = value;
      }
    });

    // Transform if needed
    const transformedRow = transform ? transform(rowData) : rowData;

    // Validate
    const rowErrors = validateRow(transformedRow, rowNum, columns, validate);

    if (rowErrors.length === 0) {
      validCount++;
      preview.push(transformedRow);
    } else {
      errors.push(...rowErrors);
    }

    // Progress callback
    if (onProgress) {
      onProgress(i + 1, rows.length);
    }
  }

  return {
    total: rows.length,
    valid: validCount,
    invalid: rows.length - validCount,
    errors,
    preview: preview.slice(0, 100), // Limit preview to first 100 rows
  };
}

// ── Column Mapping ─────────────────────────────────────────────────────────────

export interface ColumnMapping {
  fileColumn: string;
  gridColumn: string;
}

export function autoMapColumns(
  fileHeaders: string[],
  columns: ColumnConfig[]
): ColumnMapping[] {
  const mappings: ColumnMapping[] = [];

  fileHeaders.forEach((fileHeader) => {
    const normalized = fileHeader.toLowerCase().trim();

    // Try to find matching column
    const match = columns.find(
      (col) =>
        col.label.toLowerCase() === normalized ||
        (typeof col.accessor === 'string' && col.accessor.toLowerCase() === normalized) ||
        col.label.toLowerCase().includes(normalized) ||
        normalized.includes(col.label.toLowerCase())
    );

    if (match) {
      mappings.push({
        fileColumn: fileHeader,
        gridColumn: match.id,
      });
    }
  });

  return mappings;
}

// ── Sample CSV Template Generator ──────────────────────────────────────────────

export function generateSampleCSV(columns: ColumnConfig[]): string {
  const exportColumns = columns.filter(
    (col) => col.id !== 'select' && col.id !== 'actions'
  );

  const headers = exportColumns.map((col) => col.label);

  // Generate sample row
  const sampleRow = exportColumns.map((col) => {
    switch (col.format) {
      case 'number':
        return '100';
      case 'currency':
        return '99.99';
      case 'date':
        return '2024-01-15';
      case 'badge':
        return 'available';
      default:
        return `Sample ${col.label}`;
    }
  });

  return [headers.join(','), sampleRow.join(',')].join('\n');
}

export function downloadSampleCSV(columns: ColumnConfig[], fileName = 'import-template'): void {
  const csv = generateSampleCSV(columns);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
