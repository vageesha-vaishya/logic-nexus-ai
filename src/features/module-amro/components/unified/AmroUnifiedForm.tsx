/**
 * AmroUnifiedForm
 * 
 * Standardized data entry dialog for all AMRO modules.
 * Provides consistent form patterns with:
 * - Dialog wrapper with header
 * - Tabs or sections for field groups
 * - Consistent field layout (2-3 columns)
 * - Validation messages
 * - Loading states
 * - Submit/Cancel buttons
 * 
 * Usage:
 * <AmroUnifiedForm
 *   open={open}
 *   onOpenChange={setOpen}
 *   title="Create Aircraft"
 *   description="Add a new aircraft to the fleet"
 *   onSubmit={handleSubmit}
 *   onCancel={handleCancel}
 *   loading={loading}
 * >
 *   <AmroUnifiedForm.Section title="Basic Information">
 *     <AmroUnifiedForm.Field label="Registration" required>
 *       <Input value={registration} onChange={...} />
 *     </AmroUnifiedForm.Field>
 *     <AmroUnifiedForm.Field label="Model">
 *       <Select ... />
 *     </AmroUnifiedForm.Field>
 *   </AmroUnifiedForm.Section>
 * </AmroUnifiedForm>
 */

import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AmroUnifiedFormProps {
  /** Dialog open state */
  open: boolean;
  /** Dialog open state change handler */
  onOpenChange: (open: boolean) => void;
  /** Form title */
  title: string;
  /** Form description */
  description?: string;
  /** Form submit handler */
  onSubmit: () => void;
  /** Form cancel handler */
  onCancel?: () => void;
  /** Loading state */
  loading?: boolean;
  /** Submit button label */
  submitLabel?: string;
  /** Cancel button label */
  cancelLabel?: string;
  /** Form content */
  children: ReactNode;
  /** Whether to show footer */
  showFooter?: boolean;
  /** Custom footer actions */
  footerActions?: ReactNode;
}

export interface FormSectionProps {
  /** Section title */
  title: string;
  /** Section description */
  description?: string;
  /** Section content */
  children: ReactNode;
  /** Whether to show separator after section */
  showSeparator?: boolean;
}

export interface FormFieldProps {
  /** Field label */
  label: string;
  /** Whether field is required */
  required?: boolean;
  /** Field content (input, select, etc.) */
  children: ReactNode;
  /** Validation error message */
  error?: string;
  /** Helper text */
  helper?: string;
  /** Column span (1-3) */
  colSpan?: 1 | 2 | 3;
}

export interface FormTabProps {
  /** Tab value */
  value: string;
  /** Tab label */
  label: string;
  /** Tab icon (optional) */
  icon?: ReactNode;
  /** Tab content */
  children: ReactNode;
}

export interface FormTabsProps {
  /** Default active tab */
  defaultValue: string;
  /** Tab children */
  children: ReactNode[];
}

// ── Components ─────────────────────────────────────────────────────────────────

/**
 * Form Field Component
 * Standardized field wrapper with label, error, and helper text
 */
function FormField({ label, required, children, error, helper, colSpan = 1 }: FormFieldProps) {
  const colSpanClass = colSpan === 1 ? '' : colSpan === 2 ? 'col-span-2' : 'col-span-3';

  return (
    <div className={`space-y-2 ${colSpanClass}`}>
      <Label className={required ? 'after:content-["*"] after:ml-0.5 after:text-destructive' : ''}>
        {label}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {helper && !error && <p className="text-xs text-muted-foreground">{helper}</p>}
    </div>
  );
}

/**
 * Form Section Component
 * Groups related fields with a title
 */
function FormSection({ title, description, children, showSeparator = true }: FormSectionProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {children}
      </div>
      {showSeparator && <Separator className="my-4" />}
    </div>
  );
}

/**
 * Form Tab Component
 * Individual tab within FormTabs
 */
function FormTab({ value, label, icon, children }: FormTabProps) {
  return (
    <TabsContent value={value} className="space-y-4 pt-4">
      {children}
    </TabsContent>
  );
}

/**
 * Form Tabs Component
 * Tab container for organizing form sections
 */
function FormTabs({ defaultValue, children }: FormTabsProps) {
  return (
    <Tabs defaultValue={defaultValue} className="w-full">
      <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${React.Children.count(children)}, 1fr)` }}>
        {React.Children.map(children, (child: any) => (
          <TabsTrigger key={child.props.value} value={child.props.value}>
            {child.props.icon && <span className="mr-2">{child.props.icon}</span>}
            {child.props.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
}

/**
 * Main Form Component
 */
export function AmroUnifiedForm({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
  onCancel,
  loading = false,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  children,
  showFooter = true,
  footerActions,
}: AmroUnifiedFormProps) {
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-6 py-4">
          {children}
        </div>

        {showFooter && (
          <DialogFooter className="mt-6">
            {footerActions}
            <Button variant="outline" onClick={handleCancel} disabled={loading}>
              {cancelLabel}
            </Button>
            <Button onClick={onSubmit} disabled={loading}>
              {loading ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Saving...
                </>
              ) : (
                submitLabel
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

AmroUnifiedForm.Field = FormField;
AmroUnifiedForm.Section = FormSection;
AmroUnifiedForm.Tab = FormTab;
AmroUnifiedForm.Tabs = FormTabs;
