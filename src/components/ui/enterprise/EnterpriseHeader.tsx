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

const variantClasses = {
  default: {
    container: 'py-6',
    title: 'text-2xl',
    subtitle: 'text-sm',
    description: 'text-sm',
  },
  compact: {
    container: 'py-4',
    title: 'text-lg',
    subtitle: 'text-xs',
    description: 'text-xs',
  },
  large: {
    container: 'py-8',
    title: 'text-4xl',
    subtitle: 'text-base',
    description: 'text-base',
  },
};

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
  const variantClass = variantClasses[variant];

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn(
        'border-b border-gray-200 bg-white',
        variantClass.container,
        className
      )}
    >
      <div className={cn('px-4 md:px-6 flex items-start justify-between gap-6', contentClassName)}>
        {/* Left Content: Icon + Title + Subtitle + Description */}
        <div className="flex items-start gap-4 flex-1 min-w-0">
          {/* Icon */}
          {icon && (
            <div className="flex-shrink-0 text-gray-600 mt-1">
              {icon}
            </div>
          )}

          {/* Text Content */}
          <div className="flex-1 min-w-0">
            {/* Title */}
            <h1
              className={cn(
                'font-bold text-gray-900 leading-tight',
                variantClass.title,
                titleClassName
              )}
            >
              {title}
            </h1>

            {/* Subtitle */}
            {subtitle && (
              <p className={cn('text-gray-600 mt-1', variantClass.subtitle)}>
                {subtitle}
              </p>
            )}

            {/* Description */}
            {description && (
              <p className={cn('text-gray-500 mt-2', variantClass.description)}>
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Right Content: Status + Actions */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Status */}
          {status && (
            <div className="flex items-center">
              {status}
            </div>
          )}

          {/* Actions */}
          {actions && (
            <div className="flex items-center gap-2">
              {actions}
            </div>
          )}
        </div>
      </div>
    </motion.header>
  );
}
