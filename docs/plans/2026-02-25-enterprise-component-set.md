# Enterprise Component Set Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build 6 missing enterprise components (Table, Card, Modal, Header, Button, Form) to complete the enterprise design system and ensure consistency across all modules.

**Architecture:** Each component extends the existing enterprise pattern (subtle shadows, gray borders, purple accent color #714B67). Components use Radix UI primitives, Tailwind CSS, and are fully typed with TypeScript. All components export from a single index file for easy imports.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Radix UI, Framer Motion, Lucide React icons

**Design Tokens Used:**
- Primary Color: `#714B67` (purple accent)
- Borders: `border-gray-200`
- Shadows: `shadow-[0_1px_4px_rgba(0,0,0,0.05)]` (subtle)
- Spacing: `gap-6` (default), `p-6` (section padding)
- Text: `text-sm` (standard), `text-gray-900` (primary text), `text-muted-foreground` (secondary)

---

## Task 1: EnterpriseTable Component

**Files:**
- Create: `src/components/ui/enterprise/EnterpriseTable.tsx`
- Modify: `src/components/ui/enterprise/index.ts` (add export)

**Step 1: Create the EnterpriseTable component**

```tsx
// src/components/ui/enterprise/EnterpriseTable.tsx
import React from 'react';
import { cn } from '@/lib/utils';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

export interface Column<T> {
  key: string;
  label: string;
  width?: string; // e.g., "200px", "1fr"
  sortable?: boolean;
  render?: (value: any, row: T, index: number) => React.ReactNode;
  headerClassName?: string;
  cellClassName?: string;
}

export interface EnterpriseTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey?: (row: T, index: number) => string | number;
  onRowClick?: (row: T, index: number) => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: string, order: 'asc' | 'desc') => void;
  isLoading?: boolean;
  emptyState?: React.ReactNode;
  rowClassName?: string;
  className?: string;
  headerClassName?: string;
  striped?: boolean; // Alternate row colors
  hover?: boolean; // Show hover effect
}

export function EnterpriseTable<T extends Record<string, any>>({
  columns,
  data,
  rowKey = (_, i) => i,
  onRowClick,
  sortBy,
  sortOrder = 'asc',
  onSort,
  isLoading = false,
  emptyState,
  rowClassName,
  className,
  headerClassName,
  striped = true,
  hover = true,
}: EnterpriseTableProps<T>) {
  if (isLoading) {
    return (
      <div className="border border-gray-200 rounded-sm overflow-hidden">
        <div className="animate-pulse space-y-2 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="border border-gray-200 rounded-sm bg-white p-12 text-center">
        {emptyState || (
          <div className="text-muted-foreground">
            <p className="text-sm">No data available</p>
          </div>
        )}
      </div>
    );
  }

  const handleSort = (columnKey: string) => {
    if (!onSort) return;
    const newOrder = sortBy === columnKey && sortOrder === 'asc' ? 'desc' : 'asc';
    onSort(columnKey, newOrder);
  };

  const SortIcon = ({ column }: { column: Column<T> }) => {
    if (!column.sortable || !onSort) return null;
    const isActive = sortBy === column.key;
    return (
      <span className="inline-flex ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isActive && <ChevronsUpDown className="h-4 w-4 text-gray-400" />}
        {isActive && sortOrder === 'asc' && <ChevronUp className="h-4 w-4 text-primary" />}
        {isActive && sortOrder === 'desc' && <ChevronDown className="h-4 w-4 text-primary" />}
      </span>
    );
  };

  return (
    <div className={cn('border border-gray-200 rounded-sm overflow-hidden bg-white', className)}>
      <table className="w-full">
        <thead>
          <tr className={cn('border-b border-gray-200 bg-gray-50/50', headerClassName)}>
            {columns.map((column) => (
              <th
                key={column.key}
                style={{ width: column.width }}
                className={cn(
                  'px-4 py-3 text-left text-sm font-semibold text-gray-900',
                  column.sortable && onSort && 'cursor-pointer hover:bg-gray-100 transition-colors group',
                  column.headerClassName
                )}
                onClick={() => column.sortable && handleSort(column.key)}
              >
                <div className="flex items-center">
                  {column.label}
                  <SortIcon column={column} />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={rowKey(row, rowIndex)}
              className={cn(
                'border-b border-gray-200 text-sm',
                striped && rowIndex % 2 === 0 && 'bg-gray-50/30',
                hover && 'hover:bg-gray-50 transition-colors',
                onRowClick && 'cursor-pointer',
                rowClassName
              )}
              onClick={() => onRowClick?.(row, rowIndex)}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    'px-4 py-3 text-gray-700',
                    column.cellClassName
                  )}
                >
                  {column.render
                    ? column.render(row[column.key], row, rowIndex)
                    : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Step 2: Add export to index file**

```tsx
// Add to src/components/ui/enterprise/index.ts (create if doesn't exist)
export { EnterpriseTable } from './EnterpriseTable';
export type { Column, EnterpriseTableProps } from './EnterpriseTable';
```

**Step 3: Test the component manually**

Navigate to a page with data (like AccountDetail) and verify:
- Table renders with correct styling
- Columns align properly
- Hover state works
- Striped rows display correctly

**Step 4: Commit**

```bash
git add src/components/ui/enterprise/EnterpriseTable.tsx src/components/ui/enterprise/index.ts
git commit -m "feat(enterprise): add EnterpriseTable component with sorting support"
```

---

## Task 2: EnterpriseCard Component

**Files:**
- Create: `src/components/ui/enterprise/EnterpriseCard.tsx`
- Modify: `src/components/ui/enterprise/index.ts` (add export)

**Step 1: Create the EnterpriseCard component**

```tsx
// src/components/ui/enterprise/EnterpriseCard.tsx
import React from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export interface EnterpriseCardProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  clickable?: boolean;
  onClick?: () => void;
  variant?: 'default' | 'outlined' | 'elevated';
}

