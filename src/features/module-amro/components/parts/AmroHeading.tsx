import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Standardized Heading Component
 * Implements consistent H1-H6 hierarchy with 1.25x ratio
 * WCAG 2.1 AA Compliant
 * 
 * Usage:
 * <AmroHeading level={1}>Page Title</AmroHeading>
 * <AmroHeading level={2} className="text-muted-foreground">Section</AmroHeading>
 */

export type AmroHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface AmroHeadingProps {
  level?: AmroHeadingLevel;
  children: ReactNode;
  className?: string;
  id?: string;
}

// Typography scale with exact specifications
const headingStyles: Record<AmroHeadingLevel, string> = {
  1: 'text-2xl font-semibold leading-tight tracking-tight',    // 24px / 600 / 1.2
  2: 'text-xl font-semibold leading-tight',                    // 20px / 600 / 1.25
  3: 'text-lg font-semibold leading-tight',                    // 18px / 600 / 1.3
  4: 'text-base font-semibold leading-snug',                   // 16px / 600 / 1.35
  5: 'text-sm font-semibold leading-snug',                     // 14px / 600 / 1.375
  6: 'text-xs font-semibold leading-snug uppercase tracking-wide', // 12px / 600 / 1.375
};

// Responsive adjustments for mobile
const responsiveStyles: Record<AmroHeadingLevel, string> = {
  1: 'text-xl sm:text-2xl',  // 20px mobile → 24px desktop
  2: 'text-base sm:text-xl', // 16px mobile → 20px desktop
  3: 'text-base sm:text-lg', // 14px mobile → 18px desktop
  4: 'text-sm sm:text-base', // 14px → 16px
  5: 'text-xs sm:text-sm',   // 12px → 14px
  6: 'text-xs',              // 12px consistent
};

export function AmroHeading({
  level = 1,
  children,
  className,
  id,
}: AmroHeadingProps): JSX.Element {
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  
  return (
    <Tag
      id={id}
      className={cn(
        'text-foreground',
        headingStyles[level],
        responsiveStyles[level],
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/**
 * Convenience components for common heading levels
 */

export function AmroPageTitle({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <AmroHeading level={1} className={cn('mb-4', className)} id={id}>
      {children}
    </AmroHeading>
  );
}

export function AmroSectionTitle({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <AmroHeading level={2} className={cn('mb-3', className)} id={id}>
      {children}
    </AmroHeading>
  );
}

export function AmroCardTitle({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <AmroHeading level={3} className={cn('mb-2', className)} id={id}>
      {children}
    </AmroHeading>
  );
}

export function AmroSubheading({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <AmroHeading level={4} className={cn('mb-2', className)} id={id}>
      {children}
    </AmroHeading>
  );
}
