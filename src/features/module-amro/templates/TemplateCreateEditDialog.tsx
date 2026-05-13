/**
 * Template Create/Edit Dialog
 *
 * Full-featured form for creating/editing work package templates with:
 * - Core details (code, name, maintenance type, aircraft model)
 * - Task selection table with filtering/sorting
 * - Enterprise Materials+, Tooling+, Compliance+ editors
 * - Scope definition
 *
 * Note: Basic Materials/Tooling/Compliance tabs removed in favor of
 * enhanced Enterprise editors (Materials+, Tooling+, Compliance+)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Save, X, Wrench, FileText, Layers, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { WorkOrderTemplate, TaskTemplateOption, AircraftModelOption } from './AmroWorkOrderTemplatesPage';
import { fetchTaskTemplates } from './templateApi';
import { useAuth } from '@/hooks/useAuth';
// Enterprise editors
import { EnterpriseMaterialsEditor } from '../components/templates/EnterpriseMaterialsEditor';
import { EnterpriseToolingEditor } from '../components/templates/EnterpriseToolingEditor';
import { EnterpriseComplianceEditor } from '../components/templates/EnterpriseComplianceEditor';

// ── Types ──────────────────────────────────────────────────────────────────────

interface TemplateCreateEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: WorkOrderTemplate | null; // null = create mode
  onSuccess: () => void;
  aircraftModels: AircraftModelOption[];
  tenantId?: string; // Pass tenant ID for API calls
}

interface FormData {
  template_code: string;
  template_name: string;
  description: string;
  maintenance_type: string;
  model_id: string;
  aircraft_model: string;
  version: number;
  active: boolean;
  scope_json: string;
  tasks_json: any[];
  materials_json: any[];
  tooling_json: any[];
  compliance_requirements_json: any[];
}

const DEFAULT_FORM: FormData = {
  template_code: '',
  template_name: '',
  description: '',
  maintenance_type: 'line',
  model_id: '',
  aircraft_model: '',
  version: 1,
  active: true,
  scope_json: '[]',
  tasks_json: [],
  materials_json: [],
  tooling_json: [],
  compliance_requirements_json: [],
};

const MAINTENANCE_TYPES = [
  { value: 'line', label: 'Line Maintenance' },
  { value: 'base', label: 'Base Maintenance' },
  { value: 'component', label: 'Component Maintenance' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'overhaul', label: 'Overhaul' },
  { value: 'repair', label: 'Repair' },
  { value: 'upgrade', label: 'Upgrade' },
  { value: 'modification', label: 'Modification' },
] as const;

// ── Component ──────────────────────────────────────────────────────────────────

export function TemplateCreateEditDialog({
  open,
  onOpenChange,
  template,
  onSuccess,
  aircraftModels,
  tenantId,
}: TemplateCreateEditDialogProps) {
  const { session, user } = useAuth();
  const accessToken = session?.access_token || '';
  const userId = user?.id || '';
  
  const isEditMode = !!template;
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [form, setForm] = useState<FormData>(DEFAULT_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Task selection state
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplateOption[]>([]);
  const [taskLoading, setTaskLoading] = useState(false);
  const [taskSearch, setTaskSearch] = useState('');
  const [taskFilterCategory, setTaskFilterCategory] = useState('all');
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  // Task table advanced filter/sort state
  const [taskSort, setTaskSort] = useState<{ column: keyof TaskTemplateOption; direction: 'asc' | 'desc' }>({
    column: 'sequence',
    direction: 'asc',
  });
  const [taskFilters, setTaskFilters] = useState<Record<string, string>>({
    selected: '',
    id: '',
    code_form_no: '',
    ata_code: '',
    reference_amp: '',
    description: '',
    category_code: '',
    estimated_man_hours: '',
    is_mandatory: '',
  });

  // ── Initialize form on open ────────────────────────────────────────────────

  useEffect(() => {
    if (open) {
      if (template) {
        setForm({
          template_code: template.template_code,
          template_name: template.template_name,
          description: template.description || '',
          maintenance_type: template.maintenance_type,
          model_id: template.model_id || '',
          aircraft_model: template.aircraft_model || '',
          version: template.version,
          active: template.active,
          scope_json: JSON.stringify(template.scope_json || [], null, 2),
          tasks_json: template.tasks_json || [],
          materials_json: template.materials_json || [],
          tooling_json: template.tooling_json || [],
          compliance_requirements_json: template.compliance_requirements_json || [],
        });
        setSelectedTaskIds(new Set((template.tasks_json || []).map((t: any) => t.task_template_id || t.id).filter(Boolean)));
      } else {
        setForm(DEFAULT_FORM);
        setSelectedTaskIds(new Set());
      }
      setErrors({});
      setActiveTab('details');
    }
  }, [open, template]);

  // ── Load task templates when model is selected ─────────────────────────────

  useEffect(() => {
    if (!open || !form.model_id || !accessToken) {
      setTaskTemplates([]);
      return;
    }

    const load = async () => {
      setTaskLoading(true);
      try {
        const effectiveTenantId = tenantId || template?.tenant_id || '';
        const tasks = await fetchTaskTemplates(accessToken, effectiveTenantId, form.model_id);
        setTaskTemplates(tasks);
      } catch {
        setTaskTemplates([]);
      } finally {
        setTaskLoading(false);
      }
    };
    load();
  }, [open, form.model_id, accessToken, template?.tenant_id, tenantId]);

  // ── Task filtering ─────────────────────────────────────────────────────────

  const filteredTasks = useMemo(() => {
    const result = taskTemplates.filter(task => {
      // apply individual column filters
      if (taskFilters.selected) {
        const val = taskFilters.selected.trim().toUpperCase();
        const isSelected = selectedTaskIds.has(task.id);
        if (val === 'Y' && !isSelected) return false;
      }
      if (taskFilters.id && !task.sequence.toLowerCase().includes(taskFilters.id.toLowerCase()) && !task.id.toLowerCase().includes(taskFilters.id.toLowerCase())) return false;
      if (taskFilters.code_form_no && !task.code_form_no.toLowerCase().includes(taskFilters.code_form_no.toLowerCase())) return false;
      if (taskFilters.ata_code && !task.ata_code.toLowerCase().includes(taskFilters.ata_code.toLowerCase())) return false;
      if (taskFilters.reference_amp && !task.reference_amp.toLowerCase().includes(taskFilters.reference_amp.toLowerCase())) return false;
      if (taskFilters.description && !task.description.toLowerCase().includes(taskFilters.description.toLowerCase())) return false;
      if (taskFilters.category_code && !task.category_code.toLowerCase().includes(taskFilters.category_code.toLowerCase())) return false;
      if (taskFilters.estimated_man_hours && !String(task.estimated_man_hours).includes(taskFilters.estimated_man_hours)) return false;
      if (taskFilters.is_mandatory && !String(task.is_mandatory).toLowerCase().includes(taskFilters.is_mandatory.toLowerCase())) return false;
      return true;
    });

    result.sort((a, b) => {
      const aVal = a[taskSort.column];
      const bVal = b[taskSort.column];
      if (aVal === bVal) return 0;
      if (aVal == null) return taskSort.direction === 'asc' ? -1 : 1;
      if (bVal == null) return taskSort.direction === 'asc' ? 1 : -1;
      const cmp = aVal > bVal ? 1 : -1;
      return taskSort.direction === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [taskTemplates, taskFilters, taskSort, selectedTaskIds]);

  const uniqueCategories = useMemo(() => {
    const cats = new Set(taskTemplates.map(t => t.category_code).filter(Boolean));
    return Array.from(cats);
  }, [taskTemplates]);

  const toggleTaskSort = (column: keyof TaskTemplateOption) => {
    setTaskSort(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // ── Task selection ─────────────────────────────────────────────────────────

  const toggleTask = (taskId: string) => {
    const next = new Set(selectedTaskIds);
    if (next.has(taskId)) {
      next.delete(taskId);
    } else {
      next.add(taskId);
    }
    setSelectedTaskIds(next);
  };

  const selectAllTasks = () => {
    setSelectedTaskIds(new Set(filteredTasks.map(t => t.id)));
  };

  const deselectAllTasks = () => {
    setSelectedTaskIds(new Set());
  };

  // Sync selected tasks to form
  useEffect(() => {
    const selectedTasks = taskTemplates
      .filter(t => selectedTaskIds.has(t.id))
      .map(t => ({
        task_template_id: t.id,
        task_id: t.sequence,
        code_form_no: t.code_form_no,
        ata_code: t.ata_code,
        reference_amp: t.reference_amp,
        description: t.description,
        estimated_man_hours: t.estimated_man_hours,
        is_mandatory: t.is_mandatory,
        category_code: t.category_code,
      }));
    
    setForm(prev => ({ ...prev, tasks_json: selectedTasks }));
  }, [selectedTaskIds, taskTemplates]);

  // ── Form helpers ───────────────────────────────────────────────────────────

  const setField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: '' }));
  };

  const handleModelChange = (modelId: string) => {
    const model = aircraftModels.find(m => m.id === modelId);
    setField('model_id', modelId);
    setField('aircraft_model', model?.code || model?.name || '');
    setSelectedTaskIds(new Set()); // Reset task selection when model changes
  };

  // ── Validation ─────────────────────────────────────────────────────────────

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!form.template_code.trim()) newErrors.template_code = 'Template code is required';
    if (!form.template_name.trim()) newErrors.template_name = 'Template name is required';
    if (!form.maintenance_type) newErrors.maintenance_type = 'Maintenance type is required';
    if (form.version < 1) newErrors.version = 'Version must be at least 1';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!validate()) {
      toast.error('Please fix the errors before saving');
      return;
    }

    setLoading(true);
    try {
      // Parse JSON fields
      let scope_json: Record<string, unknown>;
      try {
        scope_json = JSON.parse(form.scope_json || '[]');
      } catch {
        toast.error('Invalid JSON in Scope Definition');
        return;
      }

      // Debug: Log what we're about to save
      console.log('=== SAVE DEBUG ===');
      console.log('Using enterprise materials data:', form.materials_json.length > 0);
      console.log('Using enterprise tooling data:', form.tooling_json.length > 0);
      console.log('Using enterprise compliance data:', form.compliance_requirements_json.length > 0);

      const payload: Record<string, unknown> = {
        tenant_id: tenantId || template?.tenant_id || '',
        template_code: form.template_code.trim(),
        template_name: form.template_name.trim(),
        description: form.description.trim() || null,
        maintenance_type: form.maintenance_type,
        model_id: form.model_id || null,
        version: form.version,
        active: form.active,
        scope_json,
        tasks_json: form.tasks_json,
        // ALWAYS use form state (enterprise editors update form state directly)
        materials_json: form.materials_json,
        tooling_json: form.tooling_json,
        compliance_requirements_json: form.compliance_requirements_json,
        // Express API requires aircraft_model as text
        aircraft_model: form.aircraft_model || 'All Models',
      };

      console.log('Final payload materials_json:', payload.materials_json);
      console.log('Final payload tooling_json:', payload.tooling_json);
      console.log('Final payload compliance:', payload.compliance_requirements_json);
      console.log('===================');

      const url = isEditMode
        ? `/api/v2/amro/master-data/work_order_templates/${template!.id}`
        : '/api/v2/amro/master-data/work_order_templates';

      const method = isEditMode ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      console.log('API Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API Error:', errorData);
        throw new Error(errorData.error || errorData.message || `Save failed: ${response.status}`);
      }

      const responseData = await response.json();
      console.log('API Response data:', responseData);

      toast.success(isEditMode ? 'Template updated' : 'Template created');
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save template');
    } finally {
      setLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Edit Template' : 'Create New Template'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? `Editing: ${template?.template_name}` 
              : 'Define a new reusable work package template for aircraft maintenance'
            }
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="details">
              <FileText className="h-4 w-4 mr-1" />
              Details
            </TabsTrigger>
            <div title={!form.model_id ? "Aircraft Model selection is required before accessing the Tasks Tab" : undefined}>
              <TabsTrigger value="tasks" disabled={!form.model_id}>
                <Wrench className="h-4 w-4 mr-1" />
                Tasks
              </TabsTrigger>
            </div>
            <TabsTrigger value="enterprise-materials" className="bg-green-50">
              <Layers className="h-4 w-4 mr-1" />
              Materials+
            </TabsTrigger>
            <TabsTrigger value="enterprise-tooling" className="bg-blue-50">
              <Layers className="h-4 w-4 mr-1" />
              Tooling+
            </TabsTrigger>
            <TabsTrigger value="enterprise-compliance" className="bg-purple-50">
              <Layers className="h-4 w-4 mr-1" />
              Compliance+
            </TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Template Code *</Label>
                <Input
                  value={form.template_code}
                  onChange={e => setField('template_code', e.target.value)}
                  placeholder="e.g., ACHK-737-001"
                  className={errors.template_code ? 'border-destructive' : ''}
                />
                {errors.template_code && <p className="text-xs text-destructive mt-1">{errors.template_code}</p>}
              </div>
              <div>
                <Label>Template Name *</Label>
                <Input
                  value={form.template_name}
                  onChange={e => setField('template_name', e.target.value)}
                  placeholder="e.g., Boeing 737 A-Check"
                  className={errors.template_name ? 'border-destructive' : ''}
                />
                {errors.template_name && <p className="text-xs text-destructive mt-1">{errors.template_name}</p>}
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={e => setField('description', e.target.value)}
                placeholder="Describe the purpose and scope of this template..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Maintenance Type *</Label>
                <Select value={form.maintenance_type} onValueChange={v => setField('maintenance_type', v)}>
                  <SelectTrigger className={errors.maintenance_type ? 'border-destructive' : ''}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MAINTENANCE_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.maintenance_type && <p className="text-xs text-destructive mt-1">{errors.maintenance_type}</p>}
              </div>
              <div>
                <Label>Aircraft Model</Label>
                <Select value={form.model_id} onValueChange={handleModelChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select model..." />
                  </SelectTrigger>
                  <SelectContent>
                    {aircraftModels.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name} ({m.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Version *</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.version}
                  onChange={e => setField('version', parseInt(e.target.value) || 1)}
                  className={errors.version ? 'border-destructive' : ''}
                />
                {errors.version && <p className="text-xs text-destructive mt-1">{errors.version}</p>}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="active"
                checked={form.active}
                onCheckedChange={v => setField('active', !!v)}
              />
              <Label htmlFor="active">Active (available for work package creation)</Label>
            </div>

            <Separator />

            <div>
              <Label>Scope Definition (JSON)</Label>
              <Textarea
                value={form.scope_json}
                onChange={e => setField('scope_json', e.target.value)}
                placeholder='[{"phase": "inspection", "description": "General visual inspection"}]'
                className="font-mono text-xs"
                rows={5}
              />
              <p className="text-xs text-muted-foreground mt-1">Define the scope phases and requirements for this template</p>
            </div>
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium">
                  Task Templates {form.aircraft_model ? `[${form.aircraft_model}]` : ''}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {selectedTaskIds.size} of {filteredTasks.length} tasks selected
                </p>
              </div>
            </div>

            {/* Task table */}
            {taskLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading tasks...</div>
            ) : taskTemplates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {form.model_id ? 'No tasks found for selected model' : 'Select an aircraft model to load tasks'}
              </div>
            ) : (
              <div className="border border-slate-200 rounded-md overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead className="bg-slate-50 text-left text-slate-700">
                    <tr className="border-b border-slate-200">
                      <th className="px-2 py-1.5 font-semibold w-10">
                        <Checkbox 
                          checked={filteredTasks.length > 0 && selectedTaskIds.size === filteredTasks.length} 
                          onCheckedChange={(c) => c ? selectAllTasks() : deselectAllTasks()} 
                        />
                      </th>
                      <th className="px-2 py-1.5 font-semibold">
                        <button type="button" className="inline-flex items-center gap-1 uppercase tracking-wide" onClick={() => toggleTaskSort('id')}>
                          Task ID
                          {taskSort.column === 'id' ? (taskSort.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3" />}
                        </button>
                      </th>
                      <th className="px-2 py-1.5 font-semibold">
                        <button type="button" className="inline-flex items-center gap-1 uppercase tracking-wide" onClick={() => toggleTaskSort('code_form_no')}>
                          Code Form No
                          {taskSort.column === 'code_form_no' ? (taskSort.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3" />}
                        </button>
                      </th>
                      <th className="px-2 py-1.5 font-semibold">
                        <button type="button" className="inline-flex items-center gap-1 uppercase tracking-wide" onClick={() => toggleTaskSort('ata_code')}>
                          ATA Code
                          {taskSort.column === 'ata_code' ? (taskSort.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3" />}
                        </button>
                      </th>
                      <th className="px-2 py-1.5 font-semibold">
                        <button type="button" className="inline-flex items-center gap-1 uppercase tracking-wide" onClick={() => toggleTaskSort('reference_amp')}>
                          Reference AMP
                          {taskSort.column === 'reference_amp' ? (taskSort.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3" />}
                        </button>
                      </th>
                      <th className="px-2 py-1.5 font-semibold">
                        <button type="button" className="inline-flex items-center gap-1 uppercase tracking-wide" onClick={() => toggleTaskSort('description')}>
                          Description
                          {taskSort.column === 'description' ? (taskSort.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3" />}
                        </button>
                      </th>
                      <th className="px-2 py-1.5 font-semibold">
                        <button type="button" className="inline-flex items-center gap-1 uppercase tracking-wide" onClick={() => toggleTaskSort('category_code')}>
                          Category Code
                          {taskSort.column === 'category_code' ? (taskSort.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3" />}
                        </button>
                      </th>
                      <th className="px-2 py-1.5 font-semibold">
                        <button type="button" className="inline-flex items-center gap-1 uppercase tracking-wide" onClick={() => toggleTaskSort('estimated_man_hours')}>
                          Estimated Man Hours
                          {taskSort.column === 'estimated_man_hours' ? (taskSort.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3" />}
                        </button>
                      </th>
                      <th className="px-2 py-1.5 font-semibold">
                        <button type="button" className="inline-flex items-center gap-1 uppercase tracking-wide" onClick={() => toggleTaskSort('is_mandatory')}>
                          Is Mandatory
                          {taskSort.column === 'is_mandatory' ? (taskSort.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3" />}
                        </button>
                      </th>
                      <th className="px-2 py-1.5 font-semibold">JSON_Details</th>
                    </tr>
                    <tr className="border-t border-slate-200 bg-slate-100/60">
                      <th className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        <Select value={taskFilters.selected} onValueChange={(val) => setTaskFilters(p => ({ ...p, selected: val === 'all' ? '' : val }))}>
                          <SelectTrigger className="h-7 w-16 border-slate-300 px-1.5 text-[11px]">
                            <SelectValue placeholder="Y/N" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="Y">Y</SelectItem>
                            <SelectItem value="N">N</SelectItem>
                          </SelectContent>
                        </Select>
                      </th>
                      <th className="px-2 py-1.5"><Input value={taskFilters.id} onChange={(e) => setTaskFilters(p => ({ ...p, id: e.target.value }))} className="h-7 border-slate-300 px-1.5 text-[11px]" placeholder="Filter Task ID" /></th>
                      <th className="px-2 py-1.5"><Input value={taskFilters.code_form_no} onChange={(e) => setTaskFilters(p => ({ ...p, code_form_no: e.target.value }))} className="h-7 border-slate-300 px-1.5 text-[11px]" placeholder="Filter Code" /></th>
                      <th className="px-2 py-1.5"><Input value={taskFilters.ata_code} onChange={(e) => setTaskFilters(p => ({ ...p, ata_code: e.target.value }))} className="h-7 border-slate-300 px-1.5 text-[11px]" placeholder="Filter ATA" /></th>
                      <th className="px-2 py-1.5"><Input value={taskFilters.reference_amp} onChange={(e) => setTaskFilters(p => ({ ...p, reference_amp: e.target.value }))} className="h-7 border-slate-300 px-1.5 text-[11px]" placeholder="Filter Reference" /></th>
                      <th className="px-2 py-1.5"><Input value={taskFilters.description} onChange={(e) => setTaskFilters(p => ({ ...p, description: e.target.value }))} className="h-7 border-slate-300 px-1.5 text-[11px]" placeholder="Filter Description" /></th>
                      <th className="px-2 py-1.5"><Input value={taskFilters.category_code} onChange={(e) => setTaskFilters(p => ({ ...p, category_code: e.target.value }))} className="h-7 border-slate-300 px-1.5 text-[11px]" placeholder="Filter Category" /></th>
                      <th className="px-2 py-1.5"><Input value={taskFilters.estimated_man_hours} onChange={(e) => setTaskFilters(p => ({ ...p, estimated_man_hours: e.target.value }))} className="h-7 border-slate-300 px-1.5 text-[11px]" placeholder="Filter Hours" /></th>
                      <th className="px-2 py-1.5"><Input value={taskFilters.is_mandatory} onChange={(e) => setTaskFilters(p => ({ ...p, is_mandatory: e.target.value }))} className="h-7 border-slate-300 px-1.5 text-[11px]" placeholder="true / false" /></th>
                      <th className="px-2 py-1.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.length ? filteredTasks.map((task) => (
                      <tr key={task.id} className={`border-t border-slate-100 text-slate-700 ${selectedTaskIds.has(task.id) ? 'bg-sky-50/60' : ''}`}>
                        <td className="px-2 py-1.5">
                          <Checkbox checked={selectedTaskIds.has(task.id)} onCheckedChange={() => toggleTask(task.id)} />
                        </td>
                        <td className="px-2 py-1.5 font-mono">{task.sequence || task.id || '-'}</td>
                        <td className="px-2 py-1.5">{task.code_form_no || '-'}</td>
                        <td className="px-2 py-1.5">{task.ata_code || '-'}</td>
                        <td className="px-2 py-1.5">{task.reference_amp || '-'}</td>
                        <td className="px-2 py-1.5">{task.description || '-'}</td>
                        <td className="px-2 py-1.5">{task.category_code || '-'}</td>
                        <td className="px-2 py-1.5">{task.estimated_man_hours || '-'}</td>
                        <td className="px-2 py-1.5">{String(task.is_mandatory ?? '-')}</td>
                        <td className="px-2 py-1.5">-</td>
                      </tr>
                    )) : (
                      <tr>
                        <td className="px-2 py-2 text-slate-500 text-center" colSpan={10}>No task rows available for selected aircraft model</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <div className="text-[11px] text-slate-500">
              Selection Summary: Checked {selectedTaskIds.size} | Records: {filteredTasks.length}
            </div>
          </TabsContent>

          {/* Enterprise Materials Tab */}
          <TabsContent value="enterprise-materials" className="space-y-4 pt-4">
            <EnterpriseMaterialsEditor
              materials={form.materials_json}
              onChange={(materials) => setField('materials_json', materials)}
              workOrderTemplateId={template?.id}
              readOnly={false}
            />
          </TabsContent>

          {/* Enterprise Tooling Tab */}
          <TabsContent value="enterprise-tooling" className="space-y-4 pt-4">
            <EnterpriseToolingEditor
              tools={form.tooling_json}
              onChange={(tools) => setField('tooling_json', tools)}
              readOnly={false}
            />
          </TabsContent>

          {/* Enterprise Compliance Tab */}
          <TabsContent value="enterprise-compliance" className="space-y-4 pt-4">
            <EnterpriseComplianceEditor
              requirements={form.compliance_requirements_json}
              onChange={(requirements) => setField('compliance_requirements_json', requirements)}
              readOnly={false}
            />
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? (
              <>Saving...</>
            ) : (
              <>
                <Save className="h-4 w-4 mr-1" />
                {isEditMode ? 'Update Template' : 'Create Template'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
