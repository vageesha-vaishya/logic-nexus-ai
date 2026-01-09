import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Download, Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
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

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

type FileFormat = 'csv' | 'xlsx' | 'json';
type DuplicateMode = 'skip' | 'update' | 'allow';

type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';
type LeadSource = 'website' | 'referral' | 'email' | 'phone' | 'social' | 'event' | 'other';

type LeadField =
  | 'first_name'
  | 'last_name'
  | 'email'
  | 'phone'
  | 'company'
  | 'title'
  | 'status'
  | 'source'
  | 'estimated_value'
  | 'expected_close_date'
  | 'description'
  | 'notes'
  | 'lead_score'
  | 'qualification_status';

type ExportField =
  | 'id'
  | 'first_name'
  | 'last_name'
  | 'email'
  | 'phone'
  | 'company'
  | 'title'
  | 'status'
  | 'source'
  | 'estimated_value'
  | 'expected_close_date'
  | 'description'
  | 'notes'
  | 'lead_score'
  | 'qualification_status'
  | 'owner_id'
  | 'created_at'
  | 'updated_at'
  | 'last_activity_date'
  | 'converted_at'
  | 'tenant_id'
  | 'franchise_id';

type ExportTemplate = {
  name: string;
  fields: ExportField[];
  includeCustomFields: boolean;
  filters?: {
    status?: LeadStatus | 'any';
    source?: LeadSource | 'any';
    createdFrom?: string;
    createdTo?: string;
  };
};

type ParsedRow = Record<string, unknown>;

type ImportPreviewRow = {
  rowNumber: number;
  raw: ParsedRow;
  mapped: Record<string, unknown>;
  errors: Array<{ field?: string; message: string; suggestion?: string }>;
  duplicateKey?: string;
};

const MAX_IMPORT_FILE_BYTES = 100 * 1024 * 1024;
const IMPORT_BATCH_SIZE = 500;
const DUPLICATE_QUERY_BATCH_SIZE = 200;

const LEAD_STATUSES: LeadStatus[] = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
const LEAD_SOURCES: LeadSource[] = ['website', 'referral', 'email', 'phone', 'social', 'event', 'other'];

const LEAD_FIELD_LABELS: Record<LeadField, string> = {
  first_name: 'First Name',
  last_name: 'Last Name',
  email: 'Email',
  phone: 'Phone',
  company: 'Company',
  title: 'Title',
  status: 'Status',
  source: 'Source',
  estimated_value: 'Estimated Value',
  expected_close_date: 'Expected Close Date',
  description: 'Description',
  notes: 'Notes',
  lead_score: 'Lead Score',
  qualification_status: 'Qualification Status',
};

const EXPORT_FIELD_LABELS: Record<ExportField, string> = {
  id: 'ID',
  first_name: 'First Name',
  last_name: 'Last Name',
  email: 'Email',
  phone: 'Phone',
  company: 'Company',
  title: 'Title',
  status: 'Status',
  source: 'Source',
  estimated_value: 'Estimated Value',
  expected_close_date: 'Expected Close Date',
  description: 'Description',
  notes: 'Notes',
  lead_score: 'Lead Score',
  qualification_status: 'Qualification Status',
  owner_id: 'Owner ID',
  created_at: 'Created At',
  updated_at: 'Updated At',
  last_activity_date: 'Last Activity Date',
  converted_at: 'Converted At',
  tenant_id: 'Tenant ID',
  franchise_id: 'Franchise ID',
};

const DEFAULT_EXPORT_TEMPLATE: ExportTemplate = {
  name: 'Standard',
  includeCustomFields: true,
  fields: [
    'first_name',
    'last_name',
    'email',
    'phone',
    'company',
    'title',
    'status',
    'source',
    'estimated_value',
    'expected_close_date',
    'lead_score',
    'qualification_status',
    'created_at',
    'updated_at',
  ],
  filters: {
    status: 'any',
    source: 'any',
  },
};

const FULL_EXPORT_TEMPLATE: ExportTemplate = {
  name: 'Full',
  includeCustomFields: true,
  fields: [
    'id',
    'first_name',
    'last_name',
    'email',
    'phone',
    'company',
    'title',
    'status',
    'source',
    'estimated_value',
    'expected_close_date',
    'description',
    'notes',
    'lead_score',
    'qualification_status',
    'owner_id',
    'created_at',
    'updated_at',
    'last_activity_date',
    'converted_at',
    'tenant_id',
    'franchise_id',
  ],
  filters: {
    status: 'any',
    source: 'any',
  },
};

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

const inferDefaultMapping = (columns: string[]): Record<LeadField, string> => ({
  first_name: pickFirstColumn(columns, ['first_name', 'firstName', 'first name', 'firstname', 'given_name', 'given name']),
  last_name: pickFirstColumn(columns, ['last_name', 'lastName', 'last name', 'lastname', 'surname', 'family_name', 'family name']),
  email: pickFirstColumn(columns, ['email', 'email_address', 'email address', 'e-mail']),
  phone: pickFirstColumn(columns, ['phone', 'phone_number', 'phone number', 'mobile', 'mobile_phone', 'mobile phone']),
  company: pickFirstColumn(columns, ['company', 'organization', 'organisation', 'account', 'account_name', 'account name']),
  title: pickFirstColumn(columns, ['title', 'job_title', 'job title', 'position']),
  status: pickFirstColumn(columns, ['status', 'lead_status', 'lead status']),
  source: pickFirstColumn(columns, ['source', 'lead_source', 'lead source']),
  estimated_value: pickFirstColumn(columns, ['estimated_value', 'estimated value', 'value', 'deal_value', 'deal value']),
  expected_close_date: pickFirstColumn(columns, ['expected_close_date', 'expected close date', 'close_date', 'close date']),
  description: pickFirstColumn(columns, ['description', 'details']),
  notes: pickFirstColumn(columns, ['notes', 'note', 'comments', 'comment']),
  lead_score: pickFirstColumn(columns, ['lead_score', 'lead score', 'score']),
  qualification_status: pickFirstColumn(columns, ['qualification_status', 'qualification status', 'qualification']),
});

