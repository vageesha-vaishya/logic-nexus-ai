/**
 * AMRO Record Detail Component
 *
 * Detailed record view with:
 * - Sectioned layout with field groups
 * - Proper data formatting (dates, currency, percentages)
 * - Edit mode with inline form validation
 * - CRUD operations (View, Edit, Delete, Save)
 * - Audit trail display
 * - Print-friendly view
 * - Keyboard shortcuts
 * - Responsive design for mobile/desktop
 */

import { useState, useCallback, useEffect } from 'react';
import {
  Eye,
  Pencil,
  Trash2,
  Save,
  X,
  Printer,
  Copy,
  Plus,
  Info,
  AlertCircle,
  CheckCircle2,
  Clock,
  User,
  Package,
  MapPin,
  DollarSign,
  Settings,
  PanelLeftClose,
  PanelBottomClose,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { useDataGridStore } from './store/useDataGridStore';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'currency' | 'date' | 'select' | 'textarea' | 'readonly';
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  helperText?: string;
  format?: (value: any) => string;
  validate?: (value: any) => string | null;
  colSpan?: 1 | 2;
}

export interface FormSection {
  id: string;
  title: string;
  icon: React.ElementType;
  fields: FormField[];
}

export interface AuditEntry {
  id: string;
  action: 'create' | 'update' | 'delete';
  user: string;
  timestamp: string;
  changes?: Array<{ field: string; oldValue: any; newValue: any }>;
}

export interface AmroRecordDetailProps {
  /** Record data */
  record: Record<string, any>;
  /** Form sections configuration */
  sections: FormSection[];
  /** Is in edit mode */
  isEditing?: boolean;
  /** On save handler */
  onSave?: (record: Record<string, any>) => Promise<void>;
  /** On delete handler */
  onDelete?: (id: string) => Promise<void>;
  /** On close handler */
  onClose?: () => void;
  /** On navigate to previous record */
  onPrevious?: () => void;
  /** On navigate to next record */
  onNext?: () => void;
  /** Audit trail entries */
  auditTrail?: AuditEntry[];
  /** Related records */
  relatedRecords?: Array<{ title: string; items: Array<{ id: string; label: string }> }>;
  /** CSS class name */
  className?: string;
}

// ── Field Renderer ─────────────────────────────────────────────────────────────

interface FieldRendererProps {
  field: FormField;
  value: any;
  isEditing: boolean;
  error?: string | null;
  onChange: (id: string, value: any) => void;
}

