import React from 'react';
import { Badge } from '@/components/ui/badge';

type ActionsToolbarProps = {
  children: React.ReactNode;
  className?: string;
  label?: string;
  labelVariant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive';
};

export function ActionsToolbar({ children, className = '', label = 'Actions', labelVariant = 'outline' }: ActionsToolbarProps) {
  return (
    <div className={`flex items-center gap-3 mb-2 ${className}`}>
      <Badge variant={labelVariant}>{label}</Badge>
      {children}
    </div>
  );
}

export default ActionsToolbar;