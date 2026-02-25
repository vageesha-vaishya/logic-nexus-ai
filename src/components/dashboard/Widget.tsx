import React from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { X, Maximize2 } from 'lucide-react';
import { WidgetSize } from '@/types/dashboardTemplates';

interface WidgetProps {
  id: string;
  title: string;
  size: WidgetSize;
  children: React.ReactNode;
  onRemove?: (id: string) => void;
  onResize?: (id: string, newSize: WidgetSize) => void;
  className?: string;
}

export function Widget({ id, title, size, children, onRemove, onResize, className }: WidgetProps) {
  const sizeClasses = {
    small: 'col-span-1 row-span-1',
    medium: 'col-span-1 md:col-span-2 row-span-2',
    large: 'col-span-2 md:col-span-3 row-span-2',
    full: 'col-span-1 md:col-span-4 row-span-2',
  };

  const handleResize = () => {
    const sizes: WidgetSize[] = ['small', 'medium', 'large', 'full'];
    const currentIndex = sizes.indexOf(size);
    const nextSize = sizes[(currentIndex + 1) % sizes.length];
    onResize?.(id, nextSize);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'bg-white border border-gray-200 rounded-lg shadow-sm p-4 h-full flex flex-col',
        sizeClasses[size],
        className
      )}
    >
      {/* Widget Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <div className="flex items-center gap-2">
          {onResize && (
            <button
              onClick={handleResize}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title="Resize widget"
            >
              <Maximize2 className="h-4 w-4 text-gray-500" />
            </button>
          )}
          {onRemove && (
            <button
              onClick={() => onRemove(id)}
              className="p-1 hover:bg-red-50 rounded transition-colors"
              title="Remove widget"
            >
              <X className="h-4 w-4 text-gray-500 hover:text-red-600" />
            </button>
          )}
        </div>
      </div>

      {/* Widget Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </motion.div>
  );
}
