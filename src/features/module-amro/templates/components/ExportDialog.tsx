/**
 * Export Dialog Component
 * 
 * Features:
 * - Format selection (CSV, Excel, PDF)
 * - Column selection
 * - File name customization
 * - Include headers option
 * - Export progress indicator
 * - Download handling
 */

import { useState, useCallback, useMemo } from 'react';
import { Download, FileSpreadsheet, FileText, Table, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getExportColumns, exportTemplates, ExportFormat } from '../services/exportService';
import { WorkPackageTemplate } from '../AmroWorkPackageTemplatesPage';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: WorkPackageTemplate[];
  selectedIds?: Set<string>;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const EXPORT_FORMATS: Array<{
  value: ExportFormat;
  label: string;
  description: string;
  icon: any;
}> = [
  {
    value: 'csv',
    label: 'CSV',
    description: 'Comma-separated values, compatible with Excel',
    icon: Table,
  },
  {
    value: 'xlsx',
    label: 'Excel',
    description: 'Microsoft Excel format (.xlsx)',
    icon: FileSpreadsheet,
  },
  {
    value: 'pdf',
    label: 'PDF',
    description: 'Portable Document Format, ready to print',
    icon: FileText,
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function ExportDialog({
  open,
  onOpenChange,
  templates,
  selectedIds = new Set(),
}: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    new Set(getExportColumns().map(col => col.id))
  );
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const [fileName, setFileName] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{
    success: boolean;
    fileName: string;
    rowCount: number;
    error?: string;
  } | null>(null);

  // Available columns
  const availableColumns = useMemo(() => getExportColumns(), []);

  // Export count
  const exportCount = selectedIds.size > 0 ? selectedIds.size : templates.length;

  // Handle column toggle
  const handleColumnToggle = useCallback((columnId: string) => {
    setSelectedColumns(prev => {
      const next = new Set(prev);
      if (next.has(columnId)) {
        next.delete(columnId);
      } else {
        next.add(columnId);
      }
      return next;
    });
  }, []);

  // Handle select all columns
  const handleSelectAllColumns = useCallback(() => {
    if (selectedColumns.size === availableColumns.length) {
      setSelectedColumns(new Set());
    } else {
      setSelectedColumns(new Set(availableColumns.map(col => col.id)));
    }
  }, [selectedColumns.size, availableColumns]);

  // Handle export
  const handleExport = useCallback(async () => {
    if (selectedColumns.size === 0) {
      return;
    }

    setIsExporting(true);
    setExportResult(null);

    try {
      // Filter templates if selection exists
      const templatesToExport = selectedIds.size > 0
        ? templates.filter(t => selectedIds.has(t.id))
        : templates;

      const result = await exportTemplates({
        format,
        templates: templatesToExport,
        columns: Array.from(selectedColumns),
        includeHeaders,
        fileName: fileName || undefined,
      });

      setExportResult(result);

      // Close dialog after successful export
      if (result.success) {
        setTimeout(() => {
          handleClose();
        }, 2000);
      }
    } catch (error: any) {
      setExportResult({
        success: false,
        fileName: '',
        rowCount: 0,
        error: error.message || 'Export failed',
      });
    } finally {
      setIsExporting(false);
    }
  }, [format, selectedColumns, includeHeaders, fileName, templates, selectedIds]);

  // Handle close
  const handleClose = useCallback(() => {
    setFormat('csv');
    setSelectedColumns(new Set(availableColumns.map(col => col.id)));
    setIncludeHeaders(true);
    setFileName('');
    setExportResult(null);
    onOpenChange(false);
  }, [onOpenChange, availableColumns]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Export Templates
          </DialogTitle>
          <DialogDescription>
            Export {exportCount} template{exportCount !== 1 ? 's' : ''} to your preferred format.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Format selection */}
          <div className="space-y-3">
            <Label>Export Format</Label>
            <div className="grid grid-cols-3 gap-3">
              {EXPORT_FORMATS.map((fmt) => {
                const Icon = fmt.icon;
                const isSelected = format === fmt.value;
                
                return (
                  <button
                    key={fmt.value}
                    onClick={() => setFormat(fmt.value)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground/50'
                    }`}
                    disabled={isExporting}
                  >
                    <Icon className={`w-6 h-6 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className="text-sm font-medium">{fmt.label}</span>
                    <span className="text-xs text-muted-foreground text-center">
                      {fmt.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Column selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Columns to Export</Label>
              <button
                onClick={handleSelectAllColumns}
                className="text-xs text-primary hover:underline"
                disabled={isExporting}
              >
                {selectedColumns.size === availableColumns.length
                  ? 'Deselect All'
                  : 'Select All'}
              </button>
            </div>
            
            <ScrollArea className="h-[150px] rounded-md border p-3">
              <div className="space-y-2">
                {availableColumns.map((column) => (
                  <div
                    key={column.id}
                    className="flex items-center gap-2"
                  >
                    <Checkbox
                      id={`column-${column.id}`}
                      checked={selectedColumns.has(column.id)}
                      onCheckedChange={() => handleColumnToggle(column.id)}
                      disabled={isExporting}
                    />
                    <Label
                      htmlFor={`column-${column.id}`}
                      className="text-sm font-normal cursor-pointer flex-1"
                    >
                      {column.label}
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <p className="text-xs text-muted-foreground">
              {selectedColumns.size} of {availableColumns.length} columns selected
            </p>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <Label>Options</Label>
            
            {/* Include headers */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="include-headers"
                checked={includeHeaders}
                onCheckedChange={(checked) => setIncludeHeaders(!!checked)}
                disabled={isExporting}
              />
              <Label htmlFor="include-headers" className="text-sm font-normal cursor-pointer">
                Include column headers
              </Label>
            </div>

            {/* File name */}
            <div className="space-y-2">
              <Label htmlFor="file-name" className="text-sm">
                File name (optional)
              </Label>
              <Input
                id="file-name"
                placeholder={`work_package_templates_${new Date().toISOString().split('T')[0]}`}
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                disabled={isExporting}
              />
            </div>
          </div>

          {/* Export result */}
          {exportResult && (
            <div
              className={`p-3 rounded-md ${
                exportResult.success
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-destructive/10 text-destructive border border-destructive/20'
              }`}
            >
              {exportResult.success ? (
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  <span className="text-sm">
                    Successfully exported {exportResult.rowCount} templates to {exportResult.fileName}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <X className="w-4 h-4" />
                  <span className="text-sm">{exportResult.error}</span>
                </div>
              )}
            </div>
          )}

          {/* Warning for PDF */}
          {format === 'pdf' && templates.length > 500 && (
            <div className="p-3 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
              <p className="text-sm">
                ⚠️ Exporting {templates.length} templates to PDF may take a while.
                Consider using CSV or Excel for large datasets.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || selectedColumns.size === 0}
            className="gap-2"
          >
            {isExporting ? (
              <>
                <span className="animate-spin">⏳</span>
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Export {exportCount} Templates
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
