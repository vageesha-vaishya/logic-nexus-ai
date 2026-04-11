import React from 'react';
import { cn } from '@/lib/utils';

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level?: HeadingLevel;
  children: React.ReactNode;
  className?: string;
}

/**
 * Unified Heading Component
 * 
 * Implements Major Third (1.25x) ratio scale with proper visual hierarchy.
 * Ensures consistent typography across all application screens.
 * 
 * Usage:
 * <Heading level={1}>Page Title</Heading>
 * <Heading level={2}>Section Title</Heading>
 * <Heading level={3} className="text-primary">Custom Color</Heading>
 */
export function Heading({ level = 1, children, className, ...props }: HeadingProps) {
  const Component = `h${level}` as keyof JSX.IntrinsicElements;

  const headingStyles: Record<HeadingLevel, string> = {
    1: 'heading-1',    // 30px - Page titles
    2: 'heading-2',    // 24px - Page subtitles / Section headers
    3: 'heading-3',    // 20px - Card titles / Major sections
    4: 'heading-4',    // 18px - Section headings
    5: 'heading-5',    // 16px - Subsection headers
    6: 'heading-6',    // 12px - Captions / Labels / Badges
  };

  return (
    <Component
      className={cn(headingStyles[level], className)}
      {...props}
    >
      {children}
    </Component>
  );
}

// Convenience components for common heading levels
export function H1({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <Heading level={1} className={className} {...props} />;
}

export function H2({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <Heading level={2} className={className} {...props} />;
}

export function H3({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <Heading level={3} className={className} {...props} />;
}

export function H4({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <Heading level={4} className={className} {...props} />;
}

export function H5({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <Heading level={5} className={className} {...props} />;
}

export function H6({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <Heading level={6} className={className} {...props} />;
}
