import { useCallback, useEffect, useMemo, type RefObject, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Users } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type WorkPackageTaskSortColumn =
  | 'task_id'
  | 'code_form_no'
  | 'ata_code'
  | 'reference_amp'
  | 'description'
  | 'category_code'
  | 'estimated_man_hours'
  | 'is_mandatory';

type SortDirection = 'asc' | 'desc';

type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type ScopeContext = {
  tenantId: string;
  franchiseId: string;
};

type WorkPackageTemplateCreateSectionProps = {
  formValues: Record<string, unknown>;
  formErrors: Record<string, string>;
  setFieldValue: (fieldKey: string, value: unknown) => void;
  firstFieldRef: RefObject<HTMLInputElement>;
  modalOpen: boolean;
  scopedDb: unknown;
  scope: ScopeContext;
};

const MAINTENANCE_TYPE_OPTIONS: SelectOption[] = [
  { value: 'line', label: 'line' },
  { value: 'base', label: 'base' },
  { value: 'hangar', label: 'hangar' },
  { value: 'shop', label: 'shop' },
];

const DEFAULT_WORK_PACKAGE_TASK_FILTERS: Record<WorkPackageTaskSortColumn, string> = {
  task_id: '',
  code_form_no: '',
  ata_code: '',
  reference_amp: '',
  description: '',
  category_code: '',
  estimated_man_hours: '',
  is_mandatory: '',
};

