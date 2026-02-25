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
