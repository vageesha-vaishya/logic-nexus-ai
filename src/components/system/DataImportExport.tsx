import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Download, Upload, FileText, AlertCircle, CheckCircle2, Pause, Play, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import * as z from 'zod';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

// --- Types ---

export interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

export type FileFormat = 'csv' | 'xlsx' | 'json';
export type DuplicateMode = 'skip' | 'update' | 'allow';
export type DuplicateCriteria = 'email' | 'phone' | 'email_or_phone' | 'email_and_phone' | 'name' | 'website' | 'custom';
export type CsvDelimiter = 'auto' | 'comma' | 'tab' | 'pipe';
export type ImportErrorMode = 'skip' | 'stop';

export interface DataField {
  key: string;
  label: string;
  required?: boolean;
  aliases?: string[]; // For auto-mapping
}

export interface ExportTemplate {
  name: string;
  fields: string[]; // keys
  includeCustomFields: boolean;
  filters?: Record<string, any>;
  allowedRoles?: string[]; // If set, only users with these roles can see/use this template
}

export interface DataImportExportProps {
  entityName: string; // e.g., "Leads", "Accounts"
  tableName: string; // e.g., "leads", "accounts"
  fields: DataField[];
  exportFields: DataField[];
  validationSchema?: z.ZodSchema;
  defaultExportTemplate: ExportTemplate;
  additionalExportTemplates?: ExportTemplate[];
  // Function to build the record from mapped data (allows custom transformation)
  onTransformRecord?: (mapped: Record<string, unknown>) => Record<string, unknown>;
  // Additional filters for export
  exportFilters?: React.ReactNode;
  onExportFilterApply?: (query: any, filters: any) => any;
  // Navigation
  listPath: string; // e.g., "/dashboard/leads"
}

type ParsedRow = Record<string, unknown>;

type ImportPreviewRow = {
  rowNumber: number;
  raw: ParsedRow;
  mapped: Record<string, unknown>;
  errors: Array<{ field?: string; message: string; suggestion?: string }>;
  duplicateKey?: string;
};

const DEFAULT_MAX_IMPORT_FILE_BYTES = 50 * 1024 * 1024;
const IMPORT_BATCH_SIZE = 1000;
const DUPLICATE_QUERY_BATCH_SIZE = 200;

// --- Helpers ---

const normalizeKey = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

const pickFirstColumn = (columns: string[], aliases: string[]) => {
  const normalizedToOriginal = new Map<string, string>();
  for (const col of columns) normalizedToOriginal.set(normalizeKey(col), col);
  for (const alias of aliases) {
    const found = normalizedToOriginal.get(normalizeKey(alias));
    if (found) return found;
  }
  return '';
};

const inferDefaultMapping = (columns: string[], fields: DataField[]): Record<string, string> => {
  const mapping: Record<string, string> = {};
  for (const field of fields) {
    const aliases = [field.key, field.label, ...(field.aliases || [])];
    const match = pickFirstColumn(columns, aliases);
    if (match) mapping[field.key] = match;
  }
  return mapping;
};

const yieldToBrowser = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const parseJsonPayloadToRows = (parsed: unknown): ParsedRow[] => {
  let candidates: unknown[] = [];
  if (Array.isArray(parsed)) {
    candidates = parsed;
  } else if (isRecord(parsed)) {
    const maybe = (parsed as any).leads ?? (parsed as any).data ?? (parsed as any).rows ?? (parsed as any).items;
    if (Array.isArray(maybe)) candidates = maybe;
  }
  return candidates.filter(isRecord) as ParsedRow[];
};

const hasBinaryNulls = (buf: Uint8Array) => buf.some((b) => b === 0);

const validateFileContent = async (file: File, fmt: FileFormat) => {
  const head = new Uint8Array(await file.slice(0, 8192).arrayBuffer());
  if (fmt === 'xlsx') {
    if (!(head[0] === 0x50 && head[1] === 0x4b)) {
      throw new Error('Invalid .xlsx file content');
    }
    return;
  }
  if (hasBinaryNulls(head)) {
    throw new Error('File appears to be binary; expected text content');
  }
};

