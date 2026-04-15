/**
 * AMRO Record Wizard Component
 *
 * Step-by-step wizard for complex form creation and editing with:
 * - Progress indicator showing current step and completion
 * - Step validation preventing progression with invalid data
 * - Save draft functionality for incomplete forms
 * - Conditional step visibility based on previous selections
 * - Summary review step before final submission
 * - Keyboard navigation support
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Save,
  X,
  AlertCircle,
  CheckCircle2,
  Package,
  Settings,
  Boxes,
  FileText,
  Info,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useDataGridStore, WizardStep } from './store/useDataGridStore';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface WizardField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'textarea' | 'checkbox' | 'switch' | 'radio';
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  helperText?: string;
  validate?: (value: any) => string | null;
  colSpan?: 1 | 2;
  /** Condition for showing this field */
  showWhen?: (formData: Record<string, any>) => boolean;
}

export interface WizardStepConfig {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  fields: WizardField[];
  /** Condition for showing this step */
  showWhen?: (formData: Record<string, any>) => boolean;
}

export interface AmroRecordWizardProps {
  /** Wizard mode: create or edit */
  mode: 'create' | 'edit';
  /** Wizard steps configuration */
  steps: WizardStepConfig[];
  /** Initial form data (for edit mode) */
  initialData?: Record<string, any>;
  /** On submit handler */
  onSubmit: (formData: Record<string, any>) => Promise<void>;
  /** On draft save handler */
  onDraftSave?: (formData: Record<string, any>) => Promise<void>;
  /** On close handler */
  onClose: () => void;
  /** Existing draft data */
  draftData?: Record<string, any>;
  /** CSS class name */
  className?: string;
}

// ── Step Indicator Component ───────────────────────────────────────────────────

interface StepIndicatorProps {
  steps: WizardStepConfig[];
  currentStep: number;
  completedSteps: Set<string>;
  onStepClick: (stepIndex: number) => void;
  allowStepNavigation: boolean;
}

