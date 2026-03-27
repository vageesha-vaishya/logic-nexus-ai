import { Suspense, lazy, useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { EditableText } from '@/components/ui/editable-text';
import { ArrowDown, ArrowUp, Download, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { parseFileRows, exportCsv, exportExcel } from '@/lib/import-export';
import { themeStyleFromPreset } from '@/lib/theme-utils';
import { THEME_PRESETS } from '@/theme/themes';
import type { Lead } from '@/pages/dashboard/leads-data';
import type { ColumnType } from '@/components/kanban/KanbanBoard';
import type { KanbanItem } from '@/components/kanban/KanbanCard';
import { parseApiPayload } from '../services';

const LazyKanbanBoard = lazy(() =>
  import('@/components/kanban/KanbanBoard').then((module) => ({ default: module.KanbanBoard })),
);
const LazyPipelineAnalytics = lazy(() =>
  import('@/components/analytics/PipelineAnalytics').then((module) => ({ default: module.PipelineAnalytics })),
);

type AircraftLeadRecord = {
  id: string;
  aircraft_id: string;
  aircraft_registration: string;
  aircraft_type: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  source: string;
  score: number;
  assigned_to: string;
  maintenance_due_at: string;
  next_action_due_at: string;
  compliance_state: string;
  regulatory_authority: string;
  tags: string[];
  created_at: string;
  updated_at: string;
};

type AircraftLeadWizardValues = {
  id: string;
  aircraft_id: string;
  aircraft_registration: string;
  aircraft_type: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  source: string;
  score: string;
  assigned_to: string;
  maintenance_due_at: string;
  next_action_due_at: string;
  compliance_state: string;
  regulatory_authority: string;
  tags: string;
};

type SavedFilter = {
  id: string;
  name: string;
  filters: {
    status: string;
    priority: string;
    aircraftType: string;
    complianceState: string;
  };
};

type AircraftLeadsManagerProps = {
  scope: {
    tenantId: string;
    franchiseId: string;
    userId: string;
  };
  sessionAccessToken: string;
  canManage: boolean;
  canDelete: boolean;
};

type AircraftLeadsTab = 'pipeline' | 'list' | 'grid' | 'card' | 'analytics' | 'import_export' | 'detail' | 'wizard';

const DEFAULT_WIZARD_VALUES: AircraftLeadWizardValues = {
  id: '',
  aircraft_id: '',
  aircraft_registration: '',
  aircraft_type: '',
  title: '',
  description: '',
  status: 'new',
  priority: 'medium',
  source: 'manual',
  score: '0',
  assigned_to: '',
  maintenance_due_at: '',
  next_action_due_at: '',
  compliance_state: 'monitoring',
  regulatory_authority: 'DGCA',
  tags: '',
};

const PAGE_SIZE_OPTIONS = ['25', '50', '100'];
const AIRCRAFT_LEADS_SORT_OPTIONS = [
  { label: 'Updated', value: 'updated_at' },
  { label: 'Score', value: 'score' },
  { label: 'Due Date', value: 'maintenance_due_at' },
  { label: 'Title', value: 'title' },
];
const AIRCRAFT_LEAD_IMPORT_FIELDS = [
  'title',
  'aircraft_id',
  'aircraft_registration',
  'aircraft_type',
  'status',
  'priority',
  'source',
  'assigned_to',
  'score',
  'maintenance_due_at',
  'next_action_due_at',
  'compliance_state',
  'regulatory_authority',
  'description',
  'tags',
] as const;

function normalizeLeadRecord(value: unknown): AircraftLeadRecord {
  const row = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    id: String(row.id || ''),
    aircraft_id: String(row.aircraft_id || ''),
    aircraft_registration: String(row.aircraft_registration || ''),
    aircraft_type: String(row.aircraft_type || ''),
    title: String(row.title || ''),
    description: String(row.description || ''),
    status: String(row.status || 'new'),
    priority: String(row.priority || 'medium'),
    source: String(row.source || 'manual'),
    score: Number(row.score || 0),
    assigned_to: String(row.assigned_to || ''),
    maintenance_due_at: String(row.maintenance_due_at || ''),
    next_action_due_at: String(row.next_action_due_at || ''),
    compliance_state: String(row.compliance_state || 'monitoring'),
    regulatory_authority: String(row.regulatory_authority || 'DGCA'),
    tags: Array.isArray(row.tags) ? row.tags.map((item) => String(item || '')).filter(Boolean) : [],
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || ''),
  };
}

function mapLeadToWizardValues(record: AircraftLeadRecord): AircraftLeadWizardValues {
  return {
    id: record.id,
    aircraft_id: record.aircraft_id,
    aircraft_registration: record.aircraft_registration,
    aircraft_type: record.aircraft_type,
    title: record.title,
    description: record.description,
    status: record.status,
    priority: record.priority,
    source: record.source,
    score: String(record.score || 0),
    assigned_to: record.assigned_to,
    maintenance_due_at: record.maintenance_due_at ? String(record.maintenance_due_at).slice(0, 10) : '',
    next_action_due_at: record.next_action_due_at ? String(record.next_action_due_at).slice(0, 10) : '',
    compliance_state: record.compliance_state,
    regulatory_authority: record.regulatory_authority,
    tags: record.tags.join(', '),
  };
}

function validateWizardStep(values: AircraftLeadWizardValues, step: number): Record<string, string> {
  const errors: Record<string, string> = {};
  if (step === 1) {
    if (!values.title.trim()) errors.title = 'Title is required';
    if (!values.aircraft_id.trim()) errors.aircraft_id = 'Aircraft ID is required';
  }
  if (step === 2) {
    if (!values.aircraft_type.trim()) errors.aircraft_type = 'Aircraft type is required';
    if (!values.compliance_state.trim()) errors.compliance_state = 'Compliance state is required';
    if (!values.regulatory_authority.trim()) errors.regulatory_authority = 'Regulatory authority is required';
  }
  if (step === 3) {
    if (!values.status.trim()) errors.status = 'Status is required';
    if (!values.priority.trim()) errors.priority = 'Priority is required';
  }
  return errors;
}