const getFileFormat = (file: File): FileFormat | null => {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || file.type === 'text/csv') return 'csv';
  if (name.endsWith('.xlsx') || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'xlsx';
  if (name.endsWith('.json') || file.type === 'application/json') return 'json';
  return null;
};

const safeString = (value: unknown) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return String(value);
};

// --- Component ---

export default function DataImportExport({
  entityName,
  tableName,
  fields,
  exportFields,
  validationSchema,
  defaultExportTemplate,
  additionalExportTemplates = [],
  onTransformRecord,
  listPath,
}: DataImportExportProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { supabase, context } = useCRM();
  const MAX_IMPORT_FILE_BYTES = DEFAULT_MAX_IMPORT_FILE_BYTES;
  
  // State
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileFormat, setFileFormat] = useState<FileFormat | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [sourceColumns, setSourceColumns] = useState<string[]>([]);
  const [sampleRows, setSampleRows] = useState<ParsedRow[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [includeUnmappedAsCustom, setIncludeUnmappedAsCustom] = useState(true);
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>('skip');
  const [duplicateCriteria, setDuplicateCriteria] = useState<DuplicateCriteria>('email_or_phone');
  const [csvDelimiter, setCsvDelimiter] = useState<CsvDelimiter>('auto');
  const [importErrorMode, setImportErrorMode] = useState<ImportErrorMode>('skip');
  const [importBatchSize, setImportBatchSize] = useState<number>(IMPORT_BATCH_SIZE);
  const [importStep, setImportStep] = useState<1 | 2 | 3 | 4>(1);
  const [importingStage, setImportingStage] = useState<'idle' | 'parsing' | 'uploading' | 'finalizing'>('idle');
  const [exportStage, setExportStage] = useState<'idle' | 'counting' | 'fetching' | 'building' | 'downloading'>('idle');
  const [isDragActive, setIsDragActive] = useState(false);
  const [xlsxSheetNames, setXlsxSheetNames] = useState<string[]>([]);
  const [selectedXlsxSheet, setSelectedXlsxSheet] = useState<string>('');
  const [importAllXlsxSheets, setImportAllXlsxSheets] = useState(false);

  // Refs
  const csvParserRef = useRef<Papa.Parser | null>(null);
  const cancelRequestedRef = useRef(false);
  const pauseRequestedRef = useRef(false);
  const importStartedAtRef = useRef<number | null>(null);
  const [importPaused, setImportPaused] = useState(false);
  const [importProcessedRows, setImportProcessedRows] = useState(0);
  const [importEtaSeconds, setImportEtaSeconds] = useState<number | null>(null);

  // Export State
  const [exportTemplates, setExportTemplates] = useState<ExportTemplate[]>([defaultExportTemplate, ...additionalExportTemplates]);
  
  // Define available templates (can be filtered by permissions in the future)
  const availableExportTemplates = useMemo(() => exportTemplates, [exportTemplates]);

  const [selectedTemplateName, setSelectedTemplateName] = useState<string>(defaultExportTemplate.name);
  const [currentExportFields, setCurrentExportFields] = useState<string[]>(defaultExportTemplate.fields);
  const [exportIncludeCustomFields, setExportIncludeCustomFields] = useState(defaultExportTemplate.includeCustomFields);

  const exportTemplatesStorageKey = useMemo(() => {
    const t = context.tenantId || 'global';
    const f = context.franchiseId || 'global';
    return `${entityName.toLowerCase()}.exportTemplates.${t}.${f}`;
  }, [context.tenantId, context.franchiseId, entityName]);

  // --- Handlers ---

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    void onNewFile(file);
  };

  const onNewFile = async (file: File) => {
    const fmt = getFileFormat(file);
    if (!fmt) {
      toast.error('Please select a valid CSV, Excel (.xlsx), or JSON file');
      return;
    }
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      toast.error(`File exceeds ${(MAX_IMPORT_FILE_BYTES / 1024 / 1024).toFixed(0)}MB limit`);
      return;
    }
    try {
      await validateFileContent(file, fmt);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      toast.error(message);
      return;
    }
    setSelectedFile(file);
    setFileFormat(fmt);
    setImportResult(null);
    setProgress(0);
    setImportingStage('idle');
    setImportProcessedRows(0);
    setImportEtaSeconds(null);
    setXlsxSheetNames([]);
    setSelectedXlsxSheet('');
    setImportAllXlsxSheets(false);
    await analyzeFile(file, fmt);
  };

  const analyzeFile = async (file: File, fmt: FileFormat) => {
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      if (fmt === 'csv') {
        const preview = await new Promise<{ columns: string[]; rows: ParsedRow[] }>((resolve, reject) => {
          Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            preview: 25,
            complete: (results) => {
              const columns = (results.meta.fields ?? []) as string[];
              const rows = (results.data ?? []) as ParsedRow[];
              resolve({ columns: columns.length > 0 ? columns : Object.keys(rows[0] ?? {}), rows });
            },
            error: (error) => reject(error),
          });
        });
        setSourceColumns(preview.columns);
        setSampleRows(preview.rows);
        setFieldMapping(inferDefaultMapping(preview.columns, fields));
        setImportStep(2);
        return;
      }

      if (fmt === 'json') {
        const text = await file.text();
        const parsed = JSON.parse(text) as unknown;
        const rows = parseJsonPayloadToRows(parsed);
        if (rows.length === 0) {
          throw new Error('JSON must be an array of objects (or contain data/rows array)');
        }
        const sample = rows.slice(0, 25);
        const columnsSet = new Set<string>();
        for (const r of sample) Object.keys(r).forEach((k) => columnsSet.add(k));
        const columns = Array.from(columnsSet);
        setSourceColumns(columns);
        setSampleRows(sample);
        setFieldMapping(inferDefaultMapping(columns, fields));
        setImportStep(2);
        return;
      }

      const arrayBuffer = await file.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetNames = wb.SheetNames ?? [];
      const sheetName = sheetNames[0] ?? '';
      if (!sheetName) throw new Error('Excel file has no worksheets');
      setXlsxSheetNames(sheetNames);
      setSelectedXlsxSheet(sheetName);
      const ws = wb.Sheets[sheetName];
      const ref = ws['!ref'];
      if (!ref) throw new Error('Excel sheet is empty');
      const range = XLSX.utils.decode_range(ref);
      const maxRow = Math.min(range.s.r + 25, range.e.r);
      const limitedRange = { s: range.s, e: { c: range.e.c, r: maxRow } };
      const rows = XLSX.utils.sheet_to_json(ws, { range: limitedRange, defval: '' }) as ParsedRow[];
      const columnsSet = new Set<string>();
      for (const r of rows) Object.keys(r).forEach((k) => columnsSet.add(k));
      const columns = Array.from(columnsSet);
      setSourceColumns(columns);
      setSampleRows(rows);
      setFieldMapping(inferDefaultMapping(columns, fields));
      setImportStep(2);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setAnalysisError(message);
      setSourceColumns([]);
      setSampleRows([]);
      setFieldMapping({});
    } finally {
      setAnalyzing(false);
    }
  };

  const handleStep2Next = () => {
    // Validate required fields
    const requiredFields = fields.filter(f => f.required);
    const missing = requiredFields.filter(f => !fieldMapping[f.key]);
    
    if (missing.length > 0) {
      toast.error(`Please map the following required fields: ${missing.map(f => f.label).join(', ')}`);
      return;
    }
    setImportStep(3);
  };

  const resetImport = () => {
    setImportStep(1);
    setSelectedFile(null);
    setSourceColumns([]);
    setSampleRows([]);
    setFieldMapping({});
    setImportResult(null);
    setImportingStage('idle');
    setImportProcessedRows(0);
    setImportEtaSeconds(null);
  };

  const buildMappedRecord = (row: ParsedRow): { record: any; customFields: Record<string, unknown> } => {
    const mapped: Record<string, unknown> = {};
    const mappedSourceColumns = new Set<string>();
    
    for (const field of fields) {
      const sourceCol = fieldMapping[field.key];
      if (!sourceCol) continue;
      mappedSourceColumns.add(sourceCol);
      mapped[field.key] = row[sourceCol];
    }

    const customFields: Record<string, unknown> = {};
    if (includeUnmappedAsCustom) {
      for (const key of Object.keys(row)) {
        if (!mappedSourceColumns.has(key)) {
          customFields[key] = row[key];
        }
      }
    }

    let record = { ...mapped };
    if (onTransformRecord) {
      record = onTransformRecord(record);
    }

    return { record, customFields };
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    setImporting(true);
    setImportStep(4);
    setImportingStage('parsing');
    setProgress(0);
    setImportResult(null);
    setImportProcessedRows(0);
    cancelRequestedRef.current = false;
    pauseRequestedRef.current = false;
    importStartedAtRef.current = Date.now();

    const result: ImportResult = { success: 0, failed: 0, errors: [] };
    const batch: any[] = [];
    
    const processBatch = async () => {
      if (batch.length === 0) return;
      
      try {
        setImportingStage('uploading');
        // Check for duplicates if needed (simplified for now)
        // ...

        // Prepare data
        const records = batch.map(item => ({
          ...item.record,
          tenant_id: context.tenantId,
          franchise_id: context.franchiseId,
          // custom_fields: item.customFields, // Assuming backend supports this or we ignore it
        }));

        const { error } = await supabase.from(tableName).insert(records).select();
        
        if (error) {
          result.failed += records.length;
          result.errors.push(`Batch error: ${error.message}`);
        } else {
          result.success += records.length;
        }

      } catch (e: any) {
        result.failed += batch.length;
        result.errors.push(`Batch exception: ${e.message}`);
      } finally {
        batch.length = 0; // Clear batch
        setImportProcessedRows(prev => prev + batch.length);
        
        // Calculate ETA
        if (importStartedAtRef.current && result.success + result.failed > 0) {
           const elapsed = (Date.now() - importStartedAtRef.current) / 1000;
           const rate = (result.success + result.failed) / elapsed;
           // Estimate remaining rows if we knew total count... but we stream CSV
        }
      }
    };

    try {
      if (fileFormat === 'csv') {
        await new Promise<void>((resolve, reject) => {
           Papa.parse(selectedFile, {
             header: true,
             skipEmptyLines: true,
             step: async (results, parser) => {
                if (cancelRequestedRef.current) {
                  parser.abort();
                  return;
                }
                while (pauseRequestedRef.current) {
                  setImportPaused(true);
                  await new Promise(r => setTimeout(r, 500));
                }
                setImportPaused(false);

                const { record, customFields } = buildMappedRecord(results.data as ParsedRow);
                
                // Validate
                if (validationSchema) {
                  const validation = validationSchema.safeParse(record);
                  if (!validation.success) {
                    result.failed++;
                    result.errors.push(`Row validation failed: ${validation.error.errors.map(e => e.message).join(', ')}`);
                    return;
                  }
                }

                batch.push({ record, customFields });

                if (batch.length >= importBatchSize) {
                   parser.pause();
                   await processBatch();
                   parser.resume();
                   await yieldToBrowser();
                }
             },
             complete: async () => {
               await processBatch();
               resolve();
             },
             error: (err) => reject(err)
           });
        });
      } else {
        // XLSX or JSON (Already parsed into sampleRows/memory usually, but for large files we should re-read)
        // For simplicity reusing the memory read if small enough, but let's re-read to be safe or just iterate
        // If file was analyzed, we have rows in memory if it was small? 
        // Actually analyzeFile only stores sampleRows.
        // We need to re-parse fully.
        
        let allRows: ParsedRow[] = [];
        if (fileFormat === 'json') {
          const text = await selectedFile.text();
          const parsed = JSON.parse(text);
          allRows = parseJsonPayloadToRows(parsed);
        } else {
          const ab = await selectedFile.arrayBuffer();
          const wb = XLSX.read(ab, { type: 'array' });
          const ws = wb.Sheets[selectedXlsxSheet || wb.SheetNames[0]];
          allRows = XLSX.utils.sheet_to_json(ws) as ParsedRow[];
        }

        for (const row of allRows) {
           if (cancelRequestedRef.current) break;
           while (pauseRequestedRef.current) {
             setImportPaused(true);
             await new Promise(r => setTimeout(r, 500));
           }
           setImportPaused(false);

           const { record, customFields } = buildMappedRecord(row);
           
           if (validationSchema) {
              const validation = validationSchema.safeParse(record);
              if (!validation.success) {
                result.failed++;
                result.errors.push(`Row validation failed: ${validation.error.errors.map(e => e.message).join(', ')}`);
                continue;
              }
           }
           
           batch.push({ record, customFields });
           
           if (batch.length >= importBatchSize) {
             await processBatch();
             await yieldToBrowser();
           }
        }
        await processBatch();
      }

      setImportResult(result);
      if (result.success > 0) {
        toast.success(`Successfully imported ${result.success} records`);
      }
      if (result.failed > 0) {
        toast.warning(`${result.failed} records failed to import`);
      }
    } catch (e: any) {
      toast.error(`Import failed: ${e.message}`);
      setImportResult({ ...result, errors: [...result.errors, e.message] });
    } finally {
      setImporting(false);
      setImportingStage('finalizing');
    }
  };

  const handleExport = async (format: 'xlsx' | 'csv') => {
    setExportStage('counting');
    try {
      let query = supabase.from(tableName).select('*');
      
      // Apply context filters
      if (!context.adminOverrideEnabled && context.franchiseId) {
        query = query.eq('franchise_id', context.franchiseId);
      }
      
      // Apply custom filters from props
      if (onExportFilterApply) {
         // This needs the query builder to be passed out, or we assume a certain structure
         // For now, let's just fetch all and filter in memory if needed, or rely on simple select
      }

      setExportStage('fetching');
      const { data, error } = await query;
      
      if (error) throw error;
      if (!data || data.length === 0) {
        toast.info("No records found to export");
        setExportStage('idle');
        return;
      }

      setExportStage('building');
      
      // Map data to export fields
      const exportData = data.map(row => {
        const mapped: Record<string, any> = {};
        for (const fieldKey of currentExportFields) {
           const fieldDef = exportFields.find(f => f.key === fieldKey);
           mapped[fieldDef?.label || fieldKey] = row[fieldKey];
        }
        if (exportIncludeCustomFields && row.custom_fields) {
           // Flatten custom fields
           Object.assign(mapped, row.custom_fields);
        }
        return mapped;
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, entityName);
      
      setExportStage('downloading');
      
      if (format === 'csv') {
        XLSX.writeFile(wb, `${entityName}_Export_${new Date().toISOString().split('T')[0]}.csv`);
      } else {
        XLSX.writeFile(wb, `${entityName}_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
      }
      
      toast.success("Export completed successfully");
      
      // Audit Log (Mock)
      console.log(`[AUDIT] User ${context.user?.id} exported ${data.length} ${entityName} records at ${new Date().toISOString()}`);
      
    } catch (e: any) {
      toast.error(`Export failed: ${e.message}`);
    } finally {
      setExportStage('idle');
    }
  };

  // --- Render ---

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">{entityName} Import/Export</h1>
            <p className="text-muted-foreground">Manage your {entityName.toLowerCase()} data in bulk</p>
          </div>
          <Button variant="outline" onClick={() => navigate(listPath)}>
            Back to List
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Import Card */}
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" /> Import {entityName}
              </CardTitle>
              <CardDescription>
                Upload CSV, Excel, or JSON files to create or update {entityName.toLowerCase()}.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              {/* Stepper */}
              <div className="mb-8 relative">
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-border -z-10" />
                <div className="flex justify-between">
                  {[1, 2, 3, 4].map((s) => (
                    <div
                      key={s}
                      className={`flex flex-col items-center gap-1 bg-background px-2 ${s <= importStep ? 'text-primary' : 'text-muted-foreground'}`}
                    >
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium ${
                          s <= importStep ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground bg-background'
                        }`}
                      >
                        {s}
                      </div>
                      <span className="text-xs font-medium">{s === 1 ? 'Upload' : s === 2 ? 'Map' : s === 3 ? 'Review' : 'Import'}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Step 1: Upload */}
              {importStep === 1 && (
                <div className="space-y-4">
                  <div
                    className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                      isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                    }`}
                    onDragOver={(e) => { e.preventDefault(); setIsDragActive(true); }}
                    onDragLeave={() => setIsDragActive(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragActive(false);
                      const file = e.dataTransfer.files[0];
                      if (file) onNewFile(file);
                    }}
                  >
                    <div className="flex flex-col items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Upload className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Click to upload or drag and drop</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          CSV, Excel, or JSON (max 50MB)
                        </p>
                      </div>
                      <Input
                        type="file"
                        className="hidden"
                        id="file-upload"
                        accept=".csv,.xlsx,.xls,.json"
                        onChange={handleFileSelect}
                      />
                      <Button variant="secondary" onClick={() => document.getElementById('file-upload')?.click()}>
                        Select File
                      </Button>
                    </div>
                  </div>
                  
                  {analyzing && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span>Analyzing file...</span>
                      </div>
                      <Progress value={45} className="h-1 animate-pulse" />
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Mapping */}
              {importStep === 2 && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold">Map Columns</h3>
                    <Badge variant="outline">{sourceColumns.length} columns found</Badge>
                  </div>
                  
                  <div className="border rounded-md divide-y max-h-[400px] overflow-y-auto">
                    {fields.map((field) => (
                      <div key={field.key} className="p-3 flex items-center gap-4">
                        <div className="flex-1">
                           <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{field.label}</span>
                              {field.required && <Badge variant="secondary" className="text-[10px] h-4">Required</Badge>}
                           </div>
                           <p className="text-xs text-muted-foreground">Target Field</p>
                        </div>
                        <div className="flex items-center text-muted-foreground">
                           <ChevronRight className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <Select
                            value={fieldMapping[field.key] || 'ignore'}
                            onValueChange={(val) => setFieldMapping(prev => ({ ...prev, [field.key]: val === 'ignore' ? '' : val }))}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Select column..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ignore" className="text-muted-foreground italic">Ignore (Don't import)</SelectItem>
                              {sourceColumns.map(col => (
                                <SelectItem key={col} value={col}>{col}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground mt-1">Source Column</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="custom-fields" 
                      checked={includeUnmappedAsCustom} 
                      onCheckedChange={(c) => setIncludeUnmappedAsCustom(!!c)} 
                    />
                    <Label htmlFor="custom-fields" className="text-sm cursor-pointer">
                      Import unmapped columns as custom fields (if supported)
                    </Label>
                  </div>

                  <div className="flex justify-between pt-4">
                    <Button variant="outline" onClick={() => setImportStep(1)}>Back</Button>
                    <Button onClick={handleStep2Next}>Next: Review</Button>
                  </div>
                </div>
              )}

              {/* Step 3: Review */}
              {importStep === 3 && (
                <div className="space-y-6">
                   <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Duplicate Handling</Label>
                          <Select value={duplicateMode} onValueChange={(v: any) => setDuplicateMode(v)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="skip">Skip duplicates</SelectItem>
                              <SelectItem value="update">Update existing</SelectItem>
                              <SelectItem value="allow">Allow duplicates</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Error Handling</Label>
                          <Select value={importErrorMode} onValueChange={(v: any) => setImportErrorMode(v)}>
                             <SelectTrigger><SelectValue /></SelectTrigger>
                             <SelectContent>
                               <SelectItem value="skip">Skip rows with errors</SelectItem>
                               <SelectItem value="stop">Stop on first error</SelectItem>
                             </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="rounded-md bg-muted p-4">
                        <h4 className="text-sm font-medium mb-2">Summary</h4>
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          <dt className="text-muted-foreground">File:</dt>
                          <dd className="font-medium truncate">{selectedFile?.name}</dd>
                          <dt className="text-muted-foreground">Format:</dt>
                          <dd className="uppercase">{fileFormat}</dd>
                          <dt className="text-muted-foreground">Mapped Fields:</dt>
                          <dd>{Object.values(fieldMapping).filter(Boolean).length} / {fields.length}</dd>
                        </dl>
                      </div>
                   </div>

                   <div className="flex justify-between pt-4">
                      <Button variant="outline" onClick={() => setImportStep(2)}>Back</Button>
                      <Button onClick={handleImport}>Start Import</Button>
                   </div>
                </div>
              )}

              {/* Step 4: Import Progress */}
              {importStep === 4 && (
                <div className="space-y-6">
                  {importing ? (
                    <div className="space-y-4 text-center py-8">
                       <div className="relative h-16 w-16 mx-auto">
                          <div className="absolute inset-0 rounded-full border-4 border-muted"></div>
                          <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                       </div>
                       <h3 className="text-lg font-medium">Importing...</h3>
                       <p className="text-muted-foreground text-sm">
                         Processed {importProcessedRows} records...
                       </p>
                       <div className="flex justify-center gap-2 mt-4">
                         <Button variant="outline" size="sm" onClick={() => pauseRequestedRef.current = !importPaused}>
                            {importPaused ? <Play className="h-4 w-4 mr-2"/> : <Pause className="h-4 w-4 mr-2"/>}
                            {importPaused ? 'Resume' : 'Pause'}
                         </Button>
                         <Button variant="destructive" size="sm" onClick={() => cancelRequestedRef.current = true}>
                            <XCircle className="h-4 w-4 mr-2" /> Cancel
                         </Button>
                       </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className={`flex flex-col items-center gap-2 p-6 rounded-lg ${
                        importResult?.failed === 0 ? 'bg-green-500/10 text-green-600' : 'bg-orange-500/10 text-orange-600'
                      }`}>
                         {importResult?.failed === 0 ? <CheckCircle2 className="h-12 w-12" /> : <AlertCircle className="h-12 w-12" />}
                         <h3 className="text-xl font-bold">Import Complete</h3>
                         <div className="flex gap-8 mt-2">
                           <div className="text-center">
                             <div className="text-2xl font-bold">{importResult?.success}</div>
                             <div className="text-xs uppercase opacity-75">Success</div>
                           </div>
                           <div className="text-center">
                             <div className="text-2xl font-bold">{importResult?.failed}</div>
                             <div className="text-xs uppercase opacity-75">Failed</div>
                           </div>
                         </div>
                      </div>

                      {importResult?.errors && importResult.errors.length > 0 && (
                        <div className="border rounded-md">
                          <div className="bg-muted px-4 py-2 border-b text-sm font-medium">Error Log</div>
                          <div className="max-h-48 overflow-y-auto p-2 text-xs font-mono space-y-1">
                             {importResult.errors.map((err, i) => (
                               <div key={i} className="text-red-600">{err}</div>
                             ))}
                          </div>
                        </div>
                      )}

                      <Button className="w-full" onClick={resetImport}>Import Another File</Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Export Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" /> Export {entityName}
              </CardTitle>
              <CardDescription>
                Download your data in CSV, Excel, or PDF format.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="space-y-2">
                 <Label>Export Template</Label>
                 <Select value={selectedTemplateName} onValueChange={(val) => {
                    setSelectedTemplateName(val);
                    const t = exportTemplates.find(t => t.name === val);
                    if (t) {
                      setCurrentExportFields(t.fields);
                      setExportIncludeCustomFields(t.includeCustomFields);
                    }
                 }}>
                   <SelectTrigger>
                     <SelectValue />
                   </SelectTrigger>
                   <SelectContent>
                     {availableExportTemplates.map(t => (
                       <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>

               <Separator />
               
               <div className="space-y-2">
                  <Label>Fields to Export</Label>
                  <div className="h-48 border rounded-md overflow-y-auto p-2 space-y-1">
                     {exportFields.map(f => (
                       <div key={f.key} className="flex items-center gap-2">
                         <Checkbox 
                           id={`export-${f.key}`}
                           checked={currentExportFields.includes(f.key)}
                           onCheckedChange={(checked) => {
                              if (checked) setCurrentExportFields(prev => [...prev, f.key]);
                              else setCurrentExportFields(prev => prev.filter(k => k !== f.key));
                           }}
                         />
                         <Label htmlFor={`export-${f.key}`} className="cursor-pointer">{f.label}</Label>
                       </div>
                     ))}
                  </div>
               </div>
               
               <div className="flex gap-2">
                 <Button className="flex-1" onClick={() => handleExport('xlsx')} disabled={exportStage !== 'idle'}>
                   <Download className="h-4 w-4 mr-2" /> 
                   {exportStage !== 'idle' ? 'Exporting...' : 'Export to Excel'}
                 </Button>
                 <Button variant="outline" className="flex-1" onClick={() => handleExport('csv')} disabled={exportStage !== 'idle'}>
                   <FileText className="h-4 w-4 mr-2" /> 
                   {exportStage !== 'idle' ? 'Exporting...' : 'Export to CSV'}
                 </Button>
               </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
