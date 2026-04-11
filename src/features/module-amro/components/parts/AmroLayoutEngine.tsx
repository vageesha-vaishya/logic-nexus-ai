import React from 'react';
import { cn } from '@/lib/utils';

/**
 * AMRO LayoutEngine - 12-Column CSS Grid System
 * 
 * Breakpoints:
 * - 320px: 4 columns, 8px margins
 * - 768px: 8 columns, 12px margins
 * - 1024px: 12 columns, 16px margins
 * - 1440px: 12 columns (max-width: 1280px), 24px margins
 * 
 * Usage:
 * <AmroLayoutEngine variant="page">
 *   <AmroGrid span={12}>{content}</AmroGrid>
 *   <AmroGrid span={6}>{left}</AmroGrid>
 *   <AmroGrid span={6}>{right}</AmroGrid>
 * </AmroLayoutEngine>
 */

// ============================================================================
// LayoutEngine Variants
// ============================================================================

export type LayoutEngineVariant = 'page' | 'section' | 'card' | 'toolbar';

export interface LayoutEngineProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: LayoutEngineVariant;
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const maxWidthClasses: Record<NonNullable<LayoutEngineProps['maxWidth']>, string> = {
  sm: 'max-w-[640px]',
  md: 'max-w-[768px]',
  lg: 'max-w-[1024px]',
  xl: 'max-w-[1280px]',
  full: 'max-w-full',
};

const variantClasses: Record<LayoutEngineVariant, string> = {
  page: 'amro-layout-page',
  section: 'amro-layout-section',
  card: 'amro-layout-card',
  toolbar: 'amro-layout-toolbar',
};

/**
 * AmroLayoutEngine - Master layout container
 * 
 * Provides consistent margins, padding, and max-width across all AMRO pages
 */
export function AmroLayoutEngine({
  variant = 'page',
  children,
  className,
  maxWidth = 'xl',
  ...props
}: LayoutEngineProps) {
  return (
    <div
      className={cn(
        variantClasses[variant],
        maxWidthClasses[maxWidth],
        'w-full',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Grid Component - 12-Column Grid System
// ============================================================================

export interface AmroGridProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  /** Number of columns to span (1-12) */
  span?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  /** Start column (1-12) */
  start?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  /** Responsive spans for mobile/tablet/desktop */
  spanMobile?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  spanTablet?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  spanDesktop?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  /** Gap between grid items */
  gap?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
}

const spanClasses: Record<number, string> = {
  1: 'col-span-1',
  2: 'col-span-2',
  3: 'col-span-3',
  4: 'col-span-4',
  5: 'col-span-5',
  6: 'col-span-6',
  7: 'col-span-7',
  8: 'col-span-8',
  9: 'col-span-9',
  10: 'col-span-10',
  11: 'col-span-11',
  12: 'col-span-12',
};

const startClasses: Record<number, string> = {
  1: 'col-start-1',
  2: 'col-start-2',
  3: 'col-start-3',
  4: 'col-start-4',
  5: 'col-start-5',
  6: 'col-start-6',
  7: 'col-start-7',
  8: 'col-start-8',
  9: 'col-start-9',
  10: 'col-start-10',
  11: 'col-start-11',
  12: 'col-start-12',
};

const gapClasses: Record<NonNullable<AmroGridProps['gap']>, string> = {
  none: 'gap-0',
  sm: 'gap-2',      // 8px
  md: 'gap-4',      // 16px
  lg: 'gap-6',      // 24px
  xl: 'gap-8',      // 32px
};

/**
 * AmroGrid - 12-column grid item
 * 
 * Supports responsive spans via spanMobile, spanTablet, spanDesktop
 */
export function AmroGrid({
  children,
  className,
  span = 12,
  start,
  spanMobile,
  spanTablet,
  spanDesktop,
  gap = 'lg',
  ...props
}: AmroGridProps) {
  // Build responsive grid classes
  const responsiveClasses = [
    spanMobile && `sm:${spanClasses[spanMobile]}`,
    spanTablet && `md:${spanClasses[spanTablet]}`,
    spanDesktop && `lg:${spanClasses[spanDesktop]}`,
    `lg:${spanClasses[span]}`,
  ].filter(Boolean).join(' ');

  return (
    <div
      className={cn(
        'grid',
        gapClasses[gap],
        'grid-cols-4',           // Mobile: 4 columns
        'md:grid-cols-8',        // Tablet: 8 columns
        'lg:grid-cols-12',       // Desktop: 12 columns
        spanMobile ? `sm:${spanClasses[spanMobile]}` : spanClasses[span],
        spanTablet && `md:${spanClasses[spanTablet]}`,
        spanDesktop && `lg:${spanClasses[spanDesktop]}`,
        `lg:${spanClasses[span]}`,
        start && startClasses[start],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Section Component
// ============================================================================

export interface AmroSectionProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  className?: string;
  title?: string;
  actions?: React.ReactNode;
  padding?: 'none' | 'compact' | 'default' | 'spacious';
}

const sectionPaddingClasses: Record<NonNullable<AmroSectionProps['padding']>, string> = {
  none: 'p-0',
  compact: 'p-4',       // 16px
  default: 'p-6',       // 24px
  spacious: 'p-8',      // 32px
};

/**
 * AmroSection - Section container with optional title and actions
 * 
 * Implements progressive disclosure with 25% increased white space
 */
export function AmroSection({
  children,
  className,
  title,
  actions,
  padding = 'default',
  ...props
}: AmroSectionProps) {
  return (
    <section
      className={cn(
        'amro-section',
        sectionPaddingClasses[padding],
        'mb-8',  // 32px gap between sections (25% increase from 24px)
        className
      )}
      {...props}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between mb-6">
          {title && (
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              {title}
            </h2>
          )}
          {actions && (
            <div className="flex items-center gap-2">
              {actions}
            </div>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

// ============================================================================
// Card Component - Decluttered with subtle shadows
// ============================================================================

export interface AmroCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'compact' | 'interactive' | 'elevated';
}

const cardVariantClasses: Record<NonNullable<AmroCardProps['variant']>, string> = {
  default: 'amro-card-default',
  compact: 'amro-card-compact',
  interactive: 'amro-card-interactive',
  elevated: 'amro-card-elevated',
};

/**
 * AmroCard - Card container with decluttered design
 * 
 * Replaces borders with subtle box-shadows
 * Implements 8px grid spacing
 */
export function AmroCard({
  children,
  className,
  variant = 'default',
  ...props
}: AmroCardProps) {
  return (
    <div
      className={cn(
        'amro-card',
        cardVariantClasses[variant],
        'rounded-lg',
        'bg-white',
        'border border-border/50',  // Subtle border
        'transition-shadow duration-200',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Toolbar Component
// ============================================================================

export interface AmroToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  padding?: 'compact' | 'default' | 'spacious';
}

const toolbarPaddingClasses: Record<NonNullable<AmroToolbarProps['padding']>, string> = {
  compact: 'px-4 py-2',
  default: 'px-6 py-3',
  spacious: 'px-8 py-4',
};

/**
 * AmroToolbar - Toolbar container with consistent spacing
 */
export function AmroToolbar({
  children,
  className,
  padding = 'default',
  ...props
}: AmroToolbarProps) {
  return (
    <div
      className={cn(
        'amro-toolbar',
        toolbarPaddingClasses[padding],
        'flex items-center gap-3',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
