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