export function AircraftLeadsManager({ scope, sessionAccessToken, canManage, canDelete }: AircraftLeadsManagerProps) {
  const [rows, setRows] = useState<AircraftLeadRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [autocompleteOptions, setAutocompleteOptions] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [aircraftTypeFilter, setAircraftTypeFilter] = useState('all');
  const [complianceStateFilter, setComplianceStateFilter] = useState('all');
  const [sortBy, setSortBy] = useState('updated_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('25');
  const [totalCount, setTotalCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<AircraftLeadsTab>('list');
  const [detailTab, setDetailTab] = useState<'overview' | 'compliance' | 'workflow'>('overview');
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [gridColumns, setGridColumns] = useState<'2' | '3' | '4'>('3');
  const [activeTheme, setActiveTheme] = useState('Default Simple');
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [importFileName, setImportFileName] = useState('');
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importRows, setImportRows] = useState<Array<Record<string, string>>>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardValues, setWizardValues] = useState<AircraftLeadWizardValues>(DEFAULT_WIZARD_VALUES);
  const [wizardErrors, setWizardErrors] = useState<Record<string, string>>({});
  const [wizardSubmitting, setWizardSubmitting] = useState(false);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [savedFilterName, setSavedFilterName] = useState('');
  const [selectedSavedFilterId, setSelectedSavedFilterId] = useState('none');

  const savedFiltersStorageKey = useMemo(
    () => `amro:aircraft-leads:saved-filters:${scope.tenantId || 'tenant'}:${scope.franchiseId || 'franchise'}`,
    [scope.franchiseId, scope.tenantId],
  );

  const buildHeaders = useCallback(() => {
    const headers = new Headers({
      'Content-Type': 'application/json',
      'x-tenant-id': scope.tenantId || '',
      'x-franchise-id': scope.franchiseId || '',
      'x-user-id': scope.userId || '',
    });
    if (sessionAccessToken) {
      headers.set('Authorization', `Bearer ${sessionAccessToken}`);
    }
    return headers;
  }, [scope.franchiseId, scope.tenantId, scope.userId, sessionAccessToken]);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        sort_by: sortBy,
        sort_dir: sortDirection,
        search,
        status: statusFilter,
        priority: priorityFilter,
        aircraft_type: aircraftTypeFilter,
        compliance_state: complianceStateFilter,
      });
      const response = await fetch(`/api/v2/amro/aircraft-leads?${query.toString()}`, {
        method: 'GET',
        headers: buildHeaders(),
      });
      const payload = await parseApiPayload(response);
      if (!response.ok) {
        throw new Error(String(payload.error || 'Failed to load aircraft leads'));
      }
      const output = payload?.output && typeof payload.output === 'object' ? (payload.output as Record<string, unknown>) : {};
      const nextRows = (Array.isArray(output.records) ? output.records : []).map(normalizeLeadRecord);
      setRows(nextRows);
      setTotalCount(Number(output.total_count || 0));
      if (!selectedLeadId && nextRows.length > 0) {
        setSelectedLeadId(nextRows[0].id);
      }
      if (selectedLeadId && nextRows.every((row) => row.id !== selectedLeadId) && nextRows.length > 0) {
        setSelectedLeadId(nextRows[0].id);
      }
    } catch (fetchError) {
      setError(String((fetchError as Error).message || 'Failed to load aircraft leads'));
    } finally {
      setLoading(false);
    }
  }, [
    aircraftTypeFilter,
    buildHeaders,
    complianceStateFilter,
    page,
    pageSize,
    priorityFilter,
    search,
    selectedLeadId,
    sortBy,
    sortDirection,
    statusFilter,
  ]);

  const loadAutocomplete = useCallback(async () => {
    try {
      if (!search.trim()) {
        setAutocompleteOptions([]);
        return;
      }
      const query = new URLSearchParams({
        autocomplete: '1',
        search,
      });
      const response = await fetch(`/api/v2/amro/aircraft-leads?${query.toString()}`, {
        method: 'GET',
        headers: buildHeaders(),
      });
      const payload = await parseApiPayload(response);
      if (!response.ok) return;
      const output = payload?.output && typeof payload.output === 'object' ? (payload.output as Record<string, unknown>) : {};
      setAutocompleteOptions(Array.isArray(output.suggestions) ? output.suggestions.map((item: unknown) => String(item || '')) : []);
    } catch {
      setAutocompleteOptions([]);
    }
  }, [buildHeaders, search]);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadAutocomplete();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadAutocomplete]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(savedFiltersStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const normalized = parsed
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const record = item as Record<string, unknown>;
          return {
            id: String(record.id || ''),
            name: String(record.name || ''),
            filters: {
              status: String((record.filters as Record<string, unknown> | undefined)?.status || 'all'),
              priority: String((record.filters as Record<string, unknown> | undefined)?.priority || 'all'),
              aircraftType: String((record.filters as Record<string, unknown> | undefined)?.aircraftType || 'all'),
              complianceState: String((record.filters as Record<string, unknown> | undefined)?.complianceState || 'all'),
            },
          } satisfies SavedFilter;
        })
        .filter((item): item is SavedFilter => Boolean(item?.id && item?.name));
      setSavedFilters(normalized);
    } catch {
      setSavedFilters([]);
    }
  }, [savedFiltersStorageKey]);

  const selectedLead = useMemo(
    () => rows.find((row) => row.id === selectedLeadId) || null,
    [rows, selectedLeadId],
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / Number(pageSize || '25')));
  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));
  const themeStyle = useMemo(() => themeStyleFromPreset(activeTheme), [activeTheme]);
  const pipelineColumns = useMemo<ColumnType[]>(
    () => [
      { id: 'new', title: 'New' },
      { id: 'qualified', title: 'Qualified' },
      { id: 'in_progress', title: 'In Progress' },
      { id: 'closed', title: 'Closed' },
    ],
    [],
  );
  const pipelineItems = useMemo<KanbanItem[]>(
    () =>
      rows.map((row) => ({
        id: row.id,
        title: row.title || 'Untitled',
        subtitle: `${row.aircraft_registration || row.aircraft_id || '-'} · ${row.aircraft_type || '-'}`,
        status: row.status || 'new',
        priority: (row.priority as 'low' | 'medium' | 'high' | 'critical') || 'medium',
        value: row.score,
        assignee: row.assigned_to ? { name: row.assigned_to } : undefined,
        tags: row.tags,
        updatedAt: row.updated_at,
      })),
    [rows],
  );
  const analyticsLeads = useMemo<Lead[]>(
    () =>
      rows.map((row) => ({
        id: row.id,
        first_name: row.title || 'Lead',
        last_name: row.aircraft_registration || row.aircraft_id || 'Aircraft',
        email: '',
        company: row.aircraft_type || '',
        status: row.status || 'new',
        source: row.source || 'manual',
        estimated_value: Number(row.score || 0),
        created_at: row.created_at || new Date().toISOString(),
        updated_at: row.updated_at || new Date().toISOString(),
      })) as Lead[],
    [rows],
  );
  const rowCountByStatus = useMemo(
    () =>
      pipelineColumns.map((column) => ({
        id: column.id,
        label: column.title,
        value: rows.filter((row) => row.status === column.id).length,
      })),
    [pipelineColumns, rows],
  );

  useEffect(() => {
    if (!autoRefreshEnabled) {
      return;
    }
    const timer = window.setInterval(() => {
      void loadLeads();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [autoRefreshEnabled, loadLeads]);

  const applySavedFilters = useCallback((savedFilterId: string) => {
    if (savedFilterId === 'none') {
      return;
    }
    const savedFilter = savedFilters.find((entry) => entry.id === savedFilterId);
    if (!savedFilter) return;
    setStatusFilter(savedFilter.filters.status);
    setPriorityFilter(savedFilter.filters.priority);
    setAircraftTypeFilter(savedFilter.filters.aircraftType);
    setComplianceStateFilter(savedFilter.filters.complianceState);
    setPage(1);
    setSelectedSavedFilterId(savedFilterId);
  }, [savedFilters]);

  const handleSaveFilter = useCallback(() => {
    const name = savedFilterName.trim();
    if (!name) {
      toast.error('Filter name is required');
      return;
    }
    const entry: SavedFilter = {
      id: `${Date.now()}`,
      name,
      filters: {
        status: statusFilter,
        priority: priorityFilter,
        aircraftType: aircraftTypeFilter,
        complianceState: complianceStateFilter,
      },
    };
    const next = [...savedFilters, entry].slice(-20);
    setSavedFilters(next);
    setSavedFilterName('');
    localStorage.setItem(savedFiltersStorageKey, JSON.stringify(next));
    toast.success('Saved filter');
  }, [aircraftTypeFilter, complianceStateFilter, priorityFilter, savedFilterName, savedFilters, savedFiltersStorageKey, statusFilter]);

  const resetWizard = useCallback(() => {
    setWizardValues(DEFAULT_WIZARD_VALUES);
    setWizardErrors({});
    setWizardStep(1);
  }, []);

  const handleCreateWizard = useCallback(() => {
    setActiveTab('wizard');
    resetWizard();
  }, [resetWizard]);

  const handleEditWizard = useCallback(() => {
    if (!selectedLead) return;
    setWizardValues(mapLeadToWizardValues(selectedLead));
    setWizardErrors({});
    setWizardStep(1);
    setActiveTab('wizard');
  }, [selectedLead]);

  const handleWizardChange = useCallback((key: keyof AircraftLeadWizardValues, value: string) => {
    setWizardValues((previous) => ({
      ...previous,
      [key]: value,
    }));
    setWizardErrors((previous) => {
      if (!previous[key]) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  }, []);

  const handleNextStep = useCallback(() => {
    const errors = validateWizardStep(wizardValues, wizardStep);
    if (Object.keys(errors).length > 0) {
      setWizardErrors(errors);
      return;
    }
    setWizardErrors({});
    setWizardStep((previous) => Math.min(3, previous + 1));
  }, [wizardStep, wizardValues]);

  const handlePreviousStep = useCallback(() => {
    setWizardStep((previous) => Math.max(1, previous - 1));
  }, []);

  const handleSubmitWizard = useCallback(async () => {
    const stepOneErrors = validateWizardStep(wizardValues, 1);
    const stepTwoErrors = validateWizardStep(wizardValues, 2);
    const stepThreeErrors = validateWizardStep(wizardValues, 3);
    const errors = {
      ...stepOneErrors,
      ...stepTwoErrors,
      ...stepThreeErrors,
    };
    if (Object.keys(errors).length > 0) {
      setWizardErrors(errors);
      setWizardStep(1);
      return;
    }
    if (!canManage) {
      toast.error('You do not have permission to manage aircraft leads');
      return;
    }
    setWizardSubmitting(true);
    try {
      const body = {
        id: wizardValues.id || undefined,
        aircraft_id: wizardValues.aircraft_id,
        aircraft_registration: wizardValues.aircraft_registration,
        aircraft_type: wizardValues.aircraft_type,
        title: wizardValues.title,
        description: wizardValues.description,
        status: wizardValues.status,
        priority: wizardValues.priority,
        source: wizardValues.source,
        score: Number(wizardValues.score || '0'),
        assigned_to: wizardValues.assigned_to,
        maintenance_due_at: wizardValues.maintenance_due_at,
        next_action_due_at: wizardValues.next_action_due_at,
        compliance_state: wizardValues.compliance_state,
        regulatory_authority: wizardValues.regulatory_authority,
        tags: wizardValues.tags
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      };
      const method = wizardValues.id ? 'PUT' : 'POST';
      const response = await fetch('/api/v2/amro/aircraft-leads', {
        method,
        headers: buildHeaders(),
        body: JSON.stringify(body),
      });
      const payload = await parseApiPayload(response);
      if (!response.ok) {
        throw new Error(String(payload.error || 'Failed to save aircraft lead'));
      }
      toast.success(wizardValues.id ? 'Aircraft lead updated' : 'Aircraft lead created');
      setActiveTab('list');
      resetWizard();
      await loadLeads();
    } catch (saveError) {
      toast.error(String((saveError as Error).message || 'Failed to save aircraft lead'));
    } finally {
      setWizardSubmitting(false);
    }
  }, [buildHeaders, canManage, loadLeads, resetWizard, wizardValues]);

  const handleBulkStatusUpdate = useCallback(async (nextStatus: string) => {
    if (!canManage) {
      toast.error('You do not have permission to manage aircraft leads');
      return;
    }
    if (selectedIds.length === 0) {
      toast.error('Select at least one lead');
      return;
    }
    try {
      const response = await fetch('/api/v2/amro/aircraft-leads', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          operation: 'bulk_update_status',
          ids: selectedIds,
          status: nextStatus,
        }),
      });
      const payload = await parseApiPayload(response);
      if (!response.ok) {
        throw new Error(String(payload.error || 'Failed to update selected leads'));
      }
      toast.success('Selected leads updated');
      setSelectedIds([]);
      await loadLeads();
    } catch (bulkError) {
      toast.error(String((bulkError as Error).message || 'Failed to update selected leads'));
    }
  }, [buildHeaders, canManage, loadLeads, selectedIds]);

  const handleBulkDelete = useCallback(async () => {
    if (!canDelete) {
      toast.error('You do not have permission to delete aircraft leads');
      return;
    }
    if (selectedIds.length === 0) {
      toast.error('Select at least one lead');
      return;
    }
    try {
      const response = await fetch('/api/v2/amro/aircraft-leads', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          operation: 'bulk_delete',
          ids: selectedIds,
        }),
      });
      const payload = await parseApiPayload(response);
      if (!response.ok) {
        throw new Error(String(payload.error || 'Failed to delete selected leads'));
      }
      toast.success('Selected leads deleted');
      setSelectedIds([]);
      await loadLeads();
    } catch (bulkError) {
      toast.error(String((bulkError as Error).message || 'Failed to delete selected leads'));
    }
  }, [buildHeaders, canDelete, loadLeads, selectedIds]);

  const handleInlineUpdate = useCallback(
    async (row: AircraftLeadRecord, patch: Partial<AircraftLeadRecord>) => {
      if (!canManage) {
        toast.error('You do not have permission to manage aircraft leads');
        return;
      }
      const next = { ...row, ...patch };
      setRows((previous) => previous.map((item) => (item.id === row.id ? next : item)));
      try {
        const response = await fetch('/api/v2/amro/aircraft-leads', {
          method: 'PUT',
          headers: buildHeaders(),
          body: JSON.stringify({
            id: next.id,
            aircraft_id: next.aircraft_id,
            aircraft_registration: next.aircraft_registration,
            aircraft_type: next.aircraft_type,
            title: next.title,
            description: next.description,
            status: next.status,
            priority: next.priority,
            source: next.source,
            score: Number(next.score || 0),
            assigned_to: next.assigned_to,
            maintenance_due_at: next.maintenance_due_at,
            next_action_due_at: next.next_action_due_at,
            compliance_state: next.compliance_state,
            regulatory_authority: next.regulatory_authority,
            tags: next.tags,
          }),
        });
        const payload = await parseApiPayload(response);
        if (!response.ok) {
          throw new Error(String(payload.error || 'Failed to update lead'));
        }
      } catch (inlineUpdateError) {
        toast.error(String((inlineUpdateError as Error).message || 'Failed to update lead'));
        await loadLeads();
      }
    },
    [buildHeaders, canManage, loadLeads],
  );

  const handleSortChange = useCallback((nextSortBy: string) => {
    setSortBy((previousSortBy) => {
      if (previousSortBy === nextSortBy) {
        setSortDirection((previousDirection) => (previousDirection === 'asc' ? 'desc' : 'asc'));
        return previousSortBy;
      }
      setSortDirection('asc');
      return nextSortBy;
    });
  }, []);

  const handlePipelineDragEnd = useCallback(
    async (activeId: string, _overId: string, newStatus: string) => {
      const row = rows.find((item) => item.id === activeId);
      if (!row || row.status === newStatus) {
        return;
      }
      await handleInlineUpdate(row, { status: newStatus });
    },
    [handleInlineUpdate, rows],
  );

  const handleExport = useCallback(
    (format: 'csv' | 'excel') => {
      const headers = [...AIRCRAFT_LEAD_IMPORT_FIELDS];
      const payloadRows = rows.map((row) => ({
        ...row,
        tags: row.tags.join(', '),
      }));
      if (format === 'csv') {
        exportCsv(`aircraft-leads-${Date.now()}.csv`, headers as string[], payloadRows);
      } else {
        exportExcel(`aircraft-leads-${Date.now()}.xlsx`, headers as string[], payloadRows);
      }
      toast.success(`Aircraft leads exported to ${format.toUpperCase()}`);
    },
    [rows],
  );

  const handleImportFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const parsed = await parseFileRows(file);
      if (parsed.length < 2) {
        toast.error('Import file must include header and at least one data row');
        return;
      }
      const headers = parsed[0].map((header) => String(header || '').trim());
      const nextRows = parsed.slice(1).map((row) => {
        const record: Record<string, string> = {};
        headers.forEach((header, index) => {
          record[header] = String(row[index] || '').trim();
        });
        return record;
      });
      const guessedMapping: Record<string, string> = {};
      AIRCRAFT_LEAD_IMPORT_FIELDS.forEach((field) => {
        const normalizedField = field.toLowerCase();
        const bestHeader = headers.find((header) => header.toLowerCase().replace(/\s+/g, '_') === normalizedField);
        guessedMapping[field] = bestHeader || '';
      });
      setImportFileName(file.name);
      setImportHeaders(headers);
      setImportRows(nextRows);
      setFieldMapping(guessedMapping);
      toast.success(`Loaded ${nextRows.length} rows for mapping`);
    } catch (importError) {
      toast.error(String((importError as Error).message || 'Failed to parse import file'));
    }
  }, []);

  const handleSubmitImport = useCallback(async () => {
    if (!canManage) {
      toast.error('You do not have permission to import aircraft leads');
      return;
    }
    if (importRows.length === 0) {
      toast.error('Upload a CSV or Excel file first');
      return;
    }
    const required = ['title', 'aircraft_id'];
    const unmappedRequired = required.filter((field) => !fieldMapping[field]);
    if (unmappedRequired.length > 0) {
      toast.error(`Required mapping missing: ${unmappedRequired.join(', ')}`);
      return;
    }
    setImportSubmitting(true);
    try {
      const records = importRows.map((row) => {
        const mappedRecord: Record<string, unknown> = {};
        AIRCRAFT_LEAD_IMPORT_FIELDS.forEach((field) => {
          const sourceHeader = fieldMapping[field];
          if (!sourceHeader) {
            return;
          }
          mappedRecord[field] = row[sourceHeader] || '';
        });
        if (mappedRecord.tags && typeof mappedRecord.tags === 'string') {
          mappedRecord.tags = String(mappedRecord.tags)
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
        }
        return mappedRecord;
      });
      const response = await fetch('/api/v2/amro/aircraft-leads', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          operation: 'bulk_import',
          records,
        }),
      });
      const payload = await parseApiPayload(response);
      if (!response.ok) {
        throw new Error(String(payload.error || 'Failed to import aircraft leads'));
      }
      toast.success('Aircraft leads imported');
      setImportRows([]);
      setImportHeaders([]);
      setFieldMapping({});
      setImportFileName('');
      await loadLeads();
      setActiveTab('list');
    } catch (submitImportError) {
      toast.error(String((submitImportError as Error).message || 'Failed to import aircraft leads'));
    } finally {
      setImportSubmitting(false);
    }
  }, [buildHeaders, canManage, fieldMapping, importRows, loadLeads]);

  return (
    <Card className="mdm-template-panel" style={themeStyle}>
      <CardHeader className="mdm-template-panel-head">
        <CardTitle className="mdm-template-panel-title">Aircraft Leads Workspace</CardTitle>
      </CardHeader>
      <CardContent className="mdm-template-panel-body space-y-3">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AircraftLeadsTab)}>
          <TabsList className="h-8 flex-wrap">
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="list">List</TabsTrigger>
            <TabsTrigger value="grid">Grid</TabsTrigger>
            <TabsTrigger value="card">Card</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="import_export">Import/Export</TabsTrigger>
            <TabsTrigger value="detail" disabled={!selectedLead}>Detail</TabsTrigger>
            <TabsTrigger value="wizard">Wizard</TabsTrigger>
          </TabsList>
          <div className="mt-3 grid gap-2 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <Label htmlFor="aircraft-leads-theme" className="text-[11px]">Theme</Label>
              <Select value={activeTheme} onValueChange={setActiveTheme}>
                <SelectTrigger id="aircraft-leads-theme" className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {THEME_PRESETS.map((theme) => (
                    <SelectItem key={theme.name} value={theme.name}>{theme.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2 lg:col-span-3">
              <Switch id="aircraft-leads-auto-refresh" checked={autoRefreshEnabled} onCheckedChange={setAutoRefreshEnabled} />
              <Label htmlFor="aircraft-leads-auto-refresh" className="text-[11px]">Auto refresh (30s)</Label>
            </div>
            <div className="flex items-end gap-2 lg:col-span-5">
              <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => handleExport('csv')}>
                <Download className="mr-1 h-3.5 w-3.5" />
                Export CSV
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => handleExport('excel')}>
                <Download className="mr-1 h-3.5 w-3.5" />
                Export Excel
              </Button>
            </div>
          </div>
          <TabsContent value="pipeline" className="space-y-3 pt-3">
            {loading ? (
              <div className="grid gap-3 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={`pipeline-skeleton-${index}`} className="h-[320px] w-full" />
                ))}
              </div>
            ) : (
              <Suspense fallback={<Skeleton className="h-[360px] w-full" />}>
                <LazyKanbanBoard
                  columns={pipelineColumns}
                  items={pipelineItems}
                  onDragEnd={(activeId, overId, newStatus) => {
                    void handlePipelineDragEnd(activeId, overId, newStatus);
                  }}
                  onItemClick={(id) => {
                    setSelectedLeadId(id);
                    setActiveTab('detail');
                  }}
                  className="h-[460px]"
                  scrollPersistenceKey={`aircraft-leads-kanban:${scope.tenantId}:${scope.franchiseId}`}
                />
              </Suspense>
            )}
          </TabsContent>
          <TabsContent value="list" className="space-y-3 pt-3">
            <div className="grid gap-2 lg:grid-cols-12">
              <div className="lg:col-span-3">
                <Label className="text-[11px]">Search</Label>
                <Input
                  list="aircraft-leads-autocomplete"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search title, aircraft, assignee"
                  className="h-8 text-[12px]"
                />
                <datalist id="aircraft-leads-autocomplete">
                  {autocompleteOptions.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </div>
              <div className="lg:col-span-2">
                <Label className="text-[11px]">Status</Label>
                <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
                  <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="qualified">Qualified</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="lg:col-span-2">
                <Label className="text-[11px]">Priority</Label>
                <Select value={priorityFilter} onValueChange={(value) => { setPriorityFilter(value); setPage(1); }}>
                  <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="lg:col-span-2">
                <Label className="text-[11px]">Aircraft Type</Label>
                <Input
                  value={aircraftTypeFilter === 'all' ? '' : aircraftTypeFilter}
                  onChange={(event) => {
                    const value = event.target.value.trim();
                    setAircraftTypeFilter(value || 'all');
                    setPage(1);
                  }}
                  placeholder="A320, B737..."
                  className="h-8 text-[12px]"
                />
              </div>
              <div className="lg:col-span-3">
                <Label className="text-[11px]">Compliance State</Label>
                <Select value={complianceStateFilter} onValueChange={(value) => { setComplianceStateFilter(value); setPage(1); }}>
                  <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="monitoring">Monitoring</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="at_risk">At Risk</SelectItem>
                    <SelectItem value="compliant">Compliant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2 lg:grid-cols-12">
              <div className="lg:col-span-3">
                <Label className="text-[11px]">Saved Filter Name</Label>
                <Input value={savedFilterName} onChange={(event) => setSavedFilterName(event.target.value)} className="h-8 text-[12px]" placeholder="My filter" />
              </div>
              <div className="flex items-end gap-2 lg:col-span-2">
                <Button type="button" size="sm" variant="outline" className="h-8" onClick={handleSaveFilter}>
                  Save Filter
                </Button>
              </div>
              <div className="lg:col-span-3">
                <Label className="text-[11px]">Apply Saved Filter</Label>
                <Select value={selectedSavedFilterId} onValueChange={applySavedFilters}>
                  <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {savedFilters.map((entry) => (
                      <SelectItem key={entry.id} value={entry.id}>{entry.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="lg:col-span-2">
                <Label className="text-[11px]">Sort</Label>
                <Select value={sortBy} onValueChange={handleSortChange}>
                  <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AIRCRAFT_LEADS_SORT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="lg:col-span-2">
                <Label className="text-[11px]">Rows</Label>
                <div className="flex gap-2">
                  <Select value={pageSize} onValueChange={(value) => { setPageSize(value); setPage(1); }}>
                    <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => setSortDirection((previous) => (previous === 'asc' ? 'desc' : 'asc'))}>
                    {sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={handleCreateWizard} disabled={!canManage}>New Lead</Button>
              <Button size="sm" variant="outline" onClick={() => void loadLeads()}>Refresh</Button>
              {selectedIds.length > 0 ? (
                <>
                  <Badge variant="secondary">{selectedIds.length} selected</Badge>
                  <Button size="sm" variant="outline" onClick={() => void handleBulkStatusUpdate('qualified')} disabled={!canManage}>Bulk Qualify</Button>
                  <Button size="sm" variant="outline" onClick={() => void handleBulkStatusUpdate('in_progress')} disabled={!canManage}>Bulk In Progress</Button>
                  <Button size="sm" variant="destructive" onClick={() => void handleBulkDelete()} disabled={!canDelete}>Bulk Delete</Button>
                </>
              ) : null}
            </div>

            {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</div> : null}

            <div className="rounded-md border border-[hsl(var(--mdm-template-border))]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={(event) => {
                          if (event.target.checked) {
                            setSelectedIds(rows.map((row) => row.id));
                            return;
                          }
                          setSelectedIds([]);
                        }}
                      />
                    </TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Aircraft</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Compliance</TableHead>
                    <TableHead>Assignee</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className={selectedLeadId === row.id ? 'bg-muted/40' : ''}
                      onClick={() => {
                        setSelectedLeadId(row.id);
                        setActiveTab('detail');
                      }}
                    >
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(row.id)}
                          onChange={(event) => {
                            if (event.target.checked) {
                              setSelectedIds((previous) => [...previous, row.id]);
                              return;
                            }
                            setSelectedIds((previous) => previous.filter((id) => id !== row.id));
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-[12px] font-medium">{row.title || '-'}</TableCell>
                      <TableCell className="text-[12px]">{row.aircraft_registration || row.aircraft_id || '-'}</TableCell>
                      <TableCell className="text-[12px]">{row.aircraft_type || '-'}</TableCell>
                      <TableCell className="text-[12px]">{row.status || '-'}</TableCell>
                      <TableCell className="text-[12px]">{row.priority || '-'}</TableCell>
                      <TableCell className="text-[12px]">{row.maintenance_due_at ? String(row.maintenance_due_at).slice(0, 10) : '-'}</TableCell>
                      <TableCell className="text-[12px]">{row.compliance_state || '-'}</TableCell>
                      <TableCell className="text-[12px]">{row.assigned_to || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {!loading && rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-[12px] text-muted-foreground">
                        No leads found for current filters.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between text-[12px]">
              <p>
                Showing {(page - 1) * Number(pageSize) + (rows.length > 0 ? 1 : 0)}-{Math.min(page * Number(pageSize), totalCount)} of {totalCount}
              </p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-7 px-2" disabled={page <= 1} onClick={() => setPage((previous) => Math.max(1, previous - 1))}>Previous</Button>
                <span>Page {page} / {totalPages}</span>
                <Button size="sm" variant="outline" className="h-7 px-2" disabled={page >= totalPages} onClick={() => setPage((previous) => Math.min(totalPages, previous + 1))}>Next</Button>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="grid" className="space-y-3 pt-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Label className="text-[11px]">Columns</Label>
                <Select value={gridColumns} onValueChange={(value) => setGridColumns(value as '2' | '3' | '4')}>
                  <SelectTrigger className="h-8 w-[92px] text-[12px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" variant="outline" onClick={() => setActiveTab('wizard')} disabled={!canManage}>New Lead</Button>
            </div>
            <div className={gridColumns === '2' ? 'grid gap-3 md:grid-cols-2' : gridColumns === '3' ? 'grid gap-3 md:grid-cols-2 xl:grid-cols-3' : 'grid gap-3 md:grid-cols-2 xl:grid-cols-4'}>
              {rows.map((row) => (
                <Card key={`grid-${row.id}`} className="border border-[hsl(var(--mdm-template-border))]">
                  <CardContent className="space-y-2 p-3 text-[12px]">
                    <EditableText value={row.title || ''} onSave={async (value) => handleInlineUpdate(row, { title: value })} className="font-semibold" />
                    <p>{row.aircraft_registration || row.aircraft_id || '-'}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{row.status || 'new'}</Badge>
                      <Badge variant="outline">{row.priority || 'medium'}</Badge>
                    </div>
                    <EditableText value={row.assigned_to || ''} onSave={async (value) => handleInlineUpdate(row, { assigned_to: value })} placeholder="Assignee" />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7"
                      onClick={() => {
                        setSelectedLeadId(row.id);
                        setActiveTab('detail');
                      }}
                    >
                      Open Detail
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="card" className="space-y-3 pt-3">
            <div className="grid gap-2">
              {rows.map((row) => (
                <button
                  key={`card-${row.id}`}
                  type="button"
                  className="rounded-md border border-[hsl(var(--mdm-template-border))] p-3 text-left transition-colors hover:bg-muted/30"
                  onClick={() => {
                    setSelectedLeadId(row.id);
                    setActiveTab('detail');
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[13px] font-semibold">{row.title || 'Untitled'}</p>
                      <p className="text-[12px] text-muted-foreground">{row.aircraft_registration || row.aircraft_id || '-'} · {row.aircraft_type || '-'}</p>
                    </div>
                    <Badge variant="secondary">{row.status || 'new'}</Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[12px]">
                    <Badge variant="outline">{row.priority || 'medium'}</Badge>
                    <span>Score: {row.score}</span>
                    <span>Assignee: {row.assigned_to || '-'}</span>
                  </div>
                </button>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="analytics" className="space-y-3 pt-3">
            <div className="grid gap-3 md:grid-cols-4">
              {rowCountByStatus.map((metric) => (
                <Card key={`metric-${metric.id}`}>
                  <CardContent className="p-3">
                    <p className="text-[11px] text-muted-foreground">{metric.label}</p>
                    <p className="text-[18px] font-semibold">{metric.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Suspense fallback={<Skeleton className="h-[420px] w-full" />}>
              <LazyPipelineAnalytics leads={analyticsLeads} />
            </Suspense>
          </TabsContent>
          <TabsContent value="import_export" className="space-y-3 pt-3">
            <div className="flex flex-wrap items-end gap-2">
              <Button size="sm" variant="outline" onClick={() => handleExport('csv')}>
                <Download className="mr-1 h-3.5 w-3.5" />
                Export CSV
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleExport('excel')}>
                <Download className="mr-1 h-3.5 w-3.5" />
                Export Excel
              </Button>
              <Label htmlFor="aircraft-leads-import-file" className="inline-flex h-8 cursor-pointer items-center rounded-md border px-3 text-[12px]">
                <Upload className="mr-1 h-3.5 w-3.5" />
                Upload File
              </Label>
              <input id="aircraft-leads-import-file" type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(event) => void handleImportFileChange(event)} />
              <Button size="sm" onClick={() => void handleSubmitImport()} disabled={importSubmitting || importRows.length === 0 || !canManage}>
                Import Mapped Rows
              </Button>
            </div>
            {importFileName ? <p className="text-[12px] text-muted-foreground">Loaded file: {importFileName} ({importRows.length} rows)</p> : null}
            {importHeaders.length > 0 ? (
              <div className="grid gap-2 md:grid-cols-2">
                {AIRCRAFT_LEAD_IMPORT_FIELDS.map((field) => (
                  <div key={field} className="space-y-1">
                    <Label className="text-[11px]">{field}</Label>
                    <Select
                      value={fieldMapping[field] || 'unmapped'}
                      onValueChange={(value) => {
                        setFieldMapping((previous) => ({ ...previous, [field]: value === 'unmapped' ? '' : value }));
                      }}
                    >
                      <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unmapped">Unmapped</SelectItem>
                        {importHeaders.map((header) => (
                          <SelectItem key={`${field}-${header}`} value={header}>{header}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-muted-foreground">Upload a CSV/Excel file to map fields.</p>
            )}
          </TabsContent>

          <TabsContent value="detail" className="space-y-3 pt-3">
            {!selectedLead ? (
              <p className="text-[12px] text-muted-foreground">Select a lead from list view.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[15px] font-semibold">{selectedLead.title}</p>
                    <p className="text-[12px] text-muted-foreground">{selectedLead.aircraft_registration || selectedLead.aircraft_id} · {selectedLead.aircraft_type || 'Unknown Type'}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={handleEditWizard} disabled={!canManage}>Edit in Wizard</Button>
                </div>
                <Tabs value={detailTab} onValueChange={(value) => setDetailTab(value as 'overview' | 'compliance' | 'workflow')}>
                  <TabsList className="h-8">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="compliance">Compliance</TabsTrigger>
                    <TabsTrigger value="workflow">Workflow</TabsTrigger>
                  </TabsList>
                  <TabsContent value="overview" className="grid gap-2 pt-3 md:grid-cols-2">
                    <div className="rounded-md border bg-muted/20 p-2 text-[12px]">Status: <span className="font-semibold">{selectedLead.status}</span></div>
                    <div className="rounded-md border bg-muted/20 p-2 text-[12px]">Priority: <span className="font-semibold">{selectedLead.priority}</span></div>
                    <div className="rounded-md border bg-muted/20 p-2 text-[12px]">Score: <span className="font-semibold">{selectedLead.score}</span></div>
                    <div className="rounded-md border bg-muted/20 p-2 text-[12px]">Source: <span className="font-semibold">{selectedLead.source || '-'}</span></div>
                    <div className="rounded-md border bg-muted/20 p-2 text-[12px]">Assignee: <span className="font-semibold">{selectedLead.assigned_to || '-'}</span></div>
                    <div className="rounded-md border bg-muted/20 p-2 text-[12px]">Tags: <span className="font-semibold">{selectedLead.tags.join(', ') || '-'}</span></div>
                    <div className="rounded-md border bg-muted/20 p-2 text-[12px] md:col-span-2">Description: <span className="font-semibold">{selectedLead.description || '-'}</span></div>
                  </TabsContent>
                  <TabsContent value="compliance" className="grid gap-2 pt-3 md:grid-cols-2">
                    <div className="rounded-md border bg-muted/20 p-2 text-[12px]">Maintenance Due: <span className="font-semibold">{selectedLead.maintenance_due_at ? String(selectedLead.maintenance_due_at).slice(0, 10) : '-'}</span></div>
                    <div className="rounded-md border bg-muted/20 p-2 text-[12px]">Next Action Due: <span className="font-semibold">{selectedLead.next_action_due_at ? String(selectedLead.next_action_due_at).slice(0, 10) : '-'}</span></div>
                    <div className="rounded-md border bg-muted/20 p-2 text-[12px]">Compliance State: <span className="font-semibold">{selectedLead.compliance_state || '-'}</span></div>
                    <div className="rounded-md border bg-muted/20 p-2 text-[12px]">Regulatory Authority: <span className="font-semibold">{selectedLead.regulatory_authority || '-'}</span></div>
                  </TabsContent>
                  <TabsContent value="workflow" className="grid gap-2 pt-3 md:grid-cols-2">
                    <div className="rounded-md border bg-muted/20 p-2 text-[12px]">Created: <span className="font-semibold">{selectedLead.created_at ? new Date(selectedLead.created_at).toLocaleString() : '-'}</span></div>
                    <div className="rounded-md border bg-muted/20 p-2 text-[12px]">Updated: <span className="font-semibold">{selectedLead.updated_at ? new Date(selectedLead.updated_at).toLocaleString() : '-'}</span></div>
                    <div className="rounded-md border bg-muted/20 p-2 text-[12px] md:col-span-2">Aircraft Workflow: <span className="font-semibold">Inspection → Planning → Compliance Review → Work Package</span></div>
                  </TabsContent>
                </Tabs>
              </>
            )}
          </TabsContent>

          <TabsContent value="wizard" className="space-y-3 pt-3">
            <div className="flex items-center gap-2 text-[12px]">
              <Badge variant={wizardStep === 1 ? 'default' : 'secondary'}>Step 1</Badge>
              <Badge variant={wizardStep === 2 ? 'default' : 'secondary'}>Step 2</Badge>
              <Badge variant={wizardStep === 3 ? 'default' : 'secondary'}>Step 3</Badge>
            </div>

            {wizardStep === 1 ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-[11px]">Lead Title</Label>
                  <Input value={wizardValues.title} onChange={(event) => handleWizardChange('title', event.target.value)} className="h-8 text-[12px]" />
                  {wizardErrors.title ? <p className="text-[11px] text-red-600">{wizardErrors.title}</p> : null}
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Aircraft ID</Label>
                  <Input value={wizardValues.aircraft_id} onChange={(event) => handleWizardChange('aircraft_id', event.target.value)} className="h-8 text-[12px]" />
                  {wizardErrors.aircraft_id ? <p className="text-[11px] text-red-600">{wizardErrors.aircraft_id}</p> : null}
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Aircraft Registration</Label>
                  <Input value={wizardValues.aircraft_registration} onChange={(event) => handleWizardChange('aircraft_registration', event.target.value)} className="h-8 text-[12px]" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Source</Label>
                  <Select value={wizardValues.source} onValueChange={(value) => handleWizardChange('source', value)}>
                    <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="inspection">Inspection</SelectItem>
                      <SelectItem value="flight_log">Flight Log</SelectItem>
                      <SelectItem value="sensor_alert">Sensor Alert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : null}

            {wizardStep === 2 ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-[11px]">Aircraft Type</Label>
                  <Input value={wizardValues.aircraft_type} onChange={(event) => handleWizardChange('aircraft_type', event.target.value)} className="h-8 text-[12px]" />
                  {wizardErrors.aircraft_type ? <p className="text-[11px] text-red-600">{wizardErrors.aircraft_type}</p> : null}
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Maintenance Due</Label>
                  <Input type="date" value={wizardValues.maintenance_due_at} onChange={(event) => handleWizardChange('maintenance_due_at', event.target.value)} className="h-8 text-[12px]" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Compliance State</Label>
                  <Select value={wizardValues.compliance_state} onValueChange={(value) => handleWizardChange('compliance_state', value)}>
                    <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monitoring">Monitoring</SelectItem>
                      <SelectItem value="review">Review</SelectItem>
                      <SelectItem value="at_risk">At Risk</SelectItem>
                      <SelectItem value="compliant">Compliant</SelectItem>
                    </SelectContent>
                  </Select>
                  {wizardErrors.compliance_state ? <p className="text-[11px] text-red-600">{wizardErrors.compliance_state}</p> : null}
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Regulatory Authority</Label>
                  <Input value={wizardValues.regulatory_authority} onChange={(event) => handleWizardChange('regulatory_authority', event.target.value)} className="h-8 text-[12px]" />
                  {wizardErrors.regulatory_authority ? <p className="text-[11px] text-red-600">{wizardErrors.regulatory_authority}</p> : null}
                </div>
              </div>
            ) : null}

            {wizardStep === 3 ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-[11px]">Status</Label>
                  <Select value={wizardValues.status} onValueChange={(value) => handleWizardChange('status', value)}>
                    <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="qualified">Qualified</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                  {wizardErrors.status ? <p className="text-[11px] text-red-600">{wizardErrors.status}</p> : null}
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Priority</Label>
                  <Select value={wizardValues.priority} onValueChange={(value) => handleWizardChange('priority', value)}>
                    <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                  {wizardErrors.priority ? <p className="text-[11px] text-red-600">{wizardErrors.priority}</p> : null}
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Assignee</Label>
                  <Input value={wizardValues.assigned_to} onChange={(event) => handleWizardChange('assigned_to', event.target.value)} className="h-8 text-[12px]" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Score</Label>
                  <Input value={wizardValues.score} onChange={(event) => handleWizardChange('score', event.target.value)} className="h-8 text-[12px]" />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-[11px]">Next Action Due</Label>
                  <Input type="date" value={wizardValues.next_action_due_at} onChange={(event) => handleWizardChange('next_action_due_at', event.target.value)} className="h-8 text-[12px]" />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-[11px]">Description</Label>
                  <Textarea value={wizardValues.description} onChange={(event) => handleWizardChange('description', event.target.value)} className="text-[12px]" />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-[11px]">Tags (comma separated)</Label>
                  <Input value={wizardValues.tags} onChange={(event) => handleWizardChange('tags', event.target.value)} className="h-8 text-[12px]" />
                </div>
              </div>
            ) : null}

            <div className="flex justify-between">
              <Button size="sm" variant="outline" disabled={wizardStep === 1} onClick={handlePreviousStep}>Back</Button>
              <div className="flex gap-2">
                {wizardStep < 3 ? (
                  <Button size="sm" onClick={handleNextStep}>Next</Button>
                ) : (
                  <Button size="sm" onClick={() => void handleSubmitWizard()} disabled={wizardSubmitting || !canManage}>
                    {wizardValues.id ? 'Update Lead' : 'Create Lead'}
                  </Button>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default AircraftLeadsManager;