export function EnterpriseCard({
  title,
  description,
  icon,
  children,
  footer,
  actions,
  className,
  headerClassName,
  bodyClassName,
  footerClassName,
  clickable = false,
  onClick,
  variant = 'default',
}: EnterpriseCardProps) {
  const variantClasses = {
    default: 'bg-white border border-gray-200 shadow-[0_1px_4px_rgba(0,0,0,0.05)]',
    outlined: 'bg-white border border-gray-200',
    elevated: 'bg-white border border-gray-200 shadow-[0_4px_12px_rgba(0,0,0,0.08)]',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className={cn(
        'rounded-sm overflow-hidden transition-all',
        variantClasses[variant],
        clickable && 'cursor-pointer hover:shadow-[0_8px_16px_rgba(0,0,0,0.1)]',
        className
      )}
    >
      {/* Header */}
      {(title || description || actions) && (
        <div
          className={cn(
            'px-4 py-3 border-b border-gray-200 bg-gray-50/50 flex items-start justify-between',
            headerClassName
          )}
        >
          <div className="flex items-start gap-3">
            {icon && <div className="text-gray-600 mt-0.5">{icon}</div>}
            <div>
              {title && <h3 className="text-sm font-semibold text-gray-900">{title}</h3>}
              {description && (
                <p className="text-xs text-muted-foreground mt-1">{description}</p>
              )}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}

      {/* Body */}
      <div className={cn('p-4', bodyClassName)}>
        {children}
      </div>

      {/* Footer */}
      {footer && (
        <div
          className={cn(
            'px-4 py-3 border-t border-gray-200 bg-gray-50/50',
            footerClassName
          )}
        >
          {footer}
        </div>
      )}
    </motion.div>
  );
}
```

**Step 2: Add export to index file**

```tsx
// Add to src/components/ui/enterprise/index.ts
export { EnterpriseCard } from './EnterpriseCard';
export type { EnterpriseCardProps } from './EnterpriseCard';
```

**Step 3: Test the component**

Create a test page or modify an existing one to show all variants:
- Card with title + description
- Card with actions
- Card with footer
- Clickable card with hover effect

**Step 4: Commit**

```bash
git add src/components/ui/enterprise/EnterpriseCard.tsx src/components/ui/enterprise/index.ts
git commit -m "feat(enterprise): add EnterpriseCard component with multiple variants"
```

---

## Task 3: EnterpriseModal Component

**Files:**
- Create: `src/components/ui/enterprise/EnterpriseModal.tsx`
- Modify: `src/components/ui/enterprise/index.ts` (add export)

**Step 1: Create the EnterpriseModal component**

```tsx
// src/components/ui/enterprise/EnterpriseModal.tsx
import React from 'react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { motion } from 'framer-motion';

export interface EnterpriseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  footerClassName?: string;
}

