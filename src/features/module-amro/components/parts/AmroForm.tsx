import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Standardized Form Component with CRUD Button Positioning
 * 
 * CRUD Button Placement:
 * - Primary actions (Save/Create/Update): Top-right of form header
 * - Secondary actions (Cancel/Delete): Bottom-center of form footer
 * - Spacing: Minimum 16px (space-4) between all interactive elements
 * 
 * Usage:
 * <AmroForm
 *   title="Create Part"
 *   primaryAction={{ label: 'Create', onClick: handleCreate }}
 *   secondaryActions={[{ label: 'Cancel', onClick: handleCancel }]}
 *   dangerAction={{ label: 'Delete', onClick: handleDelete }}
 * >
 *   Form fields here
 * </AmroForm>
 */

export interface AmroFormAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export interface AmroFormProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  primaryAction: AmroFormAction;
  secondaryActions?: AmroFormAction[];
  dangerAction?: AmroFormAction;
  className?: string;
  headerActions?: ReactNode; // For custom top-right actions
}

export function AmroForm({
  title,
  subtitle,
  children,
  primaryAction,
  secondaryActions = [],
  dangerAction,
  className,
  headerActions,
}: AmroFormProps): JSX.Element {
  return (
    <div className={cn('rounded border bg-card', className)}>
      {/* Form Header with Primary Actions - Top-Right */}
      <div className="flex items-start justify-between border-b px-6 py-4">
        <div className="space-y-1">
          {/* Standardized heading: H3 for form titles */}
          <h3 className="text-lg font-semibold leading-tight">{title}</h3>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        
        {/* Primary Action Buttons - Top-Right */}
        <div className="flex items-center gap-4">
          {/* Minimum 16px gap between buttons */}
          {headerActions}
          <button
            type="button"
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled || primaryAction.loading}
            className={cn(
              'rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition',
              (primaryAction.disabled || primaryAction.loading) && 'cursor-not-allowed opacity-50',
            )}
          >
            {primaryAction.loading ? 'Saving...' : primaryAction.label}
          </button>
        </div>
      </div>
      
      {/* Form Body */}
      <div className="px-6 py-4">
        {children}
      </div>
      
      {/* Form Footer with Secondary Actions - Bottom-Center */}
      {(secondaryActions.length > 0 || dangerAction) && (
        <div className="flex items-center justify-between border-t px-6 py-4">
          {/* Danger Action - Bottom-Left */}
          {dangerAction && (
            <button
              type="button"
              onClick={dangerAction.onClick}
              disabled={dangerAction.disabled}
              className={cn(
                'rounded border border-destructive px-4 py-2 text-sm font-medium text-destructive transition',
                dangerAction.disabled && 'cursor-not-allowed opacity-50',
              )}
            >
              {dangerAction.label}
            </button>
          )}
          
          {/* Spacer if no danger action */}
          {!dangerAction && <div />}
          
          {/* Secondary Actions - Bottom-Right */}
          <div className="flex items-center gap-4">
            {/* Minimum 16px gap between buttons */}
            {secondaryActions.map((action, index) => (
              <button
                key={index}
                type="button"
                onClick={action.onClick}
                disabled={action.disabled}
                className={cn(
                  'rounded border px-4 py-2 text-sm font-medium transition hover:bg-muted',
                  action.disabled && 'cursor-not-allowed opacity-50',
                )}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Standardized Form Field Component
 * Consistent spacing, labels, and input styling
 */

export interface AmroFormFieldProps {
  label: string;
  required?: boolean;
  helpText?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}

export function AmroFormField({
  label,
  required = false,
  helpText,
  error,
  children,
  className,
}: AmroFormFieldProps): JSX.Element {
  return (
    <div className={cn('space-y-2', className)}>
      {/* Form Label: 14px / 500 */}
      <label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </label>
      
      {/* Form Input */}
      <div className="space-y-1">
        {children}
        
        {/* Help Text: 13px / 400 / muted */}
        {helpText && !error && (
          <p className="text-sm text-muted-foreground">{helpText}</p>
        )}
        
        {/* Error Text: 13px / 400 / destructive */}
        {error && (
          <p className="text-sm text-destructive" role="alert">{error}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Standardized Form Layout Component
 * Implements consistent spacing and grid structure
 */

export interface AmroFormLayoutProps {
  children: ReactNode;
  columns?: 1 | 2 | 3;
  className?: string;
}

export function AmroFormLayout({
  children,
  columns = 1,
  className,
}: AmroFormLayoutProps): JSX.Element {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  };

  return (
    <div className={cn('grid gap-4', gridCols[columns], className)}>
      {children}
    </div>
  );
}