function FieldRenderer({ field, value, isEditing, error, onChange }: FieldRendererProps) {
  const formatValue = (val: any) => {
    if (field.format) return field.format(val);
    if (field.type === 'currency') return `$${Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    if (field.type === 'date') return val ? new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
    if (field.type === 'number') return val ? Number(val).toLocaleString() : '—';
    return val || '—';
  };

  if (!isEditing || field.type === 'readonly') {
    return (
      <div className={cn(
        'min-h-[40px] flex items-center rounded-md border bg-muted/30 px-3 text-sm',
        field.type === 'textarea' && 'min-h-[80px] py-2'
      )}>
        {field.type === 'textarea' ? (
          <span className="whitespace-pre-wrap">{formatValue(value)}</span>
        ) : (
          <span>{formatValue(value)}</span>
        )}
      </div>
    );
  }

  switch (field.type) {
    case 'text':
      return (
        <div className="space-y-1">
          <Input
            value={value || ''}
            onChange={(e) => onChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            className={cn(error && 'border-red-500')}
            aria-invalid={!!error}
            aria-describedby={error ? `${field.id}-error` : undefined}
          />
          {error && (
            <p id={`${field.id}-error`} className="text-xs text-red-500 flex items-center gap-1" role="alert">
              <AlertCircle className="h-3 w-3" />
              {error}
            </p>
          )}
          {field.helperText && !error && (
            <p className="text-xs text-muted-foreground">{field.helperText}</p>
          )}
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

    case 'currency':
      return (
        <div className="space-y-1">
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="number"
              value={value || ''}
              onChange={(e) => onChange(field.id, e.target.value)}
              placeholder="0.00"
              className={cn('pl-9', error && 'border-red-500')}
            />
          </div>
          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1" role="alert">
              <AlertCircle className="h-3 w-3" />
              {error}
            </p>
          )}
        </div>
      );

    case 'date':
      return (
        <div className="space-y-1">
          <Input
            type="date"
            value={value ? new Date(value).toISOString().split('T')[0] : ''}
            onChange={(e) => onChange(field.id, e.target.value)}
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
            rows={4}
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

    default:
      return <span>{formatValue(value)}</span>;
  }
}

// ── Section Renderer ───────────────────────────────────────────────────────────

interface SectionRendererProps {
  section: FormSection;
  record: Record<string, any>;
  isEditing: boolean;
  errors: Record<string, string>;
  onChange: (id: string, value: any) => void;
}

function SectionRenderer({ section, record, isEditing, errors, onChange }: SectionRendererProps) {
  const Icon = section.icon;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b">
        <Icon className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold">{section.title}</h4>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {section.fields.map((field) => {
          const colSpanClass = field.colSpan === 2 ? 'md:col-span-2' : '';
          return (
            <div key={field.id} className={cn('space-y-2', colSpanClass)}>
              <Label htmlFor={field.id} className="text-xs">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <FieldRenderer
                field={field}
                value={record[field.id]}
                isEditing={isEditing}
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

// ── Audit Trail Component ──────────────────────────────────────────────────────

function AuditTrail({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) return null;

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'create':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'update':
        return <Pencil className="h-4 w-4 text-blue-600" />;
      case 'delete':
        return <Trash2 className="h-4 w-4 text-red-600" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'create':
        return 'Created';
      case 'update':
        return 'Updated';
      case 'delete':
        return 'Deleted';
      default:
        return action;
    }
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold flex items-center gap-2">
        <Clock className="h-4 w-4" />
        Audit Trail
      </h4>
      <div className="space-y-2">
        {entries.map((entry) => (
          <div key={entry.id} className="flex items-start gap-3 p-3 rounded-md border bg-muted/20">
            {getActionIcon(entry.action)}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{getActionLabel(entry.action)}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(entry.timestamp).toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                By <span className="font-medium text-foreground">{entry.user}</span>
              </p>
              {entry.changes && entry.changes.length > 0 && (
                <div className="mt-2 space-y-1">
                  {entry.changes.map((change, idx) => (
                    <p key={idx} className="text-xs">
                      <span className="font-medium">{change.field}:</span>
                      <span className="text-muted-foreground line-through ml-1">{String(change.oldValue)}</span>
                      <span className="text-green-600 ml-1">→ {String(change.newValue)}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Related Records Component ──────────────────────────────────────────────────

function RelatedRecords({ records }: { records: Array<{ title: string; items: Array<{ id: string; label: string }> }> }) {
  if (!records || records.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold">Related Records</h4>
      {records.map((group) => (
        <div key={group.title} className="space-y-2">
          <h5 className="text-xs font-medium text-muted-foreground uppercase">{group.title}</h5>
          <div className="space-y-1">
            {group.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors">
                <span className="text-sm">{item.label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Record Detail Component ───────────────────────────────────────────────

export function AmroRecordDetail({
  record,
  sections,
  isEditing = false,
  onSave,
  onDelete,
  onClose,
  onPrevious,
  onNext,
  auditTrail = [],
  relatedRecords,
  className,
}: AmroRecordDetailProps) {
  const { closeRecordDetail, setDetailMode } = useDataGridStore();

  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize form data from record
  useEffect(() => {
    const initialData: Record<string, any> = {};
    sections.forEach((section) => {
      section.fields.forEach((field) => {
        initialData[field.id] = record[field.id] ?? '';
      });
    });
    setFormData(initialData);
    setErrors({});
    setSaveSuccess(false);
  }, [record, sections]);

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

  // Validate form
  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    sections.forEach((section) => {
      section.fields.forEach((field) => {
        if (field.required && !formData[field.id]) {
          newErrors[field.id] = 'This field is required';
          isValid = false;
        }
        if (field.validate && formData[field.id]) {
          const error = field.validate(formData[field.id]);
          if (error) {
            newErrors[field.id] = error;
            isValid = false;
          }
        }
      });
    });

    setErrors(newErrors);
    return isValid;
  }, [formData, sections]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      await onSave?.(formData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save record:', error);
    } finally {
      setIsSaving(false);
    }
  }, [validateForm, onSave, formData]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    try {
      await onDelete?.(record.id);
      closeRecordDetail();
    } catch (error) {
      console.error('Failed to delete record:', error);
    }
  }, [onDelete, record.id, closeRecordDetail]);

  // Handle print
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // Handle duplicate
  const handleDuplicate = useCallback(() => {
    const duplicatedData = { ...formData };
    delete duplicatedData.id;
    setFormData(duplicatedData);
    setDetailMode('edit');
  }, [formData, setDetailMode]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt+Shift+S to save
      if (e.altKey && e.shiftKey && e.key === 'S' && isEditing) {
        e.preventDefault();
        handleSave();
      }
      // Escape to close
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
      // Alt+Shift+Left for previous
      if (e.altKey && e.shiftKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        onPrevious?.();
      }
      // Alt+Shift+Right for next
      if (e.altKey && e.shiftKey && e.key === 'ArrowRight') {
        e.preventDefault();
        onNext?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, handleSave, onClose, onPrevious, onNext]);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header with Title and Shortcuts */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Record Detail</h2>
        <p className="text-xs text-muted-foreground">
          Shortcuts: Alt+Shift+C/R/U/D, Alt+Shift+S, Esc
        </p>
      </div>

      {/* Action Toolbar - Icon-only buttons matching screenshot design */}
      <div className="flex items-center gap-1.5 pb-3 border-b">
        {/* New/Create */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => setDetailMode('edit')} aria-label="Create new record">
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Create</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* View */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => setDetailMode('view')} aria-label="View record">
                <Eye className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>View</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Edit */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => setDetailMode('edit')} aria-label="Edit record">
                <Pencil className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Delete */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" className="h-10 w-10 text-destructive hover:text-destructive" onClick={() => setShowDeleteConfirm(true)} aria-label="Delete record">
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Save - highlighted when editing */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                className={cn('h-10 w-10', isEditing ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-primary/20 text-primary')}
                onClick={handleSave}
                disabled={isSaving || !isEditing}
                aria-label="Save record"
              >
                {isSaving ? (
                  <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Save (Alt+Shift+S)</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Cancel/Close */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" className="h-10 w-10" onClick={onClose} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Close (Esc)</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Divider */}
        <Separator orientation="vertical" className="h-8 mx-1" />

        {/* Panel Controls */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Collapse panel">
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Collapse Panel</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Minimize panel">
                <PanelBottomClose className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Minimize</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Save Success Alert */}
      {saveSuccess && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-xs text-green-700">Record Saved</AlertTitle>
          <AlertDescription className="text-xs text-green-600">
            Your changes have been saved successfully.
          </AlertDescription>
        </Alert>
      )}

      {/* Form Sections */}
      <div className="space-y-4">
        {/* Section Header - matching screenshot design */}
        <div className="flex items-center gap-3 py-2 border-b">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Record Detail Sections
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Render each section */}
        {sections.map((section) => (
          <Card key={section.id} className="border-slate-300">
            <CardContent className="p-4">
              <SectionRenderer
                section={section}
                record={formData}
                isEditing={isEditing}
                errors={errors}
                onChange={handleFieldChange}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Audit Trail */}
      {auditTrail.length > 0 && (
        <Card className="border-slate-300">
          <CardContent className="p-4">
            <AuditTrail entries={auditTrail} />
          </CardContent>
        </Card>
      )}

      {/* Related Records */}
      {relatedRecords && relatedRecords.length > 0 && (
        <Card className="border-slate-300">
          <CardContent className="p-4">
            <RelatedRecords records={relatedRecords} />
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this record? This action cannot be undone and will permanently remove the record from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Record
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
