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

const variantClasses = {
  default: 'bg-white border border-gray-200 shadow-[0_1px_4px_rgba(0,0,0,0.05)]',
  outlined: 'bg-white border border-gray-200',
  elevated: 'bg-white border border-gray-200 shadow-[0_4px_12px_rgba(0,0,0,0.08)]',
};

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
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
        <header
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
        </header>
      )}

      {/* Body */}
      <section className={cn('p-4', bodyClassName)}>
        {children}
      </section>

      {/* Footer */}
      {footer && (
        <footer
          className={cn(
            'px-4 py-3 border-t border-gray-200 bg-gray-50/50',
            footerClassName
          )}
        >
          {footer}
        </footer>
      )}
    </motion.div>
  );
}