export function EnterpriseModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
  headerClassName,
  contentClassName,
  footerClassName,
}: EnterpriseModalProps) {
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          sizeClasses[size],
          'border-gray-200 shadow-[0_20px_25px_rgba(0,0,0,0.1)]',
          className
        )}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
        >
          <DialogHeader className={cn('border-b border-gray-200 pb-4', headerClassName)}>
            <DialogTitle className="text-lg font-semibold text-gray-900">
              {title}
            </DialogTitle>
            {description && (
              <DialogDescription className="text-sm text-muted-foreground mt-1">
                {description}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className={cn('py-4', contentClassName)}>
            {children}
          </div>

          {footer && (
            <DialogFooter className={cn('border-t border-gray-200 pt-4 mt-4', footerClassName)}>
              {footer}
            </DialogFooter>
          )}
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Add export to index file**

```tsx
// Add to src/components/ui/enterprise/index.ts
export { EnterpriseModal } from './EnterpriseModal';
export type { EnterpriseModalProps } from './EnterpriseModal';
```

**Step 3: Test the component**

Create a demo showing:
- Modal opening/closing
- Different sizes
- With/without description
- With/without footer

**Step 4: Commit**

```bash
git add src/components/ui/enterprise/EnterpriseModal.tsx src/components/ui/enterprise/index.ts
git commit -m "feat(enterprise): add EnterpriseModal component with multiple sizes"
```

---

## Task 4: EnterpriseHeader Component

**Files:**
- Create: `src/components/ui/enterprise/EnterpriseHeader.tsx`
- Modify: `src/components/ui/enterprise/index.ts` (add export)

**Step 1: Create the EnterpriseHeader component**

```tsx
// src/components/ui/enterprise/EnterpriseHeader.tsx
import React from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export interface EnterpriseHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  icon?: React.ReactNode;
  status?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  titleClassName?: string;
  contentClassName?: string;
  variant?: 'default' | 'compact' | 'large';
}

export function EnterpriseHeader({
  title,
  subtitle,
  description,
  icon,
  status,
  actions,
  className,
  titleClassName,
  contentClassName,
  variant = 'default',
}: EnterpriseHeaderProps) {
  const variantClasses = {
    default: 'px-6 py-4',
    compact: 'px-4 py-2',
    large: 'px-8 py-6',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'bg-white border-b border-gray-200',
        variantClasses[variant],
        className
      )}
    >
      <div className={cn('flex items-start justify-between gap-4', contentClassName)}>
        <div className="flex items-start gap-4 flex-1">
          {icon && <div className="text-gray-600 mt-1">{icon}</div>}
          <div className="flex-1">
            <h1
              className={cn(
                'text-lg font-bold text-gray-900',
                variant === 'large' && 'text-2xl',
                variant === 'compact' && 'text-base',
                titleClassName
              )}
            >
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm font-medium text-muted-foreground mt-0.5">
                {subtitle}
              </p>
            )}
            {description && (
              <p className="text-sm text-muted-foreground mt-1">
                {description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {status && <div>{status}</div>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </div>
    </motion.div>
  );
}
```

**Step 2: Add export to index file**

```tsx
// Add to src/components/ui/enterprise/index.ts
export { EnterpriseHeader } from './EnterpriseHeader';
export type { EnterpriseHeaderProps } from './EnterpriseHeader';
```

**Step 3: Test the component**

Show:
- Different variants (default, compact, large)
- With/without icon
- With/without status badge
- With actions

**Step 4: Commit**

```bash
git add src/components/ui/enterprise/EnterpriseHeader.tsx src/components/ui/enterprise/index.ts
git commit -m "feat(enterprise): add EnterpriseHeader component with multiple variants"
```

---

## Task 5: EnterpriseButton Component

**Files:**
- Create: `src/components/ui/enterprise/EnterpriseButton.tsx`
- Modify: `src/components/ui/enterprise/index.ts` (add export)

**Step 1: Create the EnterpriseButton component**

```tsx
// src/components/ui/enterprise/EnterpriseButton.tsx
import React from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export interface EnterpriseButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  children: React.ReactNode;
}

export const EnterpriseButton = React.forwardRef<
  HTMLButtonElement,
  EnterpriseButtonProps
>(
  (
    {
      variant = 'primary',
      size = 'md',
      icon,
      iconPosition = 'left',
      loading = false,
      children,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const variantClasses = {
      primary:
        'bg-[#714B67] text-white hover:bg-[#5d3d54] disabled:bg-gray-300 disabled:text-gray-500',
      secondary:
        'bg-gray-100 text-gray-900 hover:bg-gray-200 disabled:bg-gray-100 disabled:text-gray-400',
      destructive:
        'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300 disabled:text-red-100',
      ghost:
        'bg-transparent text-gray-900 hover:bg-gray-100 disabled:text-gray-400',
      outline:
        'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50 disabled:border-gray-200 disabled:text-gray-400',
    };

    const sizeClasses = {
      sm: 'px-3 py-1.5 text-xs font-medium rounded-sm',
      md: 'px-4 py-2 text-sm font-medium rounded-sm',
      lg: 'px-6 py-2.5 text-base font-semibold rounded-sm',
    };

    return (
      <motion.button
        ref={ref}
        whileHover={!disabled && !loading ? { scale: 1.02 } : {}}
        whileTap={!disabled && !loading ? { scale: 0.98 } : {}}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium transition-all',
          'focus:outline-none focus:ring-2 focus:ring-[#714B67]/20 focus:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-60',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <>
            <svg
              className="h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Loading...</span>
          </>
        ) : (
          <>
            {icon && iconPosition === 'left' && <span>{icon}</span>}
            <span>{children}</span>
            {icon && iconPosition === 'right' && <span>{icon}</span>}
          </>
        )}
      </motion.button>
    );
  }
);

EnterpriseButton.displayName = 'EnterpriseButton';
```

**Step 2: Add export to index file**

```tsx
// Add to src/components/ui/enterprise/index.ts
export { EnterpriseButton } from './EnterpriseButton';
export type { EnterpriseButtonProps } from './EnterpriseButton';
```

**Step 3: Test the component**

Show all variants and sizes:
- Primary, Secondary, Destructive, Ghost, Outline
- Small, Medium, Large
- With icons (left/right)
- Loading state
- Disabled state

**Step 4: Commit**

```bash
git add src/components/ui/enterprise/EnterpriseButton.tsx src/components/ui/enterprise/index.ts
git commit -m "feat(enterprise): add EnterpriseButton component with multiple variants and sizes"
```

---

## Task 6: EnterpriseForm Component

**Files:**
- Create: `src/components/ui/enterprise/EnterpriseForm.tsx`
- Modify: `src/components/ui/enterprise/index.ts` (add export)

**Step 1: Create the EnterpriseForm component**

```tsx
// src/components/ui/enterprise/EnterpriseForm.tsx
import React from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export interface EnterpriseFormProps {
  children: React.ReactNode;
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  className?: string;
  sectionClassName?: string;
}

export function EnterpriseForm({
  children,
  onSubmit,
  className,
  sectionClassName,
}: EnterpriseFormProps) {
  return (
    <form onSubmit={onSubmit} className={cn('space-y-6', className)}>
      {children}
    </form>
  );
}

export interface EnterpriseFormSectionProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export function EnterpriseFormSection({
  title,
  description,
  children,
  className,
  contentClassName,
}: EnterpriseFormSectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={cn('bg-white border border-gray-200 rounded-sm overflow-hidden', className)}
    >
      {(title || description) && (
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
          {title && <h2 className="text-base font-semibold text-gray-900">{title}</h2>}
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
      )}
      <div className={cn('p-6 space-y-6', contentClassName)}>
        {children}
      </div>
    </motion.div>
  );
}

export interface EnterpriseFormRowProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3;
  className?: string;
}

export function EnterpriseFormRow({
  children,
  columns = 2,
  className,
}: EnterpriseFormRowProps) {
  const columnClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-3',
  };

  return (
    <div
      className={cn('grid gap-6', columnClasses[columns], className)}
    >
      {children}
    </div>
  );
}

export interface EnterpriseFormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

export function EnterpriseFormField({
  label,
  required = false,
  error,
  hint,
  children,
  className,
}: EnterpriseFormFieldProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label className="text-sm font-medium text-gray-900">
        {label}
        {required && <span className="text-red-600 ml-1">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
```

**Step 2: Add exports to index file**

```tsx
// Add to src/components/ui/enterprise/index.ts
export { EnterpriseForm, EnterpriseFormSection, EnterpriseFormRow, EnterpriseFormField } from './EnterpriseForm';
export type { EnterpriseFormProps, EnterpriseFormSectionProps, EnterpriseFormRowProps, EnterpriseFormFieldProps } from './EnterpriseForm';
```

**Step 3: Test the component**

Create a test form showing:
- Single section with multiple fields
- Multiple sections
- Different column layouts (1, 2, 3)
- Required field indicators
- Validation errors
- Hints/help text

**Step 4: Commit**

```bash
git add src/components/ui/enterprise/EnterpriseForm.tsx src/components/ui/enterprise/index.ts
git commit -m "feat(enterprise): add EnterpriseForm component with section and field wrappers"
```

---

## Task 7: Create Enterprise Components Index Export

**Files:**
- Create: `src/components/ui/enterprise/index.ts`

**Step 1: Create the index file with all exports**

```tsx
// src/components/ui/enterprise/index.ts
// Components
export { EnterpriseSheet, EnterpriseField, EnterpriseStatButton } from './EnterpriseComponents';
export { EnterpriseFormLayout } from './EnterpriseFormLayout';
export { EnterpriseNotebook, EnterpriseTab } from './EnterpriseTabs';
export { EnterpriseActivityFeed } from './EnterpriseActivityFeed';
export { EnterpriseTable } from './EnterpriseTable';
export { EnterpriseCard } from './EnterpriseCard';
export { EnterpriseModal } from './EnterpriseModal';
export { EnterpriseHeader } from './EnterpriseHeader';
export { EnterpriseButton } from './EnterpriseButton';
export { EnterpriseForm, EnterpriseFormSection, EnterpriseFormRow, EnterpriseFormField } from './EnterpriseForm';

// Types
export type { EnterpriseSheetProps, EnterpriseFieldProps, EnterpriseStatButtonProps } from './EnterpriseComponents';
export type { EnterpriseTableProps, Column } from './EnterpriseTable';
export type { EnterpriseCardProps } from './EnterpriseCard';
export type { EnterpriseModalProps } from './EnterpriseModal';
export type { EnterpriseHeaderProps } from './EnterpriseHeader';
export type { EnterpriseButtonProps } from './EnterpriseButton';
export type {
  EnterpriseFormProps,
  EnterpriseFormSectionProps,
  EnterpriseFormRowProps,
  EnterpriseFormFieldProps
} from './EnterpriseForm';
```

**Step 2: Verify all imports work**

Run TypeScript check:
```bash
npm run typecheck
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/components/ui/enterprise/index.ts
git commit -m "feat(enterprise): add comprehensive index export for all enterprise components"
```

---

## Task 8: Update Existing Pages to Use New Components

**Files:**
- Modify: `src/pages/dashboard/AccountDetail.tsx` (use EnterpriseTable for related data)
- Modify: `src/pages/dashboard/ContactDetail.tsx` (use EnterpriseTable for related data)

**Step 1: Update AccountDetail.tsx to use EnterpriseTable**

In the related contacts/opportunities sections, replace the current display with:

```tsx
import { EnterpriseTable, Column } from '@/components/ui/enterprise';

// In the render section for related contacts:
const contactColumns: Column<any>[] = [
  { key: 'first_name', label: 'First Name', width: '150px' },
  { key: 'last_name', label: 'Last Name', width: '150px' },
  { key: 'email', label: 'Email', width: '200px' },
  { key: 'phone', label: 'Phone', width: '150px' },
  {
    key: 'title',
    label: 'Title',
    width: '150px',
    render: (value) => value || '-'
  },
];

// In JSX:
<EnterpriseCard
  title="Related Contacts"
  description={`${relatedContacts.length} contacts`}
>
  <EnterpriseTable
    columns={contactColumns}
    data={relatedContacts}
    rowKey={(row) => row.id}
    onRowClick={(row) => navigate(`/contacts/${row.id}`)}
    emptyState={<p className="text-center py-8 text-muted-foreground">No contacts</p>}
  />
</EnterpriseCard>
```

**Step 2: Test AccountDetail**

Verify:
- Related contacts display in table format
- Table is clickable and navigates
- Empty state shows when no contacts

**Step 3: Commit**

```bash
git add src/pages/dashboard/AccountDetail.tsx
git commit -m "refactor(crm): update AccountDetail to use EnterpriseTable and EnterpriseCard"
```

**Step 4: Update ContactDetail.tsx similarly**

Follow the same pattern for ContactDetail.

**Step 5: Commit**

```bash
git add src/pages/dashboard/ContactDetail.tsx
git commit -m "refactor(crm): update ContactDetail to use EnterpriseTable and EnterpriseCard"
```

---

## Task 9: Create Storybook Stories for All Components

**Files:**
- Create: `src/components/ui/enterprise/EnterpriseComponents.stories.tsx`

**Step 1: Create Storybook story file**

```tsx
// src/components/ui/enterprise/EnterpriseComponents.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { EnterpriseTable, Column } from './EnterpriseTable';
import { EnterpriseCard } from './EnterpriseCard';
import { EnterpriseModal } from './EnterpriseModal';
import { EnterpriseHeader } from './EnterpriseHeader';
import { EnterpriseButton } from './EnterpriseButton';
import { EnterpriseForm, EnterpriseFormSection, EnterpriseFormRow, EnterpriseFormField } from './EnterpriseForm';
import { Input } from '@/components/ui/input';
import { Settings, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

// Table Stories
const meta: Meta<typeof EnterpriseTable> = {
  component: EnterpriseTable,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof meta>;

const sampleData = [
  { id: 1, name: 'Acme Corp', email: 'contact@acme.com', status: 'Active' },
  { id: 2, name: 'Tech Inc', email: 'hello@techinc.com', status: 'Active' },
  { id: 3, name: 'Startup Co', email: 'info@startup.co', status: 'Inactive' },
];

const sampleColumns: Column<typeof sampleData[0]>[] = [
  { key: 'name', label: 'Company Name', sortable: true, width: '200px' },
  { key: 'email', label: 'Email', sortable: true, width: '250px' },
  { key: 'status', label: 'Status', width: '100px' },
];

export const Table: Story = {
  render: (args) => {
    const [sortBy, setSortBy] = useState<string>();
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    return (
      <EnterpriseTable
        {...args}
        columns={sampleColumns}
        data={sampleData}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={(key, order) => {
          setSortBy(key);
          setSortOrder(order);
        }}
      />
    );
  },
};

export const CardDefault: Story = {
  render: () => (
    <EnterpriseCard
      title="Account Summary"
      description="View account details"
      icon={<Settings className="h-4 w-4" />}
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-700">This is sample card content.</p>
      </div>
    </EnterpriseCard>
  ),
};

export const CardElevated: Story = {
  render: () => (
    <EnterpriseCard
      title="Elevated Card"
      description="With higher shadow"
      variant="elevated"
      actions={<EnterpriseButton size="sm">Action</EnterpriseButton>}
    >
      <p className="text-sm text-gray-700">Elevated card with action button.</p>
    </EnterpriseCard>
  ),
};

export const Header: Story = {
  render: () => (
    <EnterpriseHeader
      title="Account Details"
      subtitle="ACME Corporation"
      description="Primary account record"
      icon={<Settings className="h-5 w-5" />}
      actions={<EnterpriseButton size="sm">Edit</EnterpriseButton>}
    />
  ),
};

export const Buttons: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="flex gap-2">
        <EnterpriseButton variant="primary">Primary</EnterpriseButton>
        <EnterpriseButton variant="secondary">Secondary</EnterpriseButton>
        <EnterpriseButton variant="destructive">Delete</EnterpriseButton>
      </div>
      <div className="flex gap-2">
        <EnterpriseButton size="sm">Small</EnterpriseButton>
        <EnterpriseButton size="md">Medium</EnterpriseButton>
        <EnterpriseButton size="lg">Large</EnterpriseButton>
      </div>
      <div className="flex gap-2">
        <EnterpriseButton icon={<Plus className="h-4 w-4" />}>With Icon</EnterpriseButton>
        <EnterpriseButton loading>Loading...</EnterpriseButton>
        <EnterpriseButton disabled>Disabled</EnterpriseButton>
      </div>
    </div>
  ),
};

export const FormExample: Story = {
  render: () => (
    <EnterpriseForm>
      <EnterpriseFormSection
        title="Basic Information"
        description="Enter account information"
      >
        <EnterpriseFormRow columns={2}>
          <EnterpriseFormField
            label="Company Name"
            required
            hint="Legal company name"
          >
            <Input placeholder="Enter company name" />
          </EnterpriseFormField>
          <EnterpriseFormField
            label="Industry"
          >
            <Input placeholder="e.g., Technology" />
          </EnterpriseFormField>
        </EnterpriseFormRow>
      </EnterpriseFormSection>

      <EnterpriseFormSection
        title="Contact Information"
      >
        <EnterpriseFormRow columns={1}>
          <EnterpriseFormField
            label="Email"
            required
            error="Invalid email format"
          >
            <Input placeholder="contact@company.com" />
          </EnterpriseFormField>
        </EnterpriseFormRow>
      </EnterpriseFormSection>

      <div className="flex gap-2">
        <EnterpriseButton variant="primary">Save</EnterpriseButton>
        <EnterpriseButton variant="secondary">Cancel</EnterpriseButton>
      </div>
    </EnterpriseForm>
  ),
};
```

**Step 2: Run Storybook**

```bash
npm run storybook
```

Expected: Storybook opens on http://localhost:6006 with all component stories visible

**Step 3: Commit**

```bash
git add src/components/ui/enterprise/EnterpriseComponents.stories.tsx
git commit -m "docs(storybook): add stories for all enterprise components"
```

---

## Task 10: Update DESIGN_SYSTEM.md with New Components

**Files:**
- Modify: `DESIGN_SYSTEM.md`

**Step 1: Add new components section to DESIGN_SYSTEM.md**

Add this section after the existing components list:

```markdown
## 4. Component Library Extensions (`src/components/ui/enterprise`)

### New Components Added

#### `EnterpriseTable`
A high-density data table for displaying lists of records.
- **Props**: `columns`, `data`, `sortBy`, `sortOrder`, `onSort`, `onRowClick`, `striped`, `hover`
- **Features**: Column-based rendering, sortable columns, striped rows, hover effects
- **Usage**: Account lists, contact lists, opportunity lists

#### `EnterpriseCard`
Versatile card component for grouping related content.
- **Props**: `title`, `description`, `icon`, `children`, `footer`, `actions`, `variant`
- **Variants**: `default`, `outlined`, `elevated`
- **Usage**: Summary cards, grouped data displays, statistics

#### `EnterpriseModal`
Dialog wrapper for forms and confirmations.
- **Props**: `isOpen`, `onClose`, `title`, `description`, `children`, `footer`, `size`
- **Sizes**: `sm`, `md`, `lg`, `xl`
- **Usage**: Confirmation dialogs, form modals, detail views

#### `EnterpriseHeader`
Section/page header with title, subtitle, and actions.
- **Props**: `title`, `subtitle`, `description`, `icon`, `status`, `actions`, `variant`
- **Variants**: `default`, `compact`, `large`
- **Usage**: Page headers, section headers, detail view headers

#### `EnterpriseButton`
Button component with multiple variants and states.
- **Props**: `variant`, `size`, `icon`, `iconPosition`, `loading`, `disabled`
- **Variants**: `primary`, `secondary`, `destructive`, `ghost`, `outline`
- **Sizes**: `sm`, `md`, `lg`
- **Usage**: Form submissions, actions, navigation

#### `EnterpriseForm`
Form layout and field wrappers.
- **Components**: `EnterpriseForm`, `EnterpriseFormSection`, `EnterpriseFormRow`, `EnterpriseFormField`
- **Props**: Sections have `title` and `description`; Fields have `label`, `required`, `error`, `hint`
- **Rows**: Support `columns` prop (1, 2, 3) for responsive layouts
- **Usage**: Account/Contact forms, configuration forms

### Import Pattern

All enterprise components are exported from a single index:

```typescript
import {
  EnterpriseTable,
  EnterpriseCard,
  EnterpriseModal,
  EnterpriseHeader,
  EnterpriseButton,
  EnterpriseForm,
  EnterpriseFormSection,
  EnterpriseFormRow,
  EnterpriseFormField,
  // ... original components
} from '@/components/ui/enterprise';
```

### Design Consistency

All enterprise components follow these principles:
- **Color**: Primary #714B67 (purple), Borders gray-200, Text gray-900
- **Spacing**: `gap-6` between sections, `p-6` standard padding
- **Shadows**: `shadow-[0_1px_4px_rgba(0,0,0,0.05)]` for subtle depth
- **Borders**: `border border-gray-200` for all card-like components
- **Typography**: `text-sm` standard, font weights vary by hierarchy
- **Animations**: Fade-in and slide-in effects (Framer Motion) on load
- **Accessibility**: All components use Radix UI primitives or semantic HTML
```

**Step 2: Commit**

```bash
git add DESIGN_SYSTEM.md
git commit -m "docs: update DESIGN_SYSTEM.md with new enterprise components documentation"
```

---

## Success Criteria

✅ All 6 new enterprise components implemented
✅ Components exported from single index file
✅ Storybook stories created for all components
✅ Existing CRM pages updated to use new components
✅ TypeScript type checking passes
✅ All components follow consistent design patterns
✅ DESIGN_SYSTEM.md updated with new component documentation
✅ 10 git commits with clear messages

---

## Notes for Implementation

- **Design Consistency**: All components use the same color palette, spacing, and animation patterns
- **Accessibility**: Leverage Radix UI primitives (Dialog, Tabs) for built-in accessibility
- **TypeScript**: All components are fully typed with exported interfaces
- **Framer Motion**: Use subtle animations (fade-in, slide-in) with 0.2-0.3s duration
- **Responsive Design**: Use Tailwind's `md:` breakpoints for tablet/desktop layouts
- **Testing**: Manual testing is sufficient for this phase (Storybook provides interactive testing)

---