const yieldToBrowser = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const parseJsonPayloadToRows = (parsed: unknown): ParsedRow[] => {
  let candidates: unknown[] = [];
  if (Array.isArray(parsed)) {
    candidates = parsed;
  } else if (isRecord(parsed)) {
    const maybe = (parsed as any).leads ?? (parsed as any).data ?? (parsed as any).rows;
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

const leadImportSchema = z
  .object({
    first_name: z.string().min(1, 'First name is required').max(100),
    last_name: z.string().min(1, 'Last name is required').max(100),
    company: z.string().optional(),
    title: z.string().optional(),
    email: z.string().email('Invalid email').optional().or(z.literal('')),
    phone: z.string().optional(),
    status: z.enum(LEAD_STATUSES as [LeadStatus, ...LeadStatus[]]),
    source: z.enum(LEAD_SOURCES as [LeadSource, ...LeadSource[]]),
    estimated_value: z.number().nullable().optional(),
    expected_close_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
      .optional()
      .or(z.literal('')),
    description: z.string().optional(),
    notes: z.string().optional(),
    lead_score: z.number().int().min(0).max(100).nullable().optional(),
    qualification_status: z.string().optional(),
  })
  .refine((data) => {
    const hasEmail = !!(data.email && data.email.trim());
    const hasPhone = !!(data.phone && data.phone.trim());
    return hasEmail || hasPhone;
  }, { path: ['email'], message: 'Provide at least one contact: email or phone' });

const sanitizeStatus = (value: unknown): LeadStatus => {
  const v = normalizeKey(value);
  return (LEAD_STATUSES.includes(v as LeadStatus) ? (v as LeadStatus) : 'new');
};

const sanitizeSource = (value: unknown): LeadSource => {
  const v = normalizeKey(value);
  return (LEAD_SOURCES.includes(v as LeadSource) ? (v as LeadSource) : 'other');
};

const parseNumberOrNull = (value: unknown): number | null => {
  const s = safeString(value).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

const parseIntOrNull = (value: unknown): number | null => {
  const s = safeString(value).trim();
  if (!s) return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
};

const isLikelyIsoDate = (value: unknown): boolean => {
  const s = safeString(value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
};

export default function LeadsImportExport() {
  const navigate = useNavigate();
  const { supabase, context } = useCRM();
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
  const [fieldMapping, setFieldMapping] = useState<Record<LeadField, string>>(() => inferDefaultMapping([]));
  const [includeUnmappedAsCustom, setIncludeUnmappedAsCustom] = useState(true);
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>('skip');
  const [importingStage, setImportingStage] = useState<'idle' | 'parsing' | 'uploading' | 'finalizing'>('idle');
  const [exportStage, setExportStage] = useState<'idle' | 'counting' | 'fetching' | 'building' | 'downloading'>('idle');
  const [isDragActive, setIsDragActive] = useState(false);

  const [exportTemplates, setExportTemplates] = useState<ExportTemplate[]>([DEFAULT_EXPORT_TEMPLATE, FULL_EXPORT_TEMPLATE]);
  const [selectedTemplateName, setSelectedTemplateName] = useState<string>(DEFAULT_EXPORT_TEMPLATE.name);
  const [templateNameDraft, setTemplateNameDraft] = useState('');
  const [exportFields, setExportFields] = useState<ExportField[]>(DEFAULT_EXPORT_TEMPLATE.fields);
  const [exportIncludeCustomFields, setExportIncludeCustomFields] = useState(DEFAULT_EXPORT_TEMPLATE.includeCustomFields);
  const [exportStatusFilter, setExportStatusFilter] = useState<LeadStatus | 'any'>(DEFAULT_EXPORT_TEMPLATE.filters?.status ?? 'any');
  const [exportSourceFilter, setExportSourceFilter] = useState<LeadSource | 'any'>(DEFAULT_EXPORT_TEMPLATE.filters?.source ?? 'any');
  const [exportCreatedFrom, setExportCreatedFrom] = useState<string>(DEFAULT_EXPORT_TEMPLATE.filters?.createdFrom ?? '');
  const [exportCreatedTo, setExportCreatedTo] = useState<string>(DEFAULT_EXPORT_TEMPLATE.filters?.createdTo ?? '');
  const [exportHistory, setExportHistory] = useState<
    Array<{ id: string; created_at: string | null; details: any }>
  >([]);

  const exportTemplatesStorageKey = useMemo(() => {
    const t = context.tenantId || 'global';
    const f = context.franchiseId || 'global';
    return `leads.exportTemplates.${t}.${f}`;
  }, [context.tenantId, context.franchiseId]);

  const exportTemplateSelectionKey = useMemo(() => {
    const t = context.tenantId || 'global';
    const f = context.franchiseId || 'global';
    return `leads.exportTemplateSelected.${t}.${f}`;
  }, [context.tenantId, context.franchiseId]);

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
      toast.error('File exceeds 100MB limit');
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
        setFieldMapping(inferDefaultMapping(preview.columns));
        return;
      }

      if (fmt === 'json') {
        const text = await file.text();
        const parsed = JSON.parse(text) as unknown;
        const rows = parseJsonPayloadToRows(parsed);
        if (rows.length === 0) {
          throw new Error('JSON must be an array of objects (or contain leads/data/rows array)');
        }
        const sample = rows.slice(0, 25);
        const columnsSet = new Set<string>();
        for (const r of sample) Object.keys(r).forEach((k) => columnsSet.add(k));
        const columns = Array.from(columnsSet);
        setSourceColumns(columns);
        setSampleRows(sample);
        setFieldMapping(inferDefaultMapping(columns));
        return;
      }

      const arrayBuffer = await file.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = wb.SheetNames[0];
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
      setFieldMapping(inferDefaultMapping(columns));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setAnalysisError(message);
      setSourceColumns([]);
      setSampleRows([]);
      setFieldMapping(inferDefaultMapping([]));
    } finally {
      setAnalyzing(false);
    }
  };

  const buildMappedLead = (row: ParsedRow): { lead: any; customFields: Record<string, unknown> } => {
    const mapped: Record<string, unknown> = {};
    const mappedSourceColumns = new Set<string>();
    for (const field of Object.keys(fieldMapping) as LeadField[]) {
      const sourceCol = fieldMapping[field];
      if (!sourceCol) continue;
      mappedSourceColumns.add(sourceCol);
      mapped[field] = row[sourceCol];
    }

    const lead: any = {
      first_name: safeString(mapped.first_name).trim(),
      last_name: safeString(mapped.last_name).trim(),
      email: safeString(mapped.email).trim(),
      phone: safeString(mapped.phone).trim(),
      company: safeString(mapped.company).trim() || null,
      title: safeString(mapped.title).trim() || null,
      status: sanitizeStatus(mapped.status),
      source: sanitizeSource(mapped.source),
      estimated_value: parseNumberOrNull(mapped.estimated_value),
      expected_close_date: safeString(mapped.expected_close_date).trim() || null,
      description: safeString(mapped.description).trim() || null,
      notes: safeString(mapped.notes).trim() || null,
      lead_score: parseIntOrNull(mapped.lead_score),
      qualification_status: safeString(mapped.qualification_status).trim() || null,
      tenant_id: context.tenantId,
      franchise_id: context.franchiseId,
    };

    if (lead.expected_close_date && !isLikelyIsoDate(lead.expected_close_date)) {
      lead.expected_close_date = null;
    }

    const customFields: Record<string, unknown> = {};
    if (includeUnmappedAsCustom) {
      for (const key of Object.keys(row)) {
        if (mappedSourceColumns.has(key)) continue;
        const value = row[key];
        if (value === null || value === undefined) continue;
        const str = safeString(value).trim();
        if (!str) continue;
        customFields[key] = value;
      }
    }

    return { lead, customFields };
  };

  const validateLead = (lead: any): Array<{ field?: string; message: string; suggestion?: string }> => {
    const payload = {
      first_name: safeString(lead.first_name),
      last_name: safeString(lead.last_name),
      company: lead.company ? safeString(lead.company) : undefined,
      title: lead.title ? safeString(lead.title) : undefined,
      email: lead.email ? safeString(lead.email) : '',
      phone: lead.phone ? safeString(lead.phone) : undefined,
      status: sanitizeStatus(lead.status),
      source: sanitizeSource(lead.source),
      estimated_value: typeof lead.estimated_value === 'number' ? lead.estimated_value : null,
      expected_close_date: lead.expected_close_date ? safeString(lead.expected_close_date) : '',
      description: lead.description ? safeString(lead.description) : undefined,
      notes: lead.notes ? safeString(lead.notes) : undefined,
      lead_score: typeof lead.lead_score === 'number' ? lead.lead_score : null,
      qualification_status: lead.qualification_status ? safeString(lead.qualification_status) : undefined,
    };

    const res = leadImportSchema.safeParse(payload);
    if (res.success) return [];
    return res.error.issues.map((issue) => {
      const field = issue.path[0] ? String(issue.path[0]) : undefined;
      const message = issue.message;
      let suggestion: string | undefined;
      if (field === 'expected_close_date') suggestion = 'Use YYYY-MM-DD (e.g., 2026-12-31)';
      if (field === 'email' && message.toLowerCase().includes('contact')) suggestion = 'Provide email or phone';
      if (field === 'email' && message.toLowerCase().includes('invalid')) suggestion = 'Fix email format (e.g., name@company.com)';
      if (field === 'first_name' || field === 'last_name') suggestion = 'Map the correct column or fill in missing values';
      return { field, message, suggestion };
    });
  };

  const previewRows: ImportPreviewRow[] = useMemo(() => {
    const rows = sampleRows.slice(0, 10);
    return rows.map((raw, idx) => {
      const { lead, customFields } = buildMappedLead(raw);
      const mapped: Record<string, unknown> = { ...lead };
      if (Object.keys(customFields).length > 0) mapped.custom_fields = customFields;
      const errors = validateLead(lead);
      const duplicateKey = safeString(lead.email).trim().toLowerCase() || safeString(lead.phone).trim();
      return { rowNumber: idx + 1, raw, mapped, errors, duplicateKey };
    });
  }, [sampleRows, fieldMapping, includeUnmappedAsCustom, context.tenantId, context.franchiseId]);

  const previewSummary = useMemo(() => {
    const valid = previewRows.filter((r) => r.errors.length === 0).length;
    const invalid = previewRows.length - valid;
    const keys = previewRows.map((r) => r.duplicateKey).filter((k) => !!k);
    const seen = new Set<string>();
    let inFileDuplicates = 0;
    for (const k of keys) {
      if (seen.has(k)) inFileDuplicates++;
      seen.add(k);
    }
    return { valid, invalid, inFileDuplicates };
  }, [previewRows]);

  const logAudit = async (action: string, details: any) => {
    if (!context.userId) return;
    try {
      const payload = {
        user_id: context.userId,
        action,
        resource_type: 'leads',
        details,
      };
      void supabase.from('audit_logs').insert(payload);
    } catch {
      void 0;
    }
  };

  const applyScope = <T extends { eq: (...args: any[]) => T }>(query: T) => {
    if (context.franchiseId) return query.eq('franchise_id', context.franchiseId);
    if (context.tenantId) return query.eq('tenant_id', context.tenantId);
    return query;
  };

  const fetchExistingByEmails = async (emails: string[]) => {
    const out = new Map<string, { id: string; email: string | null; phone: string | null }>();
    const clean = Array.from(new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean)));
    if (clean.length === 0) return out;
    for (let i = 0; i < clean.length; i += DUPLICATE_QUERY_BATCH_SIZE) {
      const batch = clean.slice(i, i + DUPLICATE_QUERY_BATCH_SIZE);
      const q = applyScope((supabase as any).from('leads').select('id,email,phone')).in('email', batch);
      const { data, error } = await q;
      if (error) continue;
      for (const row of (data ?? []) as any[]) {
        const key = String(row.email ?? '').trim().toLowerCase();
        if (!key) continue;
        out.set(key, { id: String(row.id), email: row.email ?? null, phone: row.phone ?? null });
      }
    }
    return out;
  };

  const fetchExistingByPhones = async (phones: string[]) => {
    const out = new Map<string, { id: string; email: string | null; phone: string | null }>();
    const clean = Array.from(new Set(phones.map((p) => p.trim()).filter(Boolean)));
    if (clean.length === 0) return out;
    for (let i = 0; i < clean.length; i += DUPLICATE_QUERY_BATCH_SIZE) {
      const batch = clean.slice(i, i + DUPLICATE_QUERY_BATCH_SIZE);
      const q = applyScope((supabase as any).from('leads').select('id,email,phone')).in('phone', batch);
      const { data, error } = await q;
      if (error) continue;
      for (const row of (data ?? []) as any[]) {
        const key = String(row.phone ?? '').trim();
        if (!key) continue;
        out.set(key, { id: String(row.id), email: row.email ?? null, phone: row.phone ?? null });
      }
    }
    return out;
  };

  const flushBatch = async (
    batch: Array<{ lead: any; rowNumber: number; duplicateKey: string; customFields: Record<string, unknown> }>,
    result: ImportResult,
    counters: { duplicates: number }
  ) => {
    if (batch.length === 0) return;

    const emails = batch.map((b) => safeString(b.lead.email).trim().toLowerCase()).filter(Boolean);
    const phones = batch.map((b) => safeString(b.lead.phone).trim()).filter(Boolean);
    const [existingByEmail, existingByPhone] = await Promise.all([fetchExistingByEmails(emails), fetchExistingByPhones(phones)]);

    const toInsert: any[] = [];
    const toUpdate: Array<{ id: string; lead: any; rowNumber: number }> = [];

    for (const item of batch) {
      const emailKey = safeString(item.lead.email).trim().toLowerCase();
      const phoneKey = safeString(item.lead.phone).trim();
      const existing = (emailKey && existingByEmail.get(emailKey)) || (phoneKey && existingByPhone.get(phoneKey));
      const isDuplicate = !!existing;
      if (!isDuplicate) {
        const payload = { ...item.lead };
        if (Object.keys(item.customFields).length > 0) payload.custom_fields = item.customFields;
        toInsert.push(payload);
        continue;
      }

      if (duplicateMode === 'allow') {
        const payload = { ...item.lead };
        if (Object.keys(item.customFields).length > 0) payload.custom_fields = item.customFields;
        toInsert.push(payload);
        continue;
      }

      if (duplicateMode === 'skip') {
        counters.duplicates++;
        continue;
      }

      if (existing?.id) {
        const payload = { ...item.lead };
        if (Object.keys(item.customFields).length > 0) payload.custom_fields = item.customFields;
        toUpdate.push({ id: existing.id, lead: payload, rowNumber: item.rowNumber });
      } else {
        counters.duplicates++;
      }
    }

    if (toInsert.length > 0) {
      const { error } = await supabase.from('leads').insert(toInsert);
      if (!error) {
        result.success += toInsert.length;
      } else {
        for (const payload of toInsert) {
          const { error: rowErr } = await supabase.from('leads').insert(payload);
          if (rowErr) {
            result.failed++;
            result.errors.push(`Row: insert failed (${rowErr.message})`);
          } else {
            result.success++;
          }
        }
      }
    }

    if (toUpdate.length > 0) {
      const concurrency = 10;
      for (let i = 0; i < toUpdate.length; i += concurrency) {
        const slice = toUpdate.slice(i, i + concurrency);
        await Promise.all(
          slice.map(async (u) => {
            const { error } = await supabase.from('leads').update(u.lead).eq('id', u.id);
            if (error) {
              result.failed++;
              result.errors.push(`Row ${u.rowNumber}: duplicate update failed (${error.message})`);
            } else {
              result.success++;
            }
          })
        );
      }
    }

    await yieldToBrowser();
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error('Please select a file first');
      return;
    }

    if (!fileFormat) {
      toast.error('Unsupported file format');
      return;
    }

    if (selectedFile.size > MAX_IMPORT_FILE_BYTES) {
      toast.error('File exceeds 100MB limit');
      return;
    }

    const requiredFields: LeadField[] = ['first_name', 'last_name'];
    const missingRequiredMappings = requiredFields.filter((f) => !fieldMapping[f]);
    if (missingRequiredMappings.length > 0) {
      toast.error(`Map required fields: ${missingRequiredMappings.map((f) => LEAD_FIELD_LABELS[f]).join(', ')}`);
      return;
    }

    setImporting(true);
    setProgress(0);
    setImportingStage('parsing');
    const result: ImportResult = { success: 0, failed: 0, errors: [] };

    try {
      const duplicatesCounter = { duplicates: 0 };

      const processRowsArray = async (rows: ParsedRow[]) => {
        const total = rows.length;
        let batch: Array<{ lead: any; rowNumber: number; duplicateKey: string; customFields: Record<string, unknown> }> = [];
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rowNumber = i + 1;
          const { lead, customFields } = buildMappedLead(row);
          const issues = validateLead(lead);
          if (issues.length > 0) {
            result.failed++;
            const flat = issues.map((x) => `${x.field ? `${x.field}: ` : ''}${x.message}${x.suggestion ? ` (${x.suggestion})` : ''}`).join('; ');
            result.errors.push(`Row ${rowNumber}: ${flat}`);
          } else {
            const duplicateKey = safeString(lead.email).trim().toLowerCase() || safeString(lead.phone).trim();
            batch.push({ lead, rowNumber, duplicateKey, customFields });
          }

          if (batch.length >= IMPORT_BATCH_SIZE) {
            setImportingStage('uploading');
            await flushBatch(batch, result, duplicatesCounter);
            batch = [];
          }

          setProgress(((i + 1) / total) * 100);
          if ((i + 1) % 1000 === 0) await yieldToBrowser();
        }

        if (batch.length > 0) {
          setImportingStage('uploading');
          await flushBatch(batch, result, duplicatesCounter);
          batch = [];
        }
      };

      if (fileFormat === 'csv') {
        let seenRows = 0;
        let batch: Array<{ lead: any; rowNumber: number; duplicateKey: string; customFields: Record<string, unknown> }> = [];
        await new Promise<void>((resolve, reject) => {
          Papa.parse(selectedFile, {
            header: true,
            skipEmptyLines: true,
            worker: true,
            chunkSize: 1024 * 512,
            chunk: (chunk, parser) => {
              parser.pause();
              void (async () => {
                const rows = (chunk.data ?? []) as ParsedRow[];
                for (const row of rows) {
                  const rowNumber = ++seenRows;
                  const { lead, customFields } = buildMappedLead(row);
                  const issues = validateLead(lead);
                  if (issues.length > 0) {
                    result.failed++;
                    const flat = issues.map((x) => `${x.field ? `${x.field}: ` : ''}${x.message}${x.suggestion ? ` (${x.suggestion})` : ''}`).join('; ');
                    result.errors.push(`Row ${rowNumber}: ${flat}`);
                  } else {
                    const duplicateKey = safeString(lead.email).trim().toLowerCase() || safeString(lead.phone).trim();
                    batch.push({ lead, rowNumber, duplicateKey, customFields });
                  }

                  if (batch.length >= IMPORT_BATCH_SIZE) {
                    setImportingStage('uploading');
                    await flushBatch(batch, result, duplicatesCounter);
                    batch = [];
                  }
                }

                const cursor = (chunk.meta as any)?.cursor as number | undefined;
                if (cursor && selectedFile.size > 0) {
                  setProgress(Math.min(100, (cursor / selectedFile.size) * 100));
                }
                await yieldToBrowser();
                parser.resume();
              })().catch((err) => {
                parser.abort();
                reject(err);
              });
            },
            complete: () => {
              void (async () => {
                if (batch.length > 0) {
                  setImportingStage('uploading');
                  await flushBatch(batch, result, duplicatesCounter);
                  batch = [];
                }
                resolve();
              })().catch(reject);
            },
            error: (err) => reject(err),
          });
        });
      } else if (fileFormat === 'json') {
        const text = await selectedFile.text();
        const parsed = JSON.parse(text) as unknown;
        const rows = parseJsonPayloadToRows(parsed);
        if (rows.length === 0) throw new Error('No rows found in JSON');
        await processRowsArray(rows);
      } else {
        const arrayBuffer = await selectedFile.arrayBuffer();
        const wb = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as ParsedRow[];
        await processRowsArray(rows);
      }

      setImportingStage('finalizing');
      setImportResult(result);
      setImporting(false);
      setProgress(100);
      if (result.success > 0) toast.success(`Successfully imported ${result.success} leads`);
      if (result.failed > 0) toast.error(`Failed to import ${result.failed} leads`);

      await logAudit('LEADS_IMPORT', {
        format: fileFormat,
        fileName: selectedFile.name,
        fileSizeBytes: selectedFile.size,
        duplicateMode,
        duplicatesSkipped: duplicatesCounter.duplicates,
        success: result.success,
        failed: result.failed,
        tenantId: context.tenantId,
        franchiseId: context.franchiseId,
      });
    } catch (error: any) {
      console.error('Import parsing error:', error);
      toast.error(`Import parsing error: ${error?.message || 'Unknown error'}`);
      setImporting(false);
      setImportingStage('idle');
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const buildExportQuery = () => {
    let query: any = (supabase as any).from('leads').select('*');
    query = applyScope(query);
    if (exportStatusFilter !== 'any') query = query.eq('status', exportStatusFilter);
    if (exportSourceFilter !== 'any') query = query.eq('source', exportSourceFilter);
    if (exportCreatedFrom) query = query.gte('created_at', `${exportCreatedFrom}T00:00:00.000Z`);
    if (exportCreatedTo) query = query.lte('created_at', `${exportCreatedTo}T23:59:59.999Z`);
    return query;
  };

  const fetchExportCount = async () => {
    const q = buildExportQuery();
    const { count, error } = await q.select('id', { count: 'exact', head: true });
    if (error) throw error;
    return Number(count || 0);
  };

  const runExport = async (format: FileFormat) => {
    setExporting(true);
    setProgress(0);
    setExportStage('counting');
    try {
      const totalCount = await fetchExportCount();
      if (totalCount === 0) {
        toast.error('No leads found to export');
        setExporting(false);
        setExportStage('idle');
        return;
      }

      setExportStage('fetching');
      const pageSize = 1000;
      let fetched = 0;
      const rows: any[] = [];
      const customKeys = new Set<string>();

      for (let from = 0; from < totalCount; from += pageSize) {
        const to = Math.min(totalCount - 1, from + pageSize - 1);
        const q = buildExportQuery().range(from, to);
        const { data, error } = await q;
        if (error) throw error;
        const leads = (data ?? []) as any[];
        for (const lead of leads) {
          const custom = lead.custom_fields && typeof lead.custom_fields === 'object' ? (lead.custom_fields as Record<string, unknown>) : {};
          if (exportIncludeCustomFields) Object.keys(custom).forEach((k) => customKeys.add(k));
          const base: Record<string, unknown> = {};
          for (const f of exportFields) base[f] = lead[f];
          if (exportIncludeCustomFields) {
            for (const k of Object.keys(custom)) base[k] = custom[k];
          }
          rows.push(base);
        }
        fetched += leads.length;
        setProgress(Math.min(100, (fetched / totalCount) * 100));
        await yieldToBrowser();
      }

      setExportStage('building');
      const dateStamp = new Date().toISOString().split('T')[0];
      const baseName = `leads_export_${dateStamp}`;

      const customColumns = exportIncludeCustomFields ? Array.from(customKeys).sort() : [];
      const columns = [...exportFields, ...customColumns];

      if (format === 'csv') {
        const csv = Papa.unparse(rows, { columns });
        downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${baseName}.csv`);
      } else if (format === 'xlsx') {
        const ws = XLSX.utils.json_to_sheet(rows, { header: columns as any[] });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Leads');
        XLSX.writeFile(wb, `${baseName}.xlsx`);
      } else {
        downloadBlob(new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' }), `${baseName}.json`);
      }

      setExportStage('downloading');
      toast.success(`Exported ${totalCount} leads`);

      await logAudit('LEADS_EXPORT', {
        format,
        count: totalCount,
        template: selectedTemplateName,
        fields: exportFields,
        includeCustomFields: exportIncludeCustomFields,
        filters: {
          status: exportStatusFilter,
          source: exportSourceFilter,
          createdFrom: exportCreatedFrom || null,
          createdTo: exportCreatedTo || null,
          tenantId: context.tenantId,
          franchiseId: context.franchiseId,
        },
      });
      await refreshExportHistory();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('Export error:', e);
      toast.error(`Failed to export leads: ${message}`);
    } finally {
      setExporting(false);
      setExportStage('idle');
      setProgress(0);
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com',
        phone: '+1234567890',
        company: 'Example Corp',
        title: 'CEO',
        status: 'new',
        source: 'website',
        estimated_value: '50000',
        expected_close_date: '2025-12-31',
        description: 'Potential high-value client',
        notes: 'Met at conference',
        custom_field_1: 'Custom Value 1',
        custom_field_2: 'Custom Value 2'
      }
    ];

    const csv = Papa.unparse(template);
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'leads_import_template.csv');

    // Excel template
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'leads_import_template.xlsx');

    downloadBlob(new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' }), 'leads_import_template.json');

    toast.success('Template downloaded');
  };

  const refreshExportHistory = async () => {
    if (!context.userId) return;
    const { data, error } = await supabase
      .from('audit_logs')
      .select('id, created_at, details, action, resource_type, user_id')
      .eq('user_id', context.userId)
      .eq('resource_type', 'leads')
      .eq('action', 'LEADS_EXPORT')
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) return;
    setExportHistory((data ?? []).map((r: any) => ({ id: String(r.id), created_at: r.created_at ?? null, details: r.details })));
  };

  useEffect(() => {
    void refreshExportHistory();
  }, [context.userId]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(exportTemplatesStorageKey);
      const parsed = raw ? (JSON.parse(raw) as unknown) : null;
      const fromStorage: ExportTemplate[] = Array.isArray(parsed)
        ? (parsed as any[])
            .filter((t) => t && typeof t === 'object' && typeof t.name === 'string' && Array.isArray(t.fields))
            .map((t) => ({
              name: String(t.name),
              fields: (t.fields as any[]).filter(Boolean) as ExportField[],
              includeCustomFields: Boolean((t as any).includeCustomFields),
              filters: (t as any).filters && typeof (t as any).filters === 'object' ? (t as any).filters : undefined,
            }))
        : [];
      setExportTemplates([DEFAULT_EXPORT_TEMPLATE, FULL_EXPORT_TEMPLATE, ...fromStorage]);
    } catch {
      setExportTemplates([DEFAULT_EXPORT_TEMPLATE, FULL_EXPORT_TEMPLATE]);
    }

    try {
      const selected = localStorage.getItem(exportTemplateSelectionKey);
      if (selected) setSelectedTemplateName(selected);
      else setSelectedTemplateName(DEFAULT_EXPORT_TEMPLATE.name);
    } catch {
      setSelectedTemplateName(DEFAULT_EXPORT_TEMPLATE.name);
    }
  }, [exportTemplatesStorageKey, exportTemplateSelectionKey]);

  useEffect(() => {
    try {
      const customTemplates = exportTemplates.filter(
        (t) => t.name !== DEFAULT_EXPORT_TEMPLATE.name && t.name !== FULL_EXPORT_TEMPLATE.name
      );
      localStorage.setItem(exportTemplatesStorageKey, JSON.stringify(customTemplates));
    } catch {
      void 0;
    }
  }, [exportTemplates, exportTemplatesStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(exportTemplateSelectionKey, selectedTemplateName);
    } catch {
      void 0;
    }
  }, [selectedTemplateName, exportTemplateSelectionKey]);

  const selectedTemplate = useMemo(() => {
    return exportTemplates.find((t) => t.name === selectedTemplateName) ?? DEFAULT_EXPORT_TEMPLATE;
  }, [exportTemplates, selectedTemplateName]);

  useEffect(() => {
    setExportFields(selectedTemplate.fields);
    setExportIncludeCustomFields(selectedTemplate.includeCustomFields);
    setExportStatusFilter(selectedTemplate.filters?.status ?? 'any');
    setExportSourceFilter(selectedTemplate.filters?.source ?? 'any');
    setExportCreatedFrom(selectedTemplate.filters?.createdFrom ?? '');
    setExportCreatedTo(selectedTemplate.filters?.createdTo ?? '');
  }, [selectedTemplateName]);

  const saveTemplate = async () => {
    const name = templateNameDraft.trim();
    if (!name) {
      toast.error('Template name is required');
      return;
    }
    const next: ExportTemplate[] = [
      ...exportTemplates.filter((t) => t.name !== name),
      {
        name,
        fields: exportFields,
        includeCustomFields: exportIncludeCustomFields,
        filters: {
          status: exportStatusFilter,
          source: exportSourceFilter,
          createdFrom: exportCreatedFrom || undefined,
          createdTo: exportCreatedTo || undefined,
        },
      },
    ].sort((a, b) => a.name.localeCompare(b.name));
    setExportTemplates(next);
    setSelectedTemplateName(name);
    setTemplateNameDraft('');
    toast.success('Template saved');
  };

  const deleteTemplate = async (name: string) => {
    if (name === DEFAULT_EXPORT_TEMPLATE.name || name === FULL_EXPORT_TEMPLATE.name) return;
    const next = exportTemplates.filter((t) => t.name !== name);
    setExportTemplates(next);
    setSelectedTemplateName(DEFAULT_EXPORT_TEMPLATE.name);
    toast.success('Template deleted');
  };

  const moveExportField = (field: ExportField, dir: -1 | 1) => {
    const idx = exportFields.indexOf(field);
    if (idx < 0) return;
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= exportFields.length) return;
    const next = [...exportFields];
    const tmp = next[idx];
    next[idx] = next[nextIdx];
    next[nextIdx] = tmp;
    setExportFields(next);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    void onNewFile(file);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Import / Export Leads</h1>
            <p className="text-muted-foreground mt-1">
              Bulk manage your lead data with CSV, XLSX, or JSON files
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/dashboard/leads')}>
            Back to Leads
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Import Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                <CardTitle>Import Leads</CardTitle>
              </div>
              <CardDescription>
                Upload CSV, Excel (.xlsx), or JSON to import multiple leads
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="import-file">Select File</Label>
                <Input id="import-file" type="file" accept=".csv,.xlsx,.json" onChange={handleFileSelect} disabled={importing || analyzing} />
                <div
                  className={`rounded-md border border-dashed p-4 text-sm ${
                    isDragActive ? 'border-primary text-foreground' : 'text-muted-foreground'
                  }`}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setIsDragActive(true);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDragActive(false);
                  }}
                  onDrop={handleDrop}
                >
                  {isDragActive ? 'Drop to upload' : 'Drag and drop a file here'}
                </div>
                {selectedFile && (
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Selected: {selectedFile.name}</span>
                    <span>{fileFormat?.toUpperCase()} · {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                )}
              </div>

              {analysisError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">{analysisError}</AlertDescription>
                </Alert>
              )}

              {analyzing && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Analyzing file…</AlertDescription>
                </Alert>
              )}

              {selectedFile && sourceColumns.length > 0 && (
                <div className="space-y-3">
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Field mapping</p>
                      <p className="text-xs text-muted-foreground">Preview uses first 10 rows</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant={previewSummary.invalid > 0 ? 'destructive' : 'default'}>
                        Valid: {previewSummary.valid}
                      </Badge>
                      <Badge variant={previewSummary.invalid > 0 ? 'destructive' : 'outline'}>
                        Issues: {previewSummary.invalid}
                      </Badge>
                      <Badge variant={previewSummary.inFileDuplicates > 0 ? 'secondary' : 'outline'}>
                        In-file duplicates: {previewSummary.inFileDuplicates}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {(Object.keys(LEAD_FIELD_LABELS) as LeadField[]).map((field) => (
                      <div key={field} className="space-y-2">
                        <Label className="text-xs">{LEAD_FIELD_LABELS[field]}</Label>
                        <Select
                          value={fieldMapping[field] || '__none__'}
                          onValueChange={(val) =>
                            setFieldMapping((prev) => ({ ...prev, [field]: val === '__none__' ? '' : val }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Not mapped" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Not mapped</SelectItem>
                            {sourceColumns.map((col) => (
                              <SelectItem key={col} value={col}>
                                {col}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="include-unmapped"
                        checked={includeUnmappedAsCustom}
                        onCheckedChange={(v) => setIncludeUnmappedAsCustom(Boolean(v))}
                      />
                      <Label htmlFor="include-unmapped" className="text-sm">
                        Store unmapped columns as custom fields
                      </Label>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Duplicate handling</Label>
                      <Select value={duplicateMode} onValueChange={(v) => setDuplicateMode(v as DuplicateMode)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select duplicate handling" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="skip">Skip duplicates</SelectItem>
                          <SelectItem value="update">Update existing</SelectItem>
                          <SelectItem value="allow">Insert duplicates</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Row</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>First</TableHead>
                          <TableHead>Last</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Issues</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewRows.map((r) => (
                          <TableRow key={r.rowNumber}>
                            <TableCell>{r.rowNumber}</TableCell>
                            <TableCell>
                              {r.errors.length === 0 ? (
                                <Badge variant="default">Ready</Badge>
                              ) : (
                                <Badge variant="destructive">Fix</Badge>
                              )}
                            </TableCell>
                            <TableCell>{safeString((r.mapped as any).first_name)}</TableCell>
                            <TableCell>{safeString((r.mapped as any).last_name)}</TableCell>
                            <TableCell className="max-w-[220px] truncate">{safeString((r.mapped as any).email)}</TableCell>
                            <TableCell className="max-w-[180px] truncate">{safeString((r.mapped as any).phone)}</TableCell>
                            <TableCell>
                              {r.errors.length === 0 ? (
                                <span className="text-xs text-muted-foreground">—</span>
                              ) : (
                                <details className="text-xs">
                                  <summary className="cursor-pointer">View</summary>
                                  <ul className="mt-2 space-y-1">
                                    {r.errors.slice(0, 3).map((e, i) => (
                                      <li key={i} className="text-destructive">
                                        {e.field ? `${e.field}: ` : ''}
                                        {e.message}
                                        {e.suggestion ? ` — ${e.suggestion}` : ''}
                                      </li>
                                    ))}
                                    {r.errors.length > 3 && <li>…and {r.errors.length - 3} more</li>}
                                  </ul>
                                </details>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {importing && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>
                      {importingStage === 'parsing'
                        ? 'Parsing…'
                        : importingStage === 'uploading'
                          ? 'Uploading…'
                          : importingStage === 'finalizing'
                            ? 'Finalizing…'
                            : 'Importing…'}
                    </span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
              )}

              {importResult && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <p className="font-medium">Import Complete</p>
                      <div className="flex gap-4 text-sm">
                        <Badge variant="default">Success: {importResult.success}</Badge>
                        <Badge variant="destructive">Failed: {importResult.failed}</Badge>
                      </div>
                      {importResult.errors.length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm">
                            View errors ({importResult.errors.length})
                          </summary>
                          <ul className="mt-2 space-y-1 text-xs">
                            {importResult.errors.slice(0, 10).map((error, i) => (
                              <li key={i} className="text-destructive">{error}</li>
                            ))}
                            {importResult.errors.length > 10 && (
                              <li>...and {importResult.errors.length - 10} more</li>
                            )}
                          </ul>
                        </details>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleImport}
                  disabled={!selectedFile || importing || analyzing || !!analysisError}
                  className="flex-1"
                >
                  {importing ? 'Importing...' : 'Import Leads'}
                </Button>
                <Button
                  variant="outline"
                  onClick={downloadTemplate}
                  disabled={importing}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Template
                </Button>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>Formats:</strong> CSV, XLSX, JSON. File type validation is enforced. For XLSX, macro-enabled files (.xlsm) are not supported.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Export Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                <CardTitle>Export Leads</CardTitle>
              </div>
              <CardDescription>
                Download leads with templates, filters, and field selection
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs">Template</Label>
                    <Select value={selectedTemplateName} onValueChange={setSelectedTemplateName}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select template" />
                      </SelectTrigger>
                      <SelectContent>
                        {exportTemplates.map((t) => (
                          <SelectItem key={t.name} value={t.name}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Save current as template</Label>
                    <div className="flex gap-2">
                      <Input value={templateNameDraft} onChange={(e) => setTemplateNameDraft(e.target.value)} placeholder="Template name" />
                      <Button variant="outline" onClick={saveTemplate} disabled={!templateNameDraft.trim()}>
                        Save
                      </Button>
                    </div>
                    {selectedTemplateName !== DEFAULT_EXPORT_TEMPLATE.name && selectedTemplateName !== FULL_EXPORT_TEMPLATE.name && (
                      <Button variant="ghost" className="px-0 text-destructive" onClick={() => deleteTemplate(selectedTemplateName)}>
                        Delete “{selectedTemplateName}”
                      </Button>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs">Status filter</Label>
                    <Select value={exportStatusFilter} onValueChange={(v) => setExportStatusFilter(v as any)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        {LEAD_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Source filter</Label>
                    <Select value={exportSourceFilter} onValueChange={(v) => setExportSourceFilter(v as any)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        {LEAD_SOURCES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs">Created from</Label>
                    <Input type="date" value={exportCreatedFrom} onChange={(e) => setExportCreatedFrom(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Created to</Label>
                    <Input type="date" value={exportCreatedTo} onChange={(e) => setExportCreatedTo(e.target.value)} />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="export-custom"
                    checked={exportIncludeCustomFields}
                    onCheckedChange={(v) => setExportIncludeCustomFields(Boolean(v))}
                  />
                  <Label htmlFor="export-custom" className="text-sm">
                    Include custom fields
                  </Label>
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Field</TableHead>
                        <TableHead className="w-28 text-right">Order</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {exportFields.map((f) => (
                        <TableRow key={f}>
                          <TableCell className="font-medium">{EXPORT_FIELD_LABELS[f]}</TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => moveExportField(f, -1)}>
                                Up
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => moveExportField(f, 1)}>
                                Down
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => void runExport('csv')}
                    disabled={exporting}
                    className="w-full"
                    size="lg"
                  >
                    {exporting ? (
                      'Exporting...'
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Export CSV
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => void runExport('xlsx')}
                    disabled={exporting}
                    className="w-full"
                    size="lg"
                  >
                    {exporting ? (
                      'Exporting...'
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Export Excel
                      </>
                    )}
                  </Button>
                </div>

                <Button onClick={() => void runExport('json')} disabled={exporting} variant="outline" className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Export JSON
                </Button>

                {exporting && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>
                        {exportStage === 'counting'
                          ? 'Counting…'
                          : exportStage === 'fetching'
                            ? 'Fetching…'
                            : exportStage === 'building'
                              ? 'Building file…'
                              : exportStage === 'downloading'
                                ? 'Downloading…'
                                : 'Exporting…'}
                      </span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} />
                  </div>
                )}

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Exports are chunked in 1,000-row pages for responsiveness. Export actions are tracked in audit logs.
                  </AlertDescription>
                </Alert>

                {exportHistory.length > 0 && (
                  <div className="space-y-2">
                    <Separator />
                    <h4 className="font-medium text-sm">Recent exports</h4>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>When</TableHead>
                            <TableHead>Format</TableHead>
                            <TableHead className="text-right">Count</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {exportHistory.map((h) => (
                            <TableRow key={h.id}>
                              <TableCell className="text-xs text-muted-foreground">
                                {h.created_at ? new Date(h.created_at).toLocaleString() : '—'}
                              </TableCell>
                              <TableCell className="text-xs">{safeString(h.details?.format).toUpperCase()}</TableCell>
                              <TableCell className="text-right text-xs">{safeString(h.details?.count)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Custom Fields Info */}
        <Card>
          <CardHeader>
            <CardTitle>Custom Fields Support</CardTitle>
            <CardDescription>
              Flexibly manage additional lead data beyond standard fields
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <h4 className="font-medium">During Import</h4>
                <p className="text-sm text-muted-foreground">
                  Any columns in your CSV that don't match standard fields will automatically 
                  be stored as custom fields for each lead.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">During Export</h4>
                <p className="text-sm text-muted-foreground">
                  All custom fields are included in the export alongside standard fields, 
                  making it easy to maintain your custom data structure.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Data Flexibility</h4>
                <p className="text-sm text-muted-foreground">
                  Store any additional information like industry codes, lead scores, 
                  qualification notes, or any custom metrics your business needs.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