function StepIndicator({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
  allowStepNavigation,
}: StepIndicatorProps) {
  const progress = steps.length > 1 ? (currentStep / (steps.length - 1)) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Progress</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Step Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.has(step.id);
          const isCurrent = index === currentStep;
          const isFuture = index > currentStep;

          return (
            <button
              key={step.id}
              type="button"
              className={cn(
                'rounded-lg border p-3 space-y-2 transition-all text-left',
                isCurrent && 'border-primary bg-primary/5 ring-1 ring-primary',
                isCompleted && 'border-green-200 bg-green-50',
                isFuture && 'border-gray-200 bg-gray-50 opacity-60',
                allowStepNavigation && !isFuture && 'cursor-pointer hover:shadow-md',
                !allowStepNavigation && 'cursor-default'
              )}
              onClick={() => allowStepNavigation && !isFuture && onStepClick(index)}
              disabled={!allowStepNavigation || isFuture}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <div className="flex items-center gap-2">
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0',
                  isCompleted && 'bg-green-500 text-white',
                  isCurrent && 'bg-primary text-white',
                  isFuture && 'bg-gray-200 text-gray-600'
                )}>
                  {isCompleted ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{step.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{step.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Field Renderer for Wizard ──────────────────────────────────────────────────

interface WizardFieldRendererProps {
  field: WizardField;
  value: any;
  error?: string | null;
  onChange: (id: string, value: any) => void;
}

function WizardFieldRenderer({ field, value, error, onChange }: WizardFieldRendererProps) {
  switch (field.type) {
    case 'text':
      return (
        <div className="space-y-1">
          <Input
            value={value || ''}
            onChange={(e) => onChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            className={cn(error && 'border-red-500')}
          />
          {error ? (
            <p className="text-xs text-red-500 flex items-center gap-1" role="alert">
              <AlertCircle className="h-3 w-3" />
              {error}
            </p>
          ) : field.helperText ? (
            <p className="text-xs text-muted-foreground">{field.helperText}</p>
          ) : null}
        </div>
      );

    case 'number':
      return (
        <div className="space-y-1">
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => onChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            className={cn(error && 'border-red-500')}
          />
          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1" role="alert">
              <AlertCircle className="h-3 w-3" />
              {error}
            </p>
          )}
        </div>
      );

    case 'select':
      return (
        <div className="space-y-1">
          <Select value={value || ''} onValueChange={(v) => onChange(field.id, v)}>
            <SelectTrigger className={cn(error && 'border-red-500')}>
              <SelectValue placeholder={field.placeholder || 'Select...'} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1" role="alert">
              <AlertCircle className="h-3 w-3" />
              {error}
            </p>
          )}
        </div>
      );

    case 'textarea':
      return (
        <div className="space-y-1">
          <Textarea
            value={value || ''}
            onChange={(e) => onChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            rows={3}
            className={cn(error && 'border-red-500')}
          />
          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1" role="alert">
              <AlertCircle className="h-3 w-3" />
              {error}
            </p>
          )}
        </div>
      );

    case 'checkbox':
      return (
        <div className="flex items-center space-x-2">
          <Checkbox
            id={field.id}
            checked={!!value}
            onCheckedChange={(checked) => onChange(field.id, checked)}
          />
          <Label htmlFor={field.id} className="text-sm cursor-pointer">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
        </div>
      );

    case 'switch':
      return (
        <div className="flex items-center justify-between">
          <Label htmlFor={field.id} className="text-sm">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          <Switch
            id={field.id}
            checked={!!value}
            onCheckedChange={(checked) => onChange(field.id, checked)}
          />
        </div>
      );

    case 'radio':
      return (
        <div className="space-y-2">
          <Label className="text-sm">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          <RadioGroup
            value={value || ''}
            onValueChange={(v) => onChange(field.id, v)}
            className="flex flex-col gap-2"
          >
            {field.options?.map((opt) => (
              <div key={opt.value} className="flex items-center space-x-2">
                <RadioGroupItem value={opt.value} id={`${field.id}-${opt.value}`} />
                <Label htmlFor={`${field.id}-${opt.value}`} className="text-sm cursor-pointer">
                  {opt.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1" role="alert">
              <AlertCircle className="h-3 w-3" />
              {error}
            </p>
          )}
        </div>
      );

    default:
      return null;
  }
}

// ── Step Content Renderer ──────────────────────────────────────────────────────

interface StepContentProps {
  step: WizardStepConfig;
  formData: Record<string, any>;
  errors: Record<string, string>;
  onChange: (id: string, value: any) => void;
}

function StepContent({ step, formData, errors, onChange }: StepContentProps) {
  const Icon = step.icon;

  const visibleFields = useMemo(
    () => step.fields.filter((field) => !field.showWhen || field.showWhen(formData)),
    [step.fields, formData]
  );

  return (
    <div className="space-y-6">
      {/* Step Header */}
      <div className="flex items-center gap-3 pb-4 border-b">
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-base font-semibold">{step.title}</h3>
          <p className="text-xs text-muted-foreground">{step.description}</p>
        </div>
      </div>

      {/* Fields Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visibleFields.map((field) => {
          const colSpanClass = field.colSpan === 2 ? 'md:col-span-2' : '';
          const isCheckboxOrSwitch = field.type === 'checkbox' || field.type === 'switch';

          if (isCheckboxOrSwitch) {
            return (
              <div key={field.id} className={colSpanClass}>
                <WizardFieldRenderer
                  field={field}
                  value={formData[field.id]}
                  error={errors[field.id]}
                  onChange={onChange}
                />
              </div>
            );
          }

          return (
            <div key={field.id} className={cn('space-y-2', colSpanClass)}>
              <Label htmlFor={field.id} className="text-xs">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <WizardFieldRenderer
                field={field}
                value={formData[field.id]}
                error={errors[field.id]}
                onChange={onChange}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Review Step Component ──────────────────────────────────────────────────────

interface ReviewStepProps {
  steps: WizardStepConfig[];
  formData: Record<string, any>;
  onEditStep: (stepIndex: number) => void;
}

function ReviewStep({ steps, formData, onEditStep }: ReviewStepProps) {
  return (
    <div className="space-y-6">
      {/* Review Header */}
      <div className="flex items-center gap-3 pb-4 border-b">
        <div className="p-2 rounded-lg bg-primary/10">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-base font-semibold">Review & Submit</h3>
          <p className="text-xs text-muted-foreground">Review your entries before submitting</p>
        </div>
      </div>

      {/* Summary Sections */}
      <div className="space-y-4">
        {steps.map((step, index) => {
          const visibleFields = step.fields.filter((f) => !f.showWhen || f.showWhen(formData));
          const hasData = visibleFields.some((f) => formData[f.id]);

          if (!hasData) return null;

          const Icon = step.icon;

          return (
            <Card key={step.id} className="border-slate-300">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">{step.title}</CardTitle>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => onEditStep(index)}>
                    Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <dl className="space-y-2">
                  {visibleFields.map((field) => {
                    const value = formData[field.id];
                    if (!value && value !== false && value !== 0) return null;

                    let displayValue = value;
                    if (field.type === 'checkbox' || field.type === 'switch') {
                      displayValue = value ? 'Yes' : 'No';
                    } else if (field.type === 'select' && field.options) {
                      const option = field.options.find((o) => o.value === value);
                      displayValue = option?.label || value;
                    }

                    return (
                      <div key={field.id} className="flex justify-between text-sm">
                        <dt className="text-muted-foreground">{field.label}</dt>
                        <dd className="font-medium">{String(displayValue)}</dd>
                      </div>
                    );
                  })}
                </dl>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Submission Notice */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle className="text-xs">Ready to Submit</AlertTitle>
        <AlertDescription className="text-xs">
          Please review all entries above. Click Submit to create the record, or go back to make changes.
        </AlertDescription>
      </Alert>
    </div>
  );
}

// ── Main Wizard Component ──────────────────────────────────────────────────────

export function AmroRecordWizard({
  mode,
  steps,
  initialData = {},
  onSubmit,
  onDraftSave,
  onClose,
  draftData,
  className,
}: AmroRecordWizardProps) {
  const {
    wizard,
    setWizardStep,
    completeWizardStep,
    setWizardDraft,
    saveWizardDraft,
    closeWizard,
  } = useDataGridStore();

  const [formData, setFormData] = useState<Record<string, any>>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  // Filter visible steps based on conditions
  const visibleSteps = useMemo(
    () => steps.filter((step) => !step.showWhen || step.showWhen(formData)),
    [steps, formData]
  );

  // Initialize from draft if available
  useEffect(() => {
    if (draftData && Object.keys(draftData).length > 0) {
      setFormData(draftData);
    }
  }, [draftData]);

  // Handle field change
  const handleFieldChange = useCallback((fieldId: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
    // Clear error on change
    if (errors[fieldId]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[fieldId];
        return newErrors;
      });
    }
  }, [errors]);

  // Validate current step
  const validateStep = useCallback((stepIndex: number): boolean => {
    const step = visibleSteps[stepIndex];
    if (!step) return true;

    const newErrors: Record<string, string> = {};
    let isValid = true;

    step.fields.forEach((field) => {
      // Skip hidden fields
      if (field.showWhen && !field.showWhen(formData)) return;

      const value = formData[field.id];

      // Required validation
      if (field.required && (!value || (typeof value === 'string' && !value.trim()))) {
        newErrors[field.id] = 'This field is required';
        isValid = false;
        return;
      }

      // Custom validation
      if (field.validate && value) {
        const error = field.validate(value);
        if (error) {
          newErrors[field.id] = error;
          isValid = false;
        }
      }
    });

    setErrors(newErrors);
    return isValid;
  }, [visibleSteps, formData]);

  // Check if all visible steps are valid
  const areAllStepsValid = useMemo(() => {
    return visibleSteps.every((step) => {
      return step.fields.every((field) => {
        if (field.showWhen && !field.showWhen(formData)) return true;
        if (field.required) return !!formData[field.id];
        if (field.validate && formData[field.id]) return !field.validate(formData[field.id]);
        return true;
      });
    });
  }, [visibleSteps, formData]);

  // Go to next step
  const handleNext = useCallback(() => {
    const currentStepIndex = wizard.currentStep;

    if (!validateStep(currentStepIndex)) return;

    // Mark current step as completed
    const currentStepId = visibleSteps[currentStepIndex]?.id;
    if (currentStepId) {
      completeWizardStep(currentStepId);
      setCompletedSteps((prev) => new Set(prev).add(currentStepId));
    }

    // Move to next step
    if (currentStepIndex < visibleSteps.length - 1) {
      setWizardStep(currentStepIndex + 1);
    }
  }, [wizard.currentStep, validateStep, visibleSteps, completeWizardStep, setWizardStep]);

  // Go to previous step
  const handlePrevious = useCallback(() => {
    if (wizard.currentStep > 0) {
      setWizardStep(wizard.currentStep - 1);
    }
  }, [wizard.currentStep, setWizardStep]);

  // Jump to specific step
  const handleStepClick = useCallback((stepIndex: number) => {
    setWizardStep(stepIndex);
  }, [setWizardStep]);

  // Save draft
  const handleSaveDraft = useCallback(async () => {
    setIsSavingDraft(true);
    try {
      setWizardDraft(formData);
      await onDraftSave?.(formData);
      saveWizardDraft();
    } catch (error) {
      console.error('Failed to save draft:', error);
    } finally {
      setIsSavingDraft(false);
    }
  }, [formData, onDraftSave, setWizardDraft, saveWizardDraft]);

  // Submit form
  const handleSubmit = useCallback(async () => {
    if (!validateStep(wizard.currentStep)) return;

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      closeWizard();
      onClose();
    } catch (error) {
      console.error('Failed to submit:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [wizard.currentStep, validateStep, onSubmit, formData, closeWizard, onClose]);

  // Is current step the review step
  const isReviewStep = wizard.currentStep === visibleSteps.length - 1;

  // Can navigate to this step (only completed or current)
  const allowStepNavigation = true;

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn('max-w-4xl max-h-[90vh] flex flex-col', className)}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg">
                {mode === 'create' ? 'Create New Record' : 'Edit Record'}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Step {wizard.currentStep + 1} of {visibleSteps.length}
                {wizard.draftSavedAt && (
                  <span className="ml-2 text-green-600">
                    Draft saved {new Date(wizard.draftSavedAt).toLocaleTimeString()}
                  </span>
                )}
              </DialogDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-4">
          {/* Step Indicator */}
          <StepIndicator
            steps={visibleSteps}
            currentStep={wizard.currentStep}
            completedSteps={completedSteps}
            onStepClick={handleStepClick}
            allowStepNavigation={allowStepNavigation}
          />

          {/* Step Content */}
          {isReviewStep ? (
            <ReviewStep
              steps={visibleSteps}
              formData={formData}
              onEditStep={handleStepClick}
            />
          ) : (
            <StepContent
              step={visibleSteps[wizard.currentStep]}
              formData={formData}
              errors={errors}
              onChange={handleFieldChange}
            />
          )}

          {/* Validation Errors Summary */}
          {Object.keys(errors).length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="text-xs">Validation Errors</AlertTitle>
              <AlertDescription className="text-xs">
                Please fix {Object.keys(errors).length} error(s) before continuing.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Footer Navigation */}
        <DialogFooter className="flex items-center justify-between sm:justify-between border-t pt-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevious}
              disabled={wizard.currentStep === 0}
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Previous
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {/* Save Draft Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSaveDraft}
              disabled={isSavingDraft}
            >
              <Save className="h-4 w-4 mr-1.5" />
              {isSavingDraft ? 'Saving...' : 'Save Draft'}
            </Button>

            {/* Next / Submit Button */}
            {isReviewStep ? (
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={isSubmitting || !areAllStepsValid}
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-1.5" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                    Submit
                  </>
                )}
              </Button>
            ) : (
              <Button size="sm" onClick={handleNext}>
                Next
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
