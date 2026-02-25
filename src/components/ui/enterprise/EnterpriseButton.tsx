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
