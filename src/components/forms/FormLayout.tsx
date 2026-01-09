import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Props for FormSection, a card-wrapped section block
 * for grouping related form fields with optional header actions.
 * @property title Optional section title
 * @property description Optional section description
 * @property actions Optional right-side header actions
 */
interface FormSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The title of the section.
   */
  title?: string;
  /**
   * Description text explaining the section's purpose.
   */
  description?: string;
  /**
   * Optional actions to display in the header (e.g., buttons).
   */
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

/**
 * Props for FormGrid, a responsive grid helper for fields.
 * @property columns Number of columns at md/lg breakpoints (1-4).
 * - 1: Single column mobile/desktop
 * - 2: Two columns on tablet+
 * - 3: Three columns on desktop+
 * - 4: Four columns on large desktop+
 */
interface FormGridProps extends React.HTMLAttributes<HTMLDivElement> {
  columns?: 1 | 2 | 3 | 4;
}

export const FormGrid: React.FC<FormGridProps> = ({ columns = 2, className, children, ...props }) => {
  const gridCols = React.useMemo(() => {
    switch (columns) {
      case 1: return "grid-cols-1";
      case 2: return "grid-cols-1 md:grid-cols-2";
      case 3: return "grid-cols-1 md:grid-cols-3";
      case 4: return "grid-cols-1 md:grid-cols-2 lg:grid-cols-4";
      default: return "grid-cols-1 md:grid-cols-2";
    }
  }, [columns]);

  return (
    <div className={cn("grid gap-4", gridCols, className)} {...props}>
      {children}
    </div>
  );
};

/**
 * Props for FormItem, to be used within FormGrid to control spanning.
 * @property span Number of columns to span (1-4 or 'full').
 */
interface FormItemProps extends React.HTMLAttributes<HTMLDivElement> {
  span?: 1 | 2 | 3 | 4 | 'full';
}

export const FormItem: React.FC<FormItemProps> = ({ span, className, children, ...props }) => {
  const spanClass = React.useMemo(() => {
    switch (span) {
      case 1: return "col-span-1";
      case 2: return "col-span-1 md:col-span-2";
      case 3: return "col-span-1 md:col-span-3";
      case 4: return "col-span-1 md:col-span-2 lg:col-span-4";
      case 'full': return "col-span-full";
      default: return "";
    }
  }, [span]);

  return (
    <div className={cn(spanClass, className)} {...props}>
      {children}
    </div>
  );
};
