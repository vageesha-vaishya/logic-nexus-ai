import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface FormSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
}

export const FormSection: React.FC<FormSectionProps> = ({ title, description, actions, className, children, ...props }) => {
  return (
    <Card className={cn("bg-background", className)} {...props}>
      {(title || description || actions) && (
        <CardHeader className={cn(actions ? "flex flex-row items-center justify-between" : undefined)}>
          <div>
            {title && <CardTitle>{title}</CardTitle>}
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
    </Card>
  );
};

interface FormGridProps extends React.HTMLAttributes<HTMLDivElement> {
  columns?: 1 | 2 | 3;
}

export const FormGrid: React.FC<FormGridProps> = ({ columns = 2, className, children, ...props }) => {
  const gridCols = columns === 1 ? "grid-cols-1" : columns === 3 ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-2";
  return (
    <div className={cn("grid gap-4", gridCols, className)} {...props}>
      {children}
    </div>
  );
};