import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface WidgetContainerProps {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export function WidgetContainer({ 
  title, 
  action, 
  children, 
  className,
  contentClassName 
}: WidgetContainerProps) {
  return (
    <Card className={cn("h-full flex flex-col", className)}>
      {(title || action) && (
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          {title && <CardTitle className="text-base font-medium">{title}</CardTitle>}
          {action && <div className="flex items-center gap-2">{action}</div>}
        </CardHeader>
      )}
      <CardContent className={cn("flex-1", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}
