import React from 'react';
import { cn } from '@/lib/utils';

/**
 * AMRO FormActionBar Component - Responsive CRUD Button Positioning
 * 
 * Specifications:
 * - Desktop: Top-right positioning with 24px margin from container edge
 * - Tablet: Bottom-center with full-width buttons
 * - Mobile: Sticky bottom bar
 * - Primary actions (Create, Save) on left
 * - Secondary actions (Update, Delete) on right with 8px gap
 * - Primary CTA: height 40px, min-width 120px
 * - Secondary actions: height 36px, min-width 100px
 * - Touch targets: 44x44px minimum (WCAG 2.1 AA)
 * 
 * Usage:
 * <AmroFormActionBar
 *   primaryActions={[
 *     <Button variant="primary" size="lg">Save</Button>
 *   ]}
 *   secondaryActions={[
 *     <Button variant="outline">Cancel</Button>,
 *     <Button variant="destructive">Delete</Button>
 *   ]}
 * />
 */

// ============================================================================
// Types
// ============================================================================

export type FormActionBarVariant = 'top' | 'bottom' | 'sticky-bottom';
export type FormActionBarLayout = 'split' | 'grouped' | 'stacked';

export interface FormActionBarProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  className?: string;
  /** Primary action buttons (Create, Save) */
  primaryActions?: React.ReactNode;
  /** Secondary action buttons (Cancel, Delete) */
  secondaryActions?: React.ReactNode;
  /** Position variant */
  variant?: FormActionBarVariant;
  /** Button layout pattern */
  layout?: FormActionBarLayout;
  /** Show separator line */
  showSeparator?: boolean;
}

// ============================================================================
// Button Size Variants (per specification)
// ============================================================================

export interface AmroButtonSizeProps {
  variant: 'primary' | 'secondary';
}

export const amroButtonSizes: Record<'primary' | 'secondary', string> = {
  primary: 'amro-btn-primary h-10 min-w-[7.5rem] px-6',      // 40px height, 120px min-width
  secondary: 'amro-btn-secondary h-9 min-w-[6.25rem] px-4',  // 36px height, 100px min-width
};

/**
 * Creates button className for AMRO standardized sizes
 */
export function getAmroButtonClassName(variant: 'primary' | 'secondary', extra?: string): string {
  return cn(
    amroButtonSizes[variant],
    'min-h-[2.75rem]', // 44px touch target for accessibility
    'inline-flex items-center justify-center gap-2',
    'text-sm font-medium',
    'rounded-md',
    'transition-colors duration-200',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    extra
  );
}

// ============================================================================
// Main FormActionBar Component
// ============================================================================

export function AmroFormActionBar({
  children,
  className,
  primaryActions,
  secondaryActions,
  variant = 'top',
  layout = 'split',
  showSeparator = true,
  ...props
}: FormActionBarProps) {
  const variantClasses: Record<FormActionBarVariant, string> = {
    top: 'amro-form-action-top',
    bottom: 'amro-form-action-bottom',
    'sticky-bottom': 'amro-form-action-sticky-bottom',
  };

  // Desktop: top-right with 24px margin (1.5rem)
  // Tablet: bottom-center with full-width buttons
  // Mobile: sticky bottom bar
  return (
    <div
      className={cn(
        'amro-form-action-bar',
        variantClasses[variant],
        variant === 'top' && 'mb-6',
        variant === 'bottom' && 'mt-6 pt-6',
        variant === 'sticky-bottom' && 'sticky bottom-0 z-50',
        showSeparator && (variant === 'bottom' || variant === 'sticky-bottom') && 'border-t border-border',
        className
      )}
      role="toolbar"
      aria-label="Form actions"
      {...props}
    >
      {/* Desktop Layout (≥1024px): Split primary/secondary */}
      {layout === 'split' && (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Primary Actions - Left side */}
          {primaryActions && (
            <div
              className="amro-form-action-primary flex items-center gap-2 lg:justify-start"
              style={{ gap: '0.5rem' }} // 8px gap per specification
              role="group"
              aria-label="Primary actions"
            >
              {primaryActions}
            </div>
          )}

          {/* Secondary Actions - Right side */}
          {secondaryActions && (
            <div
              className="amro-form-action-secondary flex items-center gap-2 lg:justify-end"
              style={{ gap: '0.5rem' }} // 8px gap per specification
              role="group"
              aria-label="Secondary actions"
            >
              {secondaryActions}
            </div>
          )}
        </div>
      )}

      {/* Grouped Layout: All buttons together */}
      {layout === 'grouped' && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {secondaryActions}
          {primaryActions}
        </div>
      )}

      {/* Stacked Layout: Vertical stacking for mobile */}
      {layout === 'stacked' && (
        <div className="flex flex-col gap-3">
          {primaryActions && (
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
              {primaryActions}
            </div>
          )}
          {secondaryActions && (
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
              {secondaryActions}
            </div>
          )}
        </div>
      )}

      {/* Fallback: Direct children */}
      {children}
    </div>
  );
}

// ============================================================================
// Convenience Components
// ============================================================================

/**
 * AmroFormActionPrimary - Primary action button container
 */
export function AmroFormActionPrimary({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'amro-form-action-primary',
        'flex items-center gap-2',
        'justify-start',
        className
      )}
      style={{ gap: '0.5rem' }} // 8px
      role="group"
      aria-label="Primary actions"
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * AmroFormActionSecondary - Secondary action button container
 */
export function AmroFormActionSecondary({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'amro-form-action-secondary',
        'flex items-center gap-2',
        'justify-end',
        className
      )}
      style={{ gap: '0.5rem' }} // 8px
      role="group"
      aria-label="Secondary actions"
      {...props}
    >
      {children}
    </div>
  );
}
