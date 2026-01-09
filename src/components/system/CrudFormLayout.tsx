import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Props for CrudFormLayout, a standardized form container
 * with header, content area, and footer actions for Save/Cancel.
 * @property title Form title shown in the header
 * @property description Optional header description text
 * @property className Optional container className
 * @property onCancel Optional handler to render Cancel button
 * @property onSave Optional handler to render Save button
 * @property saveDisabled Optional disable state for Save button
 * @property footerExtra Optional extra content before action buttons
 * @property children Form fields and sections rendered inside content
 */
interface CrudFormLayoutProps {
  /**
   * The form title.
   */
  title: string;
  /**
   * Optional description for the form context.
   */
  description?: string;
  /**
   * Optional CSS class names.
   */
  className?: string;
  /**
   * Callback for the Cancel button.
   */
  onCancel?: () => void;
  /**
   * Callback for the Save button.
   */
  onSave?: () => void;
  /**
   * Whether the Save button is disabled (e.g., while submitting).
   */
  saveDisabled?: boolean;
  /**
   * Extra content to render in the footer (e.g., Delete button).
   */
  footerExtra?: ReactNode;
  /**
   * The form fields content.
   */
  children: ReactNode;
}

export function CrudFormLayout({
  title,
  description,
  className,
  onCancel,
  onSave,
  saveDisabled,
  footerExtra,
  children,
}: CrudFormLayoutProps) {
  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">{title}</CardTitle>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </CardHeader>
      <CardContent className="space-y-6">
        {children}
        <div className="flex items-center justify-end gap-2 pt-4 border-t">
          {footerExtra}
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          {onSave && (
            <Button onClick={onSave} disabled={saveDisabled}>
              Save
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
