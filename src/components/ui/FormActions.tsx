import React from 'react';
import { cn } from '@/lib/utils';

export interface FormActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'top' | 'bottom' | 'bottom-minimal';
  className?: string;
}

/**
 * FormActions Component
 * 
 * Standardizes CRUD button positioning across all forms.
 * Ensures consistent spacing and visual grouping.
 * 
 * Variants:
 * - 'top': Top-right placement for primary CRUD actions (Create, Edit, Delete)
 * - 'bottom': Bottom-center with border for submit/cancel actions
 * - 'bottom-minimal': Bottom-center without border for minimal forms
 * 
 * Usage:
 * <FormActions variant="top">
 *   <Button>New Record</Button>
 * </FormActions>
 * 
 * <FormActions variant="bottom">
 *   <Button variant="outline" onClick={handleCancel}>Cancel</Button>
 *   <Button onClick={handleSubmit}>Submit</Button>
 * </FormActions>
 */
export function FormActions({ 
  children, 
  variant = 'bottom', 
  className,
  ...props 
}: FormActionsProps) {
  const variantStyles = {
    top: 'form-actions-top',
    bottom: 'form-actions-bottom',
    'bottom-minimal': 'form-actions-minimal',
  };

  return (
    <div
      className={cn(variantStyles[variant], className)}
      {...props}
    >
      {children}
    </div>
  );
}

// Convenience components for common form action patterns
export function FormActionsTop({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <FormActions variant="top" className={className} {...props} />;
}

export function FormActionsBottom({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <FormActions variant="bottom" className={className} {...props} />;
}

export function FormActionsBottomMinimal({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <FormActions variant="bottom-minimal" className={className} {...props} />;
}
