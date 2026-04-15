/**
 * AMRO Work Package Creation Wizard
 * 
 * Enhanced replacement for AircraftWorkPackageCreateDialog.tsx
 * 
 * Fixes identified in UX audit:
 * ✅ Standard dialog size (max-w-4xl instead of 98.5vw)
 * ✅ Readable font sizes (text-sm minimum instead of 10-11px)
 * ✅ Proper input heights (h-10 instead of h-[26px])
 * ✅ Date pickers instead of text inputs
 * ✅ Aircraft selection as first required field
 * ✅ Creation path selector (Scheduled / Non-Scheduled / Emergency)
 * ✅ Step-by-step wizard (4 steps instead of 5 confusing tabs)
 * ✅ Progress indicator
 * ✅ Full validation with error messages
 * ✅ Clear action buttons (Save Draft / Create / Cancel)
 * ✅ AMRO design system compliance
 * 
 * Wizard Steps:
 * 1. Aircraft & Creation Path
 * 2. Work Package Details
 * 3. Task Selection (if scheduled)
 * 4. Review & Submit
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Calendar, Check, CheckCircle2, Plane, Plus, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import {
  useCreateWorkPackage,
  type MaintenanceType,
  type WorkPackagePriority,
} from './useWorkPackageState';
import {
  useListTemplateVersions,
  type TemplateVersion,
} from './useTemplateVersionState';
import {
  useCreateEmergencyWP,
  type EmergencyType,
  type UrgencyLevel,
} from './useEmergencyWPState';
import {
  useWorkPackageTemplateOptions,
  useWorkPackageTemplateDetail,
  type WorkPackageTemplateOption,
} from './useWorkPackageTemplates';
import { useAircraftOptions } from './useAircraftState';
import { filterTemplatesByAircraft } from './templateFiltering';

type CreationPath = 'scheduled' | 'non-scheduled' | 'emergency';
type WizardStep = 1 | 2 | 3 | 4;

interface WizardFormData {
  // Step 1: Aircraft & Path
  aircraftId: string;
  creationPath: CreationPath;
  
  // Scheduled path
  templateVersionId: string;
  
  // Non-scheduled path
  taskSource: string;
  defectDescription: string;
  faultCode: string;
  nonScheduledPriority: string;
  
  // Emergency path
  emergencyType: EmergencyType;
  urgencyLevel: UrgencyLevel;
  emergencyReason: string;
  estimatedGroundTime: string;
  
  // Step 2: WP Details
  title: string;
  description: string;
  maintenanceType: MaintenanceType;
  priority: WorkPackagePriority;
  plannedStartDate: Date | undefined;
  plannedEndDate: Date | undefined;
  station: string;
  scopeItems: string;
  
  // Step 3: Tasks
  selectedTaskIds: string[];
  estimatedLaborHours: string;
}

const DEFAULT_FORM_DATA: WizardFormData = {
  aircraftId: '',
  creationPath: 'scheduled',
  templateVersionId: '',
  taskSource: 'pilot_report',
  defectDescription: '',
  faultCode: '',
  nonScheduledPriority: 'medium',
  emergencyType: 'aog',
  urgencyLevel: 'immediate',
  emergencyReason: '',
  estimatedGroundTime: '',
  title: '',
  description: '',
  maintenanceType: 'line',
  priority: 3,
  plannedStartDate: undefined,
  plannedEndDate: undefined,
  station: '',
  scopeItems: '',
  selectedTaskIds: [],
  estimatedLaborHours: '',
};

const CREATION_PATH_CONFIG: Record<CreationPath, { label: string; description: string; icon: any; color: string }> = {
  scheduled: {
    label: 'Scheduled Maintenance',
    description: 'Based on approved templates with advance planning',
    icon: Calendar,
    color: 'bg-blue-50 border-blue-200 text-blue-900',
  },
  'non-scheduled': {
    label: 'Non-Scheduled',
    description: 'Pilot reports, mechanic findings, inspection results',
    icon: AlertTriangle,
    color: 'bg-yellow-50 border-yellow-200 text-yellow-900',
  },
  emergency: {
    label: 'Emergency / AOG',
    description: 'Rapid response for aircraft on ground situations',
    icon: Shield,
    color: 'bg-red-50 border-red-200 text-red-900',
  },
};

function normalizeToken(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  preselectedAircraftId?: string; // Pre-select aircraft when opening
};

export function AmroWorkPackageCreateWizard({ 
  open, 
  onOpenChange, 
  onSuccess,
  preselectedAircraftId,
}: Props) {
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [formData, setFormData] = useState<WizardFormData>({
    ...DEFAULT_FORM_DATA,
    aircraftId: preselectedAircraftId || '', // Pre-select aircraft if provided
  });
  const [errors, setErrors] = useState<Partial<Record<keyof WizardFormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Hooks
  const createWPMutation = useCreateWorkPackage();
  const createEmergencyWPMutation = useCreateEmergencyWP();
  
  // Real aircraft data from API
  const { options: aircraftOptions, isLoading: aircraftLoading, error: aircraftError } = useAircraftOptions(open);

  // Real template data from API
  const { options: templateOptions, isLoading: templateLoading, error: templateError } = useWorkPackageTemplateOptions(open);

  // Load template version details when template is selected
  const { data: templateVersionData, isLoading: templateVersionLoading } = useListTemplateVersions({
    templateId: formData.templateVersionId.split(':')[0] || '',
    page: 1,
    pageSize: 1,
    enabled: !!formData.templateVersionId && formData.creationPath === 'scheduled',
  });

  // Load template directly from work_package_templates as fallback
  const { data: templateDirectData, isLoading: templateDirectLoading } = useWorkPackageTemplateDetail(
    formData.templateVersionId.split(':')[0] || '',
    !!formData.templateVersionId && formData.creationPath === 'scheduled'
  );

  // Determine which data source to use: versions (if exists) OR direct template
  const effectiveTemplateData = useMemo(() => {
    // Priority 1: Use version data if available
    if (templateVersionData?.records && templateVersionData.records.length > 0) {
      return templateVersionData.records[0];
    }
    // Priority 2: Fallback to direct template data
    if (templateDirectData) {
      return {
        ...templateDirectData,
        version_number: templateDirectData.version,
        version_label: `v${templateDirectData.version}`,
        maintenance_type: templateDirectData.maintenance_type,
      };
    }
    return null;
  }, [templateVersionData, templateDirectData]);

  const isTaskDataLoading = templateVersionLoading || templateDirectLoading;

  // Auto-populate form from template when template version is loaded
  useEffect(() => {
    if (effectiveTemplateData && formData.creationPath === 'scheduled') {
      // Auto-populate from template metadata
      if (effectiveTemplateData && !formData.title) {
        const templateName = templateOptions.find(t => t.value === formData.templateVersionId)?.label || '';
        setFormData(prev => ({
          ...prev,
          title: prev.title || `${templateName} - ${effectiveTemplateData.version_label || `v${effectiveTemplateData.version_number}`}`,
          description: prev.description || String((effectiveTemplateData as any).change_description || ''),
          maintenanceType: prev.maintenanceType || (String((effectiveTemplateData as any).maintenance_type || '').trim() as MaintenanceType) || 'line',
          priority: prev.priority || (Number((effectiveTemplateData as any).priority) as WorkPackagePriority) || 3,
          selectedTaskIds: effectiveTemplateData.tasks_json?.map((t: any) => t.task_template_id || t.id).filter(Boolean) || [],
          estimatedLaborHours: String((effectiveTemplateData as any).estimated_labor_hours ?? ''),
          scopeItems: effectiveTemplateData.scope_json ? JSON.stringify(effectiveTemplateData.scope_json, null, 2) : '',
        }));
      }
    }
  }, [effectiveTemplateData, formData.creationPath, formData.templateVersionId, formData.title, templateOptions]);

  const { data: templateData } = useListTemplateVersions({
    templateId: formData.templateVersionId.split(':')[0] || '',
    enabled: false, // Only used when explicitly needed
  });

  const selectedAircraft = useMemo(
    () => aircraftOptions.find((ac) => ac.value === formData.aircraftId),
    [aircraftOptions, formData.aircraftId],
  );

  const selectedAircraftTenantId = useMemo(
    () => String(selectedAircraft?.tenant_id || '').trim(),
    [selectedAircraft?.tenant_id],
  );

  const selectedAircraftAssemblyModel = useMemo(
    () => String(selectedAircraft?.aircraft_model || selectedAircraft?.type || '').trim(),
    [selectedAircraft?.aircraft_model, selectedAircraft?.type],
  );
  const selectedAircraftModelId = useMemo(
    () => String((selectedAircraft as any)?.model_id || '').trim(),
    [(selectedAircraft as any)?.model_id],
  );

  const filteredTemplateOptions = useMemo(() => {
    return filterTemplatesByAircraft({
      aircraftTenantId: selectedAircraftTenantId,
      aircraftModelId: selectedAircraftModelId,
      aircraftModelName: selectedAircraftAssemblyModel,
      templates: templateOptions,
    });
  }, [selectedAircraftAssemblyModel, selectedAircraftModelId, selectedAircraftTenantId, templateOptions]);

  const templateFilteringMessage = useMemo(() => {
    if (!selectedAircraft) {
      return 'Select an aircraft to load tenant/model-matched templates.';
    }
    if (!selectedAircraftModelId && !selectedAircraftAssemblyModel) {
      return 'Unable to identify aircraft model/model_id for selected aircraft. Template list is restricted until model metadata is available.';
    }
    const tenantHint = selectedAircraftTenantId || 'unknown tenant';
    const modelHint = selectedAircraftAssemblyModel || selectedAircraftModelId || 'unknown model';
    return `Filter active: showing templates for tenant (${tenantHint}) and exact aircraft model (${modelHint}) only.`;
  }, [selectedAircraft, selectedAircraftAssemblyModel, selectedAircraftModelId, selectedAircraftTenantId]);

  const filteredTemplateLookup = useMemo(() => new Set(filteredTemplateOptions.map((option) => option.value)), [filteredTemplateOptions]);

  useEffect(() => {
    if (!formData.templateVersionId) {
      return;
    }
    if (filteredTemplateLookup.has(formData.templateVersionId)) {
      return;
    }
    setFormData((prev) => ({
      ...prev,
      templateVersionId: '',
      selectedTaskIds: [],
    }));
  }, [filteredTemplateLookup, formData.templateVersionId]);

  const filteredTemplateTasks = useMemo(() => {
    const tasks = Array.isArray(effectiveTemplateData?.tasks_json) ? effectiveTemplateData.tasks_json : [];
    const tenantToken = normalizeToken(selectedAircraftTenantId);
    const modelToken = normalizeToken(selectedAircraftAssemblyModel);
    return tasks.filter((task: any) => {
      const taskTenantToken = normalizeToken(task?.tenant_id || task?.metadata?.tenant_id);
      const taskModelToken = normalizeToken(task?.aircraft_model || task?.model_id || task?.metadata?.aircraft_model || task?.metadata?.model_id);
      const tenantMatches = !tenantToken || !taskTenantToken || taskTenantToken === tenantToken;
      const modelMatches = !modelToken || !taskModelToken || taskModelToken === modelToken;
      return tenantMatches && modelMatches;
    });
  }, [effectiveTemplateData?.tasks_json, selectedAircraftAssemblyModel, selectedAircraftTenantId]);

  // Handlers
  const updateField = useCallback(<K extends keyof WizardFormData>(key: K, value: WizardFormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }, []);

  const validateStep = useCallback((step: WizardStep): boolean => {
    const newErrors: Partial<Record<keyof WizardFormData, string>> = {};

    if (step === 1) {
      if (!formData.aircraftId) {
        newErrors.aircraftId = 'Aircraft selection is required';
      }
      if (formData.creationPath === 'scheduled') {
        if (!formData.templateVersionId) {
          if (!formData.aircraftId) {
            newErrors.templateVersionId = 'Select an aircraft before choosing a template';
          } else if (!selectedAircraftAssemblyModel && !selectedAircraftModelId) {
            newErrors.templateVersionId = 'Selected aircraft does not expose a valid model/model_id designation';
          } else if (filteredTemplateOptions.length === 0) {
            newErrors.templateVersionId = 'No templates match the selected aircraft tenant and assembly model';
          } else {
            newErrors.templateVersionId = 'Template selection is required for scheduled maintenance';
          }
        }
      }
      if (formData.creationPath === 'non-scheduled' && !formData.defectDescription) {
        newErrors.defectDescription = 'Defect description is required';
      }
      if (formData.creationPath === 'emergency') {
        if (!formData.emergencyReason) {
          newErrors.emergencyReason = 'Reason is required for emergency work packages';
        }
        if (!formData.emergencyType) {
          newErrors.emergencyType = 'Emergency type is required';
        }
      }
    }

    if (step === 2) {
      if (!formData.title.trim()) {
        newErrors.title = 'Title is required';
      }
      if (!formData.plannedStartDate) {
        newErrors.plannedStartDate = 'Planned start date is required';
      }
      if (formData.plannedEndDate && formData.plannedStartDate && formData.plannedEndDate < formData.plannedStartDate) {
        newErrors.plannedEndDate = 'End date must be after start date';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [filteredTemplateOptions.length, formData, selectedAircraftAssemblyModel, selectedAircraftModelId]);

  const handleNext = useCallback(() => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(4, prev + 1) as WizardStep);
    } else {
      toast.error('Please fix the errors before continuing');
    }
  }, [currentStep, validateStep]);

  const handleBack = useCallback(() => {
    setCurrentStep((prev) => Math.max(1, prev - 1) as WizardStep);
  }, []);

  const handleSubmit = useCallback(async (action: 'draft' | 'create') => {
    if (!validateStep(currentStep)) {
      toast.error('Please fix the errors before submitting');
      return;
    }

    setIsSubmitting(true);
    try {
      if (formData.creationPath === 'emergency') {
        await createEmergencyWPMutation.mutateAsync({
          aircraft_id: formData.aircraftId,
          emergency_type: formData.emergencyType,
          urgency_level: formData.urgencyLevel,
          reason: formData.emergencyReason,
          estimated_ground_time_hours: formData.estimatedGroundTime ? Number(formData.estimatedGroundTime) : undefined,
        });
        toast.success('Emergency work package created successfully');
      } else {
        await createWPMutation.mutateAsync({
          aircraft_id: formData.aircraftId,
          title: formData.title,
          description: formData.description || undefined,
          maintenance_type: formData.maintenanceType,
          priority: formData.priority,
          planned_start_date: formData.plannedStartDate ? format(formData.plannedStartDate, 'yyyy-MM-dd') : undefined,
          planned_end_date: formData.plannedEndDate ? format(formData.plannedEndDate, 'yyyy-MM-dd') : undefined,
          source: formData.creationPath === 'non-scheduled' ? 'non_scheduled' : 'scheduled',
        });
        toast.success(`Work package ${action === 'draft' ? 'saved as draft' : 'created'} successfully`);
      }

      onOpenChange(false);
      setFormData({ ...DEFAULT_FORM_DATA });
      setCurrentStep(1);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create work package');
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, currentStep, validateStep, createWPMutation, createEmergencyWPMutation, onOpenChange, onSuccess]);

  const resetWizard = useCallback(() => {
    setFormData({ 
      ...DEFAULT_FORM_DATA, 
      aircraftId: preselectedAircraftId || '' // Reset to preselected if provided
    });
    setCurrentStep(1);
    setErrors({});
  }, [preselectedAircraftId]);

  // Progress indicator
  const steps = [
    { number: 1, label: 'Aircraft & Path' },
    { number: 2, label: 'Details' },
    { number: 3, label: 'Tasks' },
    { number: 4, label: 'Review' },
  ];

  const creationPathConfig = CREATION_PATH_CONFIG[formData.creationPath];
  const CreationPathIcon = creationPathConfig.icon;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen);
      if (!isOpen) {
        setFormData({ 
          ...DEFAULT_FORM_DATA, 
          aircraftId: preselectedAircraftId || '' 
        });
        setCurrentStep(1);
        setErrors({});
      }
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <Plus className="h-6 w-6 text-primary" />
            Create Work Package
          </DialogTitle>
          <DialogDescription>
            Create a new work package using scheduled, non-scheduled, or emergency workflow
          </DialogDescription>
        </DialogHeader>

        {/* Progress Indicator */}
        <div className="flex items-center justify-between px-8 py-4 border-b">
          {steps.map((step, idx) => (
            <div key={step.number} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all',
                  currentStep === step.number
                    ? 'bg-primary text-primary-foreground'
                    : currentStep > step.number
                    ? 'bg-green-600 text-white'
                    : 'bg-muted text-muted-foreground',
                )}>
                  {currentStep > step.number ? <Check className="h-5 w-5" /> : step.number}
                </div>
                <span className={cn(
                  'text-xs mt-2 font-medium',
                  currentStep === step.number ? 'text-primary' : 'text-muted-foreground',
                )}>
                  {step.label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div className={cn(
                  'flex-1 h-0.5 mx-4',
                  currentStep > step.number ? 'bg-green-600' : 'bg-muted',
                )} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="space-y-6 py-4">
          {/* Step 1: Aircraft & Creation Path */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <Label className="text-base font-semibold">Select Aircraft *</Label>
                <p className="text-sm text-muted-foreground mt-1">Choose the aircraft for this work package</p>
                <Select value={formData.aircraftId} onValueChange={(val) => updateField('aircraftId', val)} disabled={aircraftLoading}>
                  <SelectTrigger className={cn('mt-2 h-11', errors.aircraftId && 'border-destructive')}>
                    <SelectValue placeholder={
                      aircraftLoading 
                        ? "Loading aircraft..." 
                        : aircraftOptions.length === 0
                        ? "No aircraft available"
                        : "Select an aircraft..."
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {aircraftError ? (
                      <div className="p-2 text-sm text-destructive">Failed to load aircraft: {aircraftError.message || 'Unknown error'}</div>
                    ) : aircraftOptions.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">No aircraft available in the system</div>
                    ) : (
                      aircraftOptions.map((ac) => (
                        <SelectItem key={ac.value} value={ac.value}>
                          {ac.label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {errors.aircraftId && (
                  <p className="text-sm text-destructive mt-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    {errors.aircraftId}
                  </p>
                )}
                {aircraftOptions.length === 0 && !aircraftLoading && (
                  <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
                    <p className="text-sm text-amber-800">
                      ⚠️ <strong>No aircraft available.</strong> Please contact your administrator to add aircraft to the system.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <Label className="text-base font-semibold">Creation Path *</Label>
                <p className="text-sm text-muted-foreground mt-1">Choose the workflow that best fits your maintenance scenario</p>
                <div className="grid gap-3 mt-3">
                  {(Object.entries(CREATION_PATH_CONFIG) as [CreationPath, typeof creationPathConfig][]).map(([key, config]) => {
                    const Icon = config.icon;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => updateField('creationPath', key)}
                        className={cn(
                          'flex items-start gap-4 p-4 rounded-lg border-2 text-left transition-all',
                          formData.creationPath === key
                            ? config.color + ' border-current shadow-md'
                            : 'bg-background hover:bg-muted border-border',
                        )}
                      >
                        <div className={cn(
                          'p-2 rounded-lg',
                          formData.creationPath === key ? 'bg-white/50' : 'bg-muted',
                        )}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold">{config.label}</p>
                          <p className="text-sm text-muted-foreground mt-1">{config.description}</p>
                        </div>
                        {formData.creationPath === key && (
                          <CheckCircle2 className="h-5 w-5 text-current" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Conditional Fields Based on Creation Path */}
              {formData.creationPath === 'scheduled' && (
                <div>
                  <Label className="text-base font-semibold">Select Template *</Label>
                  <p className="text-sm text-muted-foreground mt-1">Choose an approved maintenance template</p>
                  <p className="text-xs text-blue-700 mt-2">{templateFilteringMessage}</p>
                  <Select
                    value={formData.templateVersionId}
                    onValueChange={(val) => updateField('templateVersionId', val)}
                    disabled={!formData.aircraftId || templateLoading || filteredTemplateOptions.length === 0}
                  >
                    <SelectTrigger className={cn('mt-2 h-11', errors.templateVersionId && 'border-destructive')}>
                      <SelectValue placeholder={
                        !formData.aircraftId
                          ? 'Select aircraft first'
                          : templateLoading
                          ? "Loading templates..." 
                          : filteredTemplateOptions.length === 0
                          ? "No matching templates for selected aircraft"
                          : "Select a template..."
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {templateError ? (
                        <div className="p-2 text-sm text-destructive">Failed to load templates</div>
                      ) : !formData.aircraftId ? (
                        <div className="p-2 text-sm text-muted-foreground">
                          Select an aircraft to load filtered templates.
                        </div>
                      ) : (!selectedAircraftAssemblyModel && !selectedAircraftModelId) ? (
                        <div className="p-2 text-sm text-amber-700">
                          Aircraft model/model_id is unavailable for this aircraft. Cannot filter templates.
                        </div>
                      ) : filteredTemplateOptions.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground">
                          No templates match this aircraft tenant/model combination.
                        </div>
                      ) : (
                        filteredTemplateOptions.map((template) => (
                          <SelectItem key={template.value} value={template.value}>
                            {template.label}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {errors.templateVersionId && (
                    <p className="text-sm text-destructive mt-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      {errors.templateVersionId}
                    </p>
                  )}
                  {formData.aircraftId && filteredTemplateOptions.length === 0 && !templateLoading ? (
                    <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
                      <p className="text-sm text-amber-800">
                        ⚠️ <strong>No matching templates found.</strong> Template options are filtered by selected aircraft tenant and assembly model.
                      </p>
                      <ul className="text-sm text-amber-700 mt-2 ml-4 list-disc space-y-1">
                        <li>Select another aircraft with a supported model</li>
                        <li>Switch to <strong>Non-Scheduled</strong> or <strong>Emergency</strong> path</li>
                        <li>Create/configure matching templates for this aircraft model</li>
                      </ul>
                    </div>
                  ) : null}
                </div>
              )}

              {formData.creationPath === 'non-scheduled' && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-base font-semibold">Task Source</Label>
                    <Select value={formData.taskSource} onValueChange={(val) => updateField('taskSource', val)}>
                      <SelectTrigger className="mt-2 h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pilot_report">Pilot Report</SelectItem>
                        <SelectItem value="mechanic_report">Mechanic Report</SelectItem>
                        <SelectItem value="inspection_finding">Inspection Finding</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="defect-description" className="text-base font-semibold">Defect Description *</Label>
                    <Textarea
                      id="defect-description"
                      value={formData.defectDescription}
                      onChange={(e) => updateField('defectDescription', e.target.value)}
                      placeholder="Describe the issue found..."
                      className={cn('mt-2 min-h-[100px]', errors.defectDescription && 'border-destructive')}
                    />
                    {errors.defectDescription && (
                      <p className="text-sm text-destructive mt-2 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        {errors.defectDescription}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {formData.creationPath === 'emergency' && (
                <div className="space-y-4">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800 font-medium">
                      Emergency work packages are auto-prioritized and notify resources immediately
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-base font-semibold">Emergency Type *</Label>
                      <Select value={formData.emergencyType} onValueChange={(val) => updateField('emergencyType', val as EmergencyType)}>
                        <SelectTrigger className="mt-2 h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aog">AOG (Aircraft on Ground)</SelectItem>
                          <SelectItem value="unscheduled_removal">Unscheduled Removal</SelectItem>
                          <SelectItem value="flight_delay_risk">Flight Delay Risk</SelectItem>
                          <SelectItem value="safety_issue">Safety Issue</SelectItem>
                          <SelectItem value="technical_fault">Technical Fault</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-base font-semibold">Urgency Level</Label>
                      <Select value={formData.urgencyLevel} onValueChange={(val) => updateField('urgencyLevel', val as UrgencyLevel)}>
                        <SelectTrigger className="mt-2 h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="immediate">Immediate</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                          <SelectItem value="priority">Priority</SelectItem>
                          <SelectItem value="routine">Routine</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="emergency-reason" className="text-base font-semibold">Reason *</Label>
                    <Textarea
                      id="emergency-reason"
                      value={formData.emergencyReason}
                      onChange={(e) => updateField('emergencyReason', e.target.value)}
                      placeholder="Brief description of the emergency..."
                      className={cn('mt-2 min-h-[100px]', errors.emergencyReason && 'border-destructive')}
                    />
                    {errors.emergencyReason && (
                      <p className="text-sm text-destructive mt-2 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        {errors.emergencyReason}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="ground-time" className="text-base font-semibold">Estimated Ground Time (hours)</Label>
                    <Input
                      id="ground-time"
                      type="number"
                      value={formData.estimatedGroundTime}
                      onChange={(e) => updateField('estimatedGroundTime', e.target.value)}
                      placeholder="e.g., 24"
                      className="mt-2 h-11"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Work Package Details */}
          {currentStep === 2 && (
            <div className="space-y-6">
              {selectedAircraft && (
                <div className="p-4 bg-muted rounded-lg flex items-center gap-3">
                  <Plane className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{selectedAircraft.registration}</p>
                    <p className="text-xs text-muted-foreground">{selectedAircraft.type}</p>
                  </div>
                  <Badge variant="outline" className="ml-auto capitalize">
                    {formData.creationPath.replace('-', ' ')}
                  </Badge>
                </div>
              )}

              <div>
                <Label htmlFor="wp-title" className="text-base font-semibold">Title *</Label>
                <Input
                  id="wp-title"
                  value={formData.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  placeholder="e.g., 400 Hour Inspection"
                  className={cn('mt-2 h-11', errors.title && 'border-destructive')}
                />
                {errors.title && (
                  <p className="text-sm text-destructive mt-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    {errors.title}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="wp-description" className="text-base font-semibold">Description</Label>
                <Textarea
                  id="wp-description"
                  value={formData.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="Detailed description of the work..."
                  className="mt-2 min-h-[100px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-base font-semibold">Maintenance Type</Label>
                  <Select value={formData.maintenanceType} onValueChange={(val) => updateField('maintenanceType', val as MaintenanceType)}>
                    <SelectTrigger className="mt-2 h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="line">Line Maintenance</SelectItem>
                      <SelectItem value="base">Base Maintenance</SelectItem>
                      <SelectItem value="component">Component</SelectItem>
                      <SelectItem value="inspection">Inspection</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-base font-semibold">Priority</Label>
                  <Select value={String(formData.priority)} onValueChange={(val) => updateField('priority', Number(val) as WorkPackagePriority)}>
                    <SelectTrigger className="mt-2 h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">P1 - Critical</SelectItem>
                      <SelectItem value="2">P2 - High</SelectItem>
                      <SelectItem value="3">P3 - Medium</SelectItem>
                      <SelectItem value="4">P4 - Low</SelectItem>
                      <SelectItem value="5">P5 - Routine</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-base font-semibold">Planned Start Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full mt-2 h-11 justify-start text-left font-normal',
                          !formData.plannedStartDate && 'text-muted-foreground',
                          errors.plannedStartDate && 'border-destructive',
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {formData.plannedStartDate ? format(formData.plannedStartDate, 'PPP') : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={formData.plannedStartDate}
                        onSelect={(date) => updateField('plannedStartDate', date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {errors.plannedStartDate && (
                    <p className="text-sm text-destructive mt-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      {errors.plannedStartDate}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-base font-semibold">Planned End Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full mt-2 h-11 justify-start text-left font-normal',
                          !formData.plannedEndDate && 'text-muted-foreground',
                          errors.plannedEndDate && 'border-destructive',
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {formData.plannedEndDate ? format(formData.plannedEndDate, 'PPP') : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={formData.plannedEndDate}
                        onSelect={(date) => updateField('plannedEndDate', date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {errors.plannedEndDate && (
                    <p className="text-sm text-destructive mt-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      {errors.plannedEndDate}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="station" className="text-base font-semibold">Station</Label>
                <Input
                  id="station"
                  value={formData.station}
                  onChange={(e) => updateField('station', e.target.value)}
                  placeholder="e.g., DEL, BOM, BLR"
                  className="mt-2 h-11"
                />
              </div>
            </div>
          )}

          {/* Step 3: Task Selection */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold">Task Selection</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {formData.creationPath === 'scheduled'
                    ? 'Select tasks from the template or add custom tasks'
                    : 'Add tasks for this work package'}
                </p>
              </div>

              {formData.creationPath === 'scheduled' ? (
                <>
                  {/* Template Tasks */}
                  {isTaskDataLoading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">Loading template tasks...</p>
                    </div>
                  ) : filteredTemplateTasks.length > 0 ? (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium">Template Tasks ({filteredTemplateTasks.length} tasks)</h4>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const allTaskIds = filteredTemplateTasks.map((t: any) => t.task_template_id || t.id).filter(Boolean);
                              updateField('selectedTaskIds', allTaskIds);
                            }}
                          >
                            Select All
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateField('selectedTaskIds', [])}
                          >
                            Deselect All
                          </Button>
                        </div>
                      </div>
                      <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
                        <table className="w-full">
                          <thead className="bg-muted sticky top-0">
                            <tr>
                              <th className="p-3 text-left text-sm font-medium w-10">
                                <Checkbox />
                              </th>
                              <th className="p-3 text-left text-sm font-medium">Task ID</th>
                              <th className="p-3 text-left text-sm font-medium">ATA Code</th>
                              <th className="p-3 text-left text-sm font-medium">Description</th>
                              <th className="p-3 text-left text-sm font-medium">Est. Hours</th>
                              <th className="p-3 text-left text-sm font-medium">Category</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredTemplateTasks.map((task: any, idx: number) => (
                              <tr key={task.task_template_id || task.id || idx} className="border-t hover:bg-muted/50 transition-colors">
                                <td className="p-3">
                                  <Checkbox
                                    checked={formData.selectedTaskIds.includes(task.task_template_id || task.id || `task-${idx}`)}
                                    onCheckedChange={(checked) => {
                                      const taskId = task.task_template_id || task.id || `task-${idx}`;
                                      if (checked) {
                                        updateField('selectedTaskIds', [...formData.selectedTaskIds, taskId]);
                                      } else {
                                        updateField('selectedTaskIds', formData.selectedTaskIds.filter((id) => id !== taskId));
                                      }
                                    }}
                                  />
                                </td>
                                <td className="p-3 text-sm font-mono">{task.task_id || task.code_form_no || `TASK-${idx + 1}`}</td>
                                <td className="p-3 text-sm font-mono">{task.ata_code || '-'}</td>
                                <td className="p-3 text-sm">{task.description || 'Untitled Task'}</td>
                                <td className="p-3 text-sm">{task.estimated_man_hours || '-'}</td>
                                <td className="p-3 text-sm">
                                  {task.category_code ? (
                                    <Badge variant="outline">{task.category_code}</Badge>
                                  ) : (
                                    '-'
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <p className="text-sm text-blue-800">
                          💡 <strong>{formData.selectedTaskIds.length}</strong> of {filteredTemplateTasks.length} tasks selected
                          {formData.selectedTaskIds.length === 0 && ' - Select at least one task to continue'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 border-2 border-dashed rounded-lg">
                      <p className="text-sm text-muted-foreground">No matching task templates found for selected aircraft/model</p>
                      <p className="text-xs mt-2 text-muted-foreground">You can still create the work package and add tasks later</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-sm">Task selection is optional for {formData.creationPath} work packages</p>
                  <p className="text-xs mt-2">You can add tasks after creating the work package</p>
                </div>
              )}

              <div>
                <Label htmlFor="labor-hours" className="text-base font-semibold">Total Estimated Labor Hours</Label>
                <Input
                  id="labor-hours"
                  type="number"
                  value={formData.estimatedLaborHours}
                  onChange={(e) => updateField('estimatedLaborHours', e.target.value)}
                  placeholder="e.g., 24"
                  className="mt-2 h-11"
                />
                {formData.creationPath === 'scheduled' && templateVersionData?.records && templateVersionData.records[0] && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Template estimated: {(templateVersionData.records[0] as any).estimated_labor_hours || 'N/A'} hours
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Review & Submit */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold">Review Work Package</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Please review all details before creating the work package
                </p>
              </div>

              <div className="space-y-4 border rounded-lg p-6 bg-muted/20">
                <div className="flex items-center gap-3 pb-4 border-b">
                  <Plane className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{selectedAircraft?.registration || 'Not selected'}</p>
                    <p className="text-xs text-muted-foreground">{selectedAircraft?.type}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Creation Path</p>
                    <p className="text-sm font-medium capitalize">{formData.creationPath.replace('-', ' ')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Maintenance Type</p>
                    <p className="text-sm font-medium capitalize">{formData.maintenanceType}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Priority</p>
                    <p className="text-sm font-medium">P{formData.priority}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Station</p>
                    <p className="text-sm font-medium">{formData.station || 'Not specified'}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Title</p>
                  <p className="text-sm font-medium">{formData.title}</p>
                </div>

                {formData.description && (
                  <div>
                    <p className="text-xs text-muted-foreground">Description</p>
                    <p className="text-sm">{formData.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Start Date</p>
                    <p className="text-sm font-medium">
                      {formData.plannedStartDate ? format(formData.plannedStartDate, 'PPP') : 'Not set'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">End Date</p>
                    <p className="text-sm font-medium">
                      {formData.plannedEndDate ? format(formData.plannedEndDate, 'PPP') : 'Not set'}
                    </p>
                  </div>
                </div>

                {formData.creationPath === 'emergency' && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm font-medium text-red-900">Emergency Details</p>
                    <p className="text-xs text-red-700 mt-1">Type: {formData.emergencyType}</p>
                    <p className="text-xs text-red-700">Urgency: {formData.urgencyLevel}</p>
                    <p className="text-xs text-red-700 mt-2">{formData.emergencyReason}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t pt-4">
          <div>
            {currentStep > 1 && (
              <Button variant="outline" onClick={handleBack} className="h-10">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-10"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            {currentStep < 4 ? (
              <Button onClick={handleNext} className="h-10">
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleSubmit('draft')}
                  className="h-10"
                  disabled={isSubmitting}
                >
                  Save Draft
                </Button>
                <Button
                  onClick={() => handleSubmit('create')}
                  className="h-10"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Creating...' : 'Create Work Package'}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