export function WorkPackageTemplateCreateSection({
  formValues,
  formErrors,
  setFieldValue,
  firstFieldRef,
  modalOpen,
  scopedDb,
  scope,
}: WorkPackageTemplateCreateSectionProps) {
  const [workPackageTemplateTaskTemplates, setWorkPackageTemplateTaskTemplates] = useState<Record<string, unknown>[]>([]);
  const [workPackageTemplateTaskTemplatesLoading, setWorkPackageTemplateTaskTemplatesLoading] = useState(false);
  const [workPackageTemplateTaskTemplatesError, setWorkPackageTemplateTaskTemplatesError] = useState('');
  const [workPackageTemplateAircraftModelOptions, setWorkPackageTemplateAircraftModelOptions] = useState<SelectOption[]>([]);
  const [workPackageTemplateAircraftModelOptionsLoading, setWorkPackageTemplateAircraftModelOptionsLoading] = useState(false);
  const [workPackageTemplateAircraftModelOptionsError, setWorkPackageTemplateAircraftModelOptionsError] = useState('');
  const [workPackageTemplateSelectedTaskIds, setWorkPackageTemplateSelectedTaskIds] = useState<string[]>([]);
  const [workPackageTemplateTaskSortColumn, setWorkPackageTemplateTaskSortColumn] = useState<WorkPackageTaskSortColumn>('task_id');
  const [workPackageTemplateTaskSortDirection, setWorkPackageTemplateTaskSortDirection] = useState<SortDirection>('asc');
  const [workPackageTemplateTaskFilters, setWorkPackageTemplateTaskFilters] = useState<Record<WorkPackageTaskSortColumn, string>>(
    DEFAULT_WORK_PACKAGE_TASK_FILTERS,
  );
  const resolveWorkPackageTaskTemplateId = useCallback((task: Record<string, unknown>): string => {
    return String(task.id || '').trim();
  }, []);

  const loadWorkPackageTemplateTaskTemplates = useCallback(async () => {
    if (!scopedDb || !scope.tenantId) {
      setWorkPackageTemplateTaskTemplates([]);
      setWorkPackageTemplateTaskTemplatesError('');
      return;
    }
    setWorkPackageTemplateTaskTemplatesLoading(true);
    setWorkPackageTemplateTaskTemplatesError('');
    try {
      let query = (scopedDb as any)
        .from('task_templates')
        .select('id,task_template_id,tenant_id,franchise_id,code_form_no,ata_code,reference_amp,description,category_code,estimated_man_hours,is_mandatory,task_template_detail_json,task_template_scope_json')
        .eq('tenant_id', scope.tenantId);
      if (scope.franchiseId) {
        query = query.eq('franchise_id', scope.franchiseId);
      } else {
        query = query.is('franchise_id', null);
      }
      const { data, error } = await query.order('task_template_id', { ascending: true });
      if (error) {
        throw new Error(String(error.message || 'Failed to load task templates'));
      }
      setWorkPackageTemplateTaskTemplates(Array.isArray(data) ? (data as Record<string, unknown>[]) : []);
    } catch (error) {
      setWorkPackageTemplateTaskTemplates([]);
      setWorkPackageTemplateTaskTemplatesError(String((error as Error).message || 'Failed to load task templates'));
    } finally {
      setWorkPackageTemplateTaskTemplatesLoading(false);
    }
  }, [scope.franchiseId, scope.tenantId, scopedDb]);

  const loadWorkPackageTemplateAircraftModelOptions = useCallback(async () => {
    if (!scopedDb || !scope.tenantId) {
      setWorkPackageTemplateAircraftModelOptions([]);
      setWorkPackageTemplateAircraftModelOptionsError('');
      return;
    }
    setWorkPackageTemplateAircraftModelOptionsLoading(true);
    setWorkPackageTemplateAircraftModelOptionsError('');
    try {
      const { data, error } = await (scopedDb as any)
        .from('assembly_models')
        .select('id,name,model_code,is_active,tenant_id')
        .eq('tenant_id', scope.tenantId)
        .order('name', { ascending: true });
      if (error) {
        throw new Error(String(error.message || 'Failed to load aircraft models'));
      }
      const options = (Array.isArray(data) ? data : [])
        .map((record) => {
          const value = String(record.model_code || record.name || record.id || '').trim();
          if (!value) {
            return null;
          }
          const name = String(record.name || '').trim();
          const code = String(record.model_code || '').trim();
          const label = name && code && name !== code ? `${name} (${code})` : name || code || value;
          const active = String(record.is_active ?? 'true').toLowerCase() !== 'false';
          if (!active) {
            return null;
          }
          return { value, label };
        })
        .filter((option): option is SelectOption => Boolean(option));
      setWorkPackageTemplateAircraftModelOptions(options);
    } catch (error) {
      setWorkPackageTemplateAircraftModelOptions([]);
      setWorkPackageTemplateAircraftModelOptionsError(String((error as Error).message || 'Failed to load aircraft models'));
    } finally {
      setWorkPackageTemplateAircraftModelOptionsLoading(false);
    }
  }, [scope.tenantId, scopedDb]);

  useEffect(() => {
    if (!modalOpen) {
      return;
    }
    void loadWorkPackageTemplateTaskTemplates();
    void loadWorkPackageTemplateAircraftModelOptions();
  }, [loadWorkPackageTemplateAircraftModelOptions, loadWorkPackageTemplateTaskTemplates, modalOpen]);

  const workPackageTemplateAircraftModelSelectOptions = useMemo<SelectOption[]>(() => {
    const selectedModel = String(formValues.aircraft_model ?? '').trim();
    if (!selectedModel) {
      return workPackageTemplateAircraftModelOptions;
    }
    if (workPackageTemplateAircraftModelOptions.some((option) => option.value === selectedModel)) {
      return workPackageTemplateAircraftModelOptions;
    }
    return [{ value: selectedModel, label: selectedModel }, ...workPackageTemplateAircraftModelOptions];
  }, [formValues.aircraft_model, workPackageTemplateAircraftModelOptions]);

  useEffect(() => {
    if (!modalOpen) {
      return;
    }
    const currentModel = String(formValues.aircraft_model ?? '').trim();
    if (currentModel) {
      return;
    }
    const firstOption = workPackageTemplateAircraftModelSelectOptions[0];
    if (!firstOption?.value) {
      return;
    }
    setFieldValue('aircraft_model', firstOption.value);
  }, [formValues.aircraft_model, modalOpen, setFieldValue, workPackageTemplateAircraftModelSelectOptions]);

  const selectedWorkPackageAircraftModelTaskItems = useMemo(() => {
    const selectedModelValue = String(formValues.aircraft_model ?? '').trim().toLowerCase();
    if (!selectedModelValue) {
      return workPackageTemplateTaskTemplates;
    }
    const selectedModelOption = workPackageTemplateAircraftModelOptions.find((option) => String(option.value).trim().toLowerCase() === selectedModelValue);
    const selectedLabel = String(selectedModelOption?.label || '').trim().toLowerCase();
    const selectedCodeMatch = selectedLabel.match(/\(([^)]+)\)/);
    const selectedCode = String(selectedCodeMatch?.[1] || '').trim().toLowerCase();
    const rawTokens = [selectedModelValue, selectedLabel, selectedCode]
      .flatMap((token) => token.split(/[\s/(),_-]+/g))
      .map((token) => token.trim().toLowerCase())
      .filter(Boolean);
    const filterTokens = Array.from(new Set(rawTokens));
    const normalizedTokens = filterTokens.map((token) => token.replace(/[^a-z0-9]/g, ''));
    const matchesToken = (text: string) => {
      const normalized = text.toLowerCase();
      if (!normalized) {
        return false;
      }
      if (filterTokens.some((token) => normalized.includes(token))) {
        return true;
      }
      const compact = normalized.replace(/[^a-z0-9]/g, '');
      return normalizedTokens.some((token) => token && compact.includes(token));
    };
    return workPackageTemplateTaskTemplates.filter((task) => {
      const taskText = (() => {
        try {
          return JSON.stringify(task);
        } catch {
          return '';
        }
      })();
      return matchesToken(taskText);
    });
  }, [formValues.aircraft_model, workPackageTemplateAircraftModelOptions, workPackageTemplateTaskTemplates]);

  const selectedWorkPackageAircraftModelTaskRows = useMemo(() => {
    const filtered = selectedWorkPackageAircraftModelTaskItems.filter((task) => {
      const resolveValue = (column: WorkPackageTaskSortColumn): string => {
        if (column === 'is_mandatory') {
          return typeof task.is_mandatory === 'boolean' ? String(task.is_mandatory) : '';
        }
        if (column === 'task_id') {
          return String(task.task_template_id ?? task.task_id ?? '').toLowerCase();
        }
        return String(task[column] ?? '').toLowerCase();
      };
      return (Object.entries(workPackageTemplateTaskFilters) as Array<[WorkPackageTaskSortColumn, string]>).every(([column, rawFilter]) => {
        const normalizedFilter = rawFilter.trim().toLowerCase();
        if (!normalizedFilter) {
          return true;
        }
        return resolveValue(column).includes(normalizedFilter);
      });
    });
    return [...filtered].sort((left, right) => {
      const leftValue = workPackageTemplateTaskSortColumn === 'is_mandatory'
        ? String(typeof left.is_mandatory === 'boolean' ? left.is_mandatory : '').toLowerCase()
        : workPackageTemplateTaskSortColumn === 'task_id'
          ? String(left.task_template_id ?? left.task_id ?? '').toLowerCase()
          : String(left[workPackageTemplateTaskSortColumn] ?? '').toLowerCase();
      const rightValue = workPackageTemplateTaskSortColumn === 'is_mandatory'
        ? String(typeof right.is_mandatory === 'boolean' ? right.is_mandatory : '').toLowerCase()
        : workPackageTemplateTaskSortColumn === 'task_id'
          ? String(right.task_template_id ?? right.task_id ?? '').toLowerCase()
          : String(right[workPackageTemplateTaskSortColumn] ?? '').toLowerCase();
      if (leftValue === rightValue) {
        return 0;
      }
      const result = leftValue.localeCompare(rightValue, undefined, { numeric: true, sensitivity: 'base' });
      return workPackageTemplateTaskSortDirection === 'asc' ? result : -result;
    });
  }, [selectedWorkPackageAircraftModelTaskItems, workPackageTemplateTaskFilters, workPackageTemplateTaskSortColumn, workPackageTemplateTaskSortDirection]);

  const selectedWorkPackageAircraftModelTaskRowIds = useMemo(
    () => selectedWorkPackageAircraftModelTaskRows
      .map((task) => resolveWorkPackageTaskTemplateId(task))
      .filter((value) => value.length > 0),
    [resolveWorkPackageTaskTemplateId, selectedWorkPackageAircraftModelTaskRows],
  );

  const allWorkPackageTemplateTasksSelected = selectedWorkPackageAircraftModelTaskRowIds.length > 0
    && selectedWorkPackageAircraftModelTaskRowIds.every((id) => workPackageTemplateSelectedTaskIds.includes(id));

  const someWorkPackageTemplateTasksSelected = selectedWorkPackageAircraftModelTaskRowIds.some((id) => workPackageTemplateSelectedTaskIds.includes(id))
    && !allWorkPackageTemplateTasksSelected;

  const toggleWorkPackageTemplateTaskSort = useCallback((column: WorkPackageTaskSortColumn) => {
    if (workPackageTemplateTaskSortColumn === column) {
      setWorkPackageTemplateTaskSortDirection((previous) => (previous === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setWorkPackageTemplateTaskSortColumn(column);
    setWorkPackageTemplateTaskSortDirection('asc');
  }, [workPackageTemplateTaskSortColumn]);

  const setWorkPackageTemplateTaskFilterValue = useCallback((column: WorkPackageTaskSortColumn, value: string) => {
    setWorkPackageTemplateTaskFilters((previous) => ({ ...previous, [column]: value }));
  }, []);

  const taskTemplateById = useMemo(() => {
    return workPackageTemplateTaskTemplates.reduce((map, task) => {
      const id = resolveWorkPackageTaskTemplateId(task);
      if (!id) {
        return map;
      }
      map.set(id, task);
      return map;
    }, new Map<string, Record<string, unknown>>());
  }, [resolveWorkPackageTaskTemplateId, workPackageTemplateTaskTemplates]);

  const resolveSelectedWorkPackageTaskPayload = useCallback((selectedIds: string[]) => {
    return selectedIds
      .map((id) => String(id || '').trim())
      .filter((id) => id.length > 0)
      .map((id) => {
        const task = taskTemplateById.get(id);
        if (!task) {
          return {
            task_template_id: id,
          };
        }
        return {
          task_template_id: id,
          task_id: task.task_template_id ?? task.task_id ?? null,
          code_form_no: task.code_form_no ?? null,
          ata_code: task.ata_code ?? null,
          reference_amp: task.reference_amp ?? null,
          description: task.description ?? null,
        };
      });
  }, [taskTemplateById]);

  const toggleWorkPackageTemplateTaskSelection = useCallback((rowId: string, checked: boolean) => {
    setWorkPackageTemplateSelectedTaskIds((previous) => {
      const nextSelectedIds = checked
        ? (previous.includes(rowId) ? previous : [...previous, rowId])
        : previous.filter((id) => id !== rowId);
      setFieldValue('tasks_json', JSON.stringify(resolveSelectedWorkPackageTaskPayload(nextSelectedIds)));
      return nextSelectedIds;
    });
  }, [resolveSelectedWorkPackageTaskPayload, setFieldValue]);

  const toggleWorkPackageTemplateSelectAllTasks = useCallback((checked: boolean) => {
    setWorkPackageTemplateSelectedTaskIds((previous) => {
      const nextSelectedIds = checked
        ? Array.from(new Set([...previous, ...selectedWorkPackageAircraftModelTaskRowIds]))
        : previous.filter((id) => !selectedWorkPackageAircraftModelTaskRowIds.includes(id));
      setFieldValue('tasks_json', JSON.stringify(resolveSelectedWorkPackageTaskPayload(nextSelectedIds)));
      return nextSelectedIds;
    });
  }, [resolveSelectedWorkPackageTaskPayload, selectedWorkPackageAircraftModelTaskRowIds, setFieldValue]);

  const selectedWorkPackageTaskPayload = useMemo(() => {
    return resolveSelectedWorkPackageTaskPayload(workPackageTemplateSelectedTaskIds);
  }, [resolveSelectedWorkPackageTaskPayload, workPackageTemplateSelectedTaskIds]);

  useEffect(() => {
    const nextValue = JSON.stringify(selectedWorkPackageTaskPayload);
    const currentValue = (() => {
      const raw = formValues.tasks_json;
      if (typeof raw === 'string') {
        return raw.trim();
      }
      if (Array.isArray(raw) || (raw && typeof raw === 'object')) {
        try {
          return JSON.stringify(raw);
        } catch {
          return '';
        }
      }
      return '';
    })();
    if (nextValue !== currentValue) {
      setFieldValue('tasks_json', nextValue);
    }
  }, [formValues.tasks_json, selectedWorkPackageTaskPayload, setFieldValue]);

  useEffect(() => {
    if (!modalOpen) {
      setWorkPackageTemplateSelectedTaskIds([]);
      setWorkPackageTemplateTaskSortColumn('task_id');
      setWorkPackageTemplateTaskSortDirection('asc');
      setWorkPackageTemplateTaskFilters(DEFAULT_WORK_PACKAGE_TASK_FILTERS);
    }
  }, [modalOpen]);

  return (
    <div className="space-y-3 rounded-md bg-[#08a8bd] p-3 text-[12px]">
      <div className="flex flex-wrap items-center justify-between gap-2 text-white">
        <p className="font-semibold">Work Package Template Registry</p>
        <div className="flex items-center gap-2 text-[11px]">
          <Users className="h-3.5 w-3.5" />
          <span>Template authoring mode</span>
          <span>CRUD active</span>
        </div>
      </div>
      <div className="grid gap-3">
        <section className="overflow-hidden rounded bg-white">
          <div className="border-b border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-700">Work Package Details</div>
          <div className="grid gap-2 p-3 lg:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="wpt-template-code" className="text-[12px] font-medium text-slate-700">Template Code</Label>
              <Input
                id="wpt-template-code"
                ref={firstFieldRef}
                value={String(formValues.template_code ?? '')}
                onChange={(event) => setFieldValue('template_code', event.target.value)}
                className={cn('h-8 border-slate-300 bg-white px-2 text-[12px] text-slate-800', formErrors.template_code && 'border-destructive')}
                aria-invalid={Boolean(formErrors.template_code)}
                placeholder="WP-LINE-001"
              />
              {formErrors.template_code ? <p className="mdm-template-danger">{formErrors.template_code}</p> : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="wpt-version" className="text-[12px] font-medium text-slate-700">Version</Label>
              <Input
                id="wpt-version"
                type="number"
                min={1}
                value={String(formValues.version ?? '')}
                onChange={(event) => setFieldValue('version', event.target.value)}
                className={cn('h-8 border-slate-300 bg-white px-2 text-[12px] text-slate-800', formErrors.version && 'border-destructive')}
                aria-invalid={Boolean(formErrors.version)}
                placeholder="1"
              />
              {formErrors.version ? <p className="mdm-template-danger">{formErrors.version}</p> : null}
            </div>
            <div className="space-y-1 lg:col-span-2">
              <Label htmlFor="wpt-template-name" className="text-[12px] font-medium text-slate-700">Template Name</Label>
              <Input
                id="wpt-template-name"
                value={String(formValues.template_name ?? '')}
                onChange={(event) => setFieldValue('template_name', event.target.value)}
                className={cn('h-8 border-slate-300 bg-white px-2 text-[12px] text-slate-800', formErrors.template_name && 'border-destructive')}
                aria-invalid={Boolean(formErrors.template_name)}
                placeholder="Line Check Package"
              />
              {formErrors.template_name ? <p className="mdm-template-danger">{formErrors.template_name}</p> : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="wpt-aircraft-model" className="text-[12px] font-medium text-slate-700">Aircraft Model</Label>
              <select
                id="wpt-aircraft-model"
                value={String(formValues.aircraft_model ?? '')}
                onChange={(event) => setFieldValue('aircraft_model', event.target.value)}
                className={cn(
                  'h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-[12px] text-slate-800',
                  formErrors.aircraft_model && 'border-destructive',
                )}
                aria-invalid={Boolean(formErrors.aircraft_model)}
                disabled={workPackageTemplateAircraftModelOptionsLoading}
              >
                <option value="" hidden />
                {workPackageTemplateAircraftModelSelectOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {workPackageTemplateAircraftModelOptionsLoading ? <p className="text-[11px] text-slate-500">Loading aircraft models...</p> : null}
              {!workPackageTemplateAircraftModelOptionsLoading && !workPackageTemplateAircraftModelOptionsError && workPackageTemplateAircraftModelSelectOptions.length === 0 ? (
                <p className="text-[11px] text-slate-500">No aircraft models available</p>
              ) : null}
              {workPackageTemplateAircraftModelOptionsError ? <p className="mdm-template-danger">{workPackageTemplateAircraftModelOptionsError}</p> : null}
              {formErrors.aircraft_model ? <p className="mdm-template-danger">{formErrors.aircraft_model}</p> : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="wpt-maintenance-type" className="text-[12px] font-medium text-slate-700">Maintenance Type</Label>
              <Select value={String(formValues.maintenance_type ?? '')} onValueChange={(value) => setFieldValue('maintenance_type', value)}>
                <SelectTrigger
                  id="wpt-maintenance-type"
                  className={cn(
                    'h-8 border-slate-300 bg-white px-2 text-[12px] text-slate-800',
                    formErrors.maintenance_type && 'border-destructive',
                  )}
                  aria-invalid={Boolean(formErrors.maintenance_type)}
                >
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {MAINTENANCE_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.maintenance_type ? <p className="mdm-template-danger">{formErrors.maintenance_type}</p> : null}
            </div>
            <div className="flex items-end">
              <div className="flex h-8 items-center gap-2 rounded-md border border-slate-300 bg-white px-2 text-[12px] text-slate-700">
                <Checkbox
                  id="wpt-active"
                  checked={Boolean(formValues.active)}
                  onCheckedChange={(value) => setFieldValue('active', Boolean(value))}
                />
                <Label htmlFor="wpt-active" className="text-[12px] font-medium text-slate-700">Active</Label>
              </div>
            </div>
            <div className="space-y-1 lg:col-span-2">
              <Label htmlFor="wpt-policy-snapshot-id" className="text-[12px] font-medium text-slate-700">Policy Snapshot ID</Label>
              <Input
                id="wpt-policy-snapshot-id"
                value={String(formValues.policy_snapshot_id ?? '')}
                onChange={(event) => setFieldValue('policy_snapshot_id', event.target.value)}
                className="h-8 border-slate-300 bg-white px-2 text-[12px] text-slate-800"
                placeholder="POLICY-2026-001"
              />
            </div>
          </div>
        </section>
        <section className="overflow-hidden rounded bg-white">
          <div className="border-b border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-700">Selected Tasks</div>
          <div className="space-y-2 p-3">
            <div className="overflow-x-auto border border-slate-200">
              <table className="w-full text-[12px]">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-2 py-1.5 font-semibold">
                      <Checkbox
                        checked={allWorkPackageTemplateTasksSelected ? true : someWorkPackageTemplateTasksSelected ? 'indeterminate' : false}
                        onCheckedChange={(checked) => toggleWorkPackageTemplateSelectAllTasks(Boolean(checked))}
                        aria-label="Select all selected tasks rows"
                      />
                    </th>
                    <th className="px-2 py-1.5 font-semibold">
                      <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleWorkPackageTemplateTaskSort('task_id')}>
                        Task ID
                        {workPackageTemplateTaskSortColumn === 'task_id' ? (
                          workPackageTemplateTaskSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3" />}
                      </button>
                    </th>
                    <th className="px-2 py-1.5 font-semibold">
                      <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleWorkPackageTemplateTaskSort('code_form_no')}>
                        Code Form No
                        {workPackageTemplateTaskSortColumn === 'code_form_no' ? (
                          workPackageTemplateTaskSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3" />}
                      </button>
                    </th>
                    <th className="px-2 py-1.5 font-semibold">
                      <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleWorkPackageTemplateTaskSort('ata_code')}>
                        ATA Code
                        {workPackageTemplateTaskSortColumn === 'ata_code' ? (
                          workPackageTemplateTaskSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3" />}
                      </button>
                    </th>
                    <th className="px-2 py-1.5 font-semibold">
                      <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleWorkPackageTemplateTaskSort('reference_amp')}>
                        Reference AMP
                        {workPackageTemplateTaskSortColumn === 'reference_amp' ? (
                          workPackageTemplateTaskSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3" />}
                      </button>
                    </th>
                    <th className="px-2 py-1.5 font-semibold">
                      <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleWorkPackageTemplateTaskSort('description')}>
                        Description
                        {workPackageTemplateTaskSortColumn === 'description' ? (
                          workPackageTemplateTaskSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3" />}
                      </button>
                    </th>
                    <th className="px-2 py-1.5 font-semibold">
                      <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleWorkPackageTemplateTaskSort('category_code')}>
                        Category Code
                        {workPackageTemplateTaskSortColumn === 'category_code' ? (
                          workPackageTemplateTaskSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3" />}
                      </button>
                    </th>
                    <th className="px-2 py-1.5 font-semibold">
                      <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleWorkPackageTemplateTaskSort('estimated_man_hours')}>
                        Estimated Man Hours
                        {workPackageTemplateTaskSortColumn === 'estimated_man_hours' ? (
                          workPackageTemplateTaskSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3" />}
                      </button>
                    </th>
                    <th className="px-2 py-1.5 font-semibold">
                      <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleWorkPackageTemplateTaskSort('is_mandatory')}>
                        Is Mandatory
                        {workPackageTemplateTaskSortColumn === 'is_mandatory' ? (
                          workPackageTemplateTaskSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3" />}
                      </button>
                    </th>
                    <th className="px-2 py-1.5 font-semibold">JSON_Details</th>
                  </tr>
                  <tr className="border-t border-slate-200">
                    <th className="px-2 py-1.5 text-[11px] font-medium text-slate-500">Filter</th>
                    <th className="px-2 py-1.5"><Input value={workPackageTemplateTaskFilters.task_id} onChange={(event) => setWorkPackageTemplateTaskFilterValue('task_id', event.target.value)} className="h-7 border-slate-300 px-1.5 text-[11px]" placeholder="Filter Task ID" /></th>
                    <th className="px-2 py-1.5"><Input value={workPackageTemplateTaskFilters.code_form_no} onChange={(event) => setWorkPackageTemplateTaskFilterValue('code_form_no', event.target.value)} className="h-7 border-slate-300 px-1.5 text-[11px]" placeholder="Filter Code" /></th>
                    <th className="px-2 py-1.5"><Input value={workPackageTemplateTaskFilters.ata_code} onChange={(event) => setWorkPackageTemplateTaskFilterValue('ata_code', event.target.value)} className="h-7 border-slate-300 px-1.5 text-[11px]" placeholder="Filter ATA" /></th>
                    <th className="px-2 py-1.5"><Input value={workPackageTemplateTaskFilters.reference_amp} onChange={(event) => setWorkPackageTemplateTaskFilterValue('reference_amp', event.target.value)} className="h-7 border-slate-300 px-1.5 text-[11px]" placeholder="Filter Reference" /></th>
                    <th className="px-2 py-1.5"><Input value={workPackageTemplateTaskFilters.description} onChange={(event) => setWorkPackageTemplateTaskFilterValue('description', event.target.value)} className="h-7 border-slate-300 px-1.5 text-[11px]" placeholder="Filter Description" /></th>
                    <th className="px-2 py-1.5"><Input value={workPackageTemplateTaskFilters.category_code} onChange={(event) => setWorkPackageTemplateTaskFilterValue('category_code', event.target.value)} className="h-7 border-slate-300 px-1.5 text-[11px]" placeholder="Filter Category" /></th>
                    <th className="px-2 py-1.5"><Input value={workPackageTemplateTaskFilters.estimated_man_hours} onChange={(event) => setWorkPackageTemplateTaskFilterValue('estimated_man_hours', event.target.value)} className="h-7 border-slate-300 px-1.5 text-[11px]" placeholder="Filter Hours" /></th>
                    <th className="px-2 py-1.5"><Input value={workPackageTemplateTaskFilters.is_mandatory} onChange={(event) => setWorkPackageTemplateTaskFilterValue('is_mandatory', event.target.value)} className="h-7 border-slate-300 px-1.5 text-[11px]" placeholder="true / false" /></th>
                    <th className="px-2 py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {selectedWorkPackageAircraftModelTaskRows.length ? selectedWorkPackageAircraftModelTaskRows.map((task) => {
                    const rowId = resolveWorkPackageTaskTemplateId(task);
                    if (!rowId) {
                      return null;
                    }
                    return (
                    <tr key={rowId} className="border-t border-slate-100 text-slate-700">
                      <td className="px-2 py-1.5">
                        <Checkbox
                          checked={workPackageTemplateSelectedTaskIds.includes(rowId)}
                          onCheckedChange={(checked) => toggleWorkPackageTemplateTaskSelection(rowId, Boolean(checked))}
                          aria-label={`Select task row ${String(task.task_template_id || task.task_id || rowId)}`}
                        />
                      </td>
                      <td className="px-2 py-1.5">{String(task.task_template_id || task.task_id || '-')}</td>
                      <td className="px-2 py-1.5">{String(task.code_form_no || '-')}</td>
                      <td className="px-2 py-1.5">{String(task.ata_code || '-')}</td>
                      <td className="px-2 py-1.5">{String(task.reference_amp || '-')}</td>
                      <td className="px-2 py-1.5">{String(task.description || '-')}</td>
                      <td className="px-2 py-1.5">{String(task.category_code || '-')}</td>
                      <td className="px-2 py-1.5">{String(task.estimated_man_hours || '-')}</td>
                      <td className="px-2 py-1.5">{typeof task.is_mandatory === 'boolean' ? String(task.is_mandatory) : '-'}</td>
                      <td className="px-2 py-1.5">{typeof task.task_template_detail_json === 'object' && task.task_template_detail_json !== null ? JSON.stringify(task.task_template_detail_json) : String(task.task_template_detail_json || '-')}</td>
                    </tr>
                    );
                  }) : (
                    <tr>
                      <td className="px-2 py-2 text-slate-500" colSpan={10}>{workPackageTemplateTaskTemplatesLoading ? 'Loading task templates…' : 'No task rows available for selected aircraft model'}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="text-[11px] text-slate-500">
              Selection Summary: Checked {workPackageTemplateSelectedTaskIds.length} | Records: {selectedWorkPackageAircraftModelTaskRows.length}
            </div>
            {workPackageTemplateTaskTemplatesError ? <p className="mdm-template-danger">{workPackageTemplateTaskTemplatesError}</p> : null}
          </div>
        </section>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <section className="overflow-hidden rounded bg-white">
          <div className="border-b border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-700">Scope Definition</div>
          <div className="p-3">
            <Label htmlFor="wpt-scope-json" className="sr-only">Scope JSON</Label>
            <Textarea
              id="wpt-scope-json"
              value={String(formValues.scope_json ?? '')}
              onChange={(event) => setFieldValue('scope_json', event.target.value)}
              className={cn(
                'min-h-[118px] border-slate-300 bg-white px-2 py-1.5 text-[12px] text-slate-800',
                formErrors.scope_json && 'border-destructive',
              )}
              aria-invalid={Boolean(formErrors.scope_json)}
              placeholder='[{"phase":"inspection"}]'
            />
            {formErrors.scope_json ? <p className="mt-1 mdm-template-danger">{formErrors.scope_json}</p> : null}
          </div>
        </section>
        <section className="overflow-hidden rounded bg-white">
          <div className="border-b border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-700">Tasks JSON</div>
          <div className="p-3">
            <Label htmlFor="wpt-tasks-json" className="sr-only">Tasks JSON</Label>
            <Textarea
              id="wpt-tasks-json"
              value={String(formValues.tasks_json ?? '')}
              onChange={(event) => setFieldValue('tasks_json', event.target.value)}
              className={cn(
                'min-h-[118px] border-slate-300 bg-white px-2 py-1.5 text-[12px] text-slate-800',
                formErrors.tasks_json && 'border-destructive',
              )}
              aria-invalid={Boolean(formErrors.tasks_json)}
              placeholder='[{"task_number":"05-20","description":"Scheduled Maintenance Checks"}]'
            />
            {formErrors.tasks_json ? <p className="mt-1 mdm-template-danger">{formErrors.tasks_json}</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
