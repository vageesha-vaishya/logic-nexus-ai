import * as React from "react";
import { FileText, Search, Plus, Inbox, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ComponentType<{ className?: string }>;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  variant?: "default" | "search" | "error";
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  secondaryAction,
  variant = "default",
  className,
}: EmptyStateProps) {
  const iconColor = variant === "error" ? "text-destructive" : "text-muted-foreground";

  return (
    <div className={cn("flex flex-col items-center justify-center py-12 px-4 text-center", className)}>
      <div className={cn("p-4 rounded-full bg-muted mb-4", iconColor)}>
        <Icon className="h-12 w-12" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md mb-6">{description}</p>
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-3">
          {action && (
            <Button onClick={action.onClick} variant="brand">
              {action.icon && <action.icon className="mr-2 h-4 w-4" />}
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button onClick={secondaryAction.onClick} variant="outline">
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// Pre-configured empty states
export const emptyStates = {
  noResults: (onClear?: () => void): EmptyStateProps => ({
    icon: Search,
    title: "No results found",
    description: "We couldn't find any items matching your search criteria. Try adjusting your filters.",
    variant: "search",
    ...(onClear && {
      action: {
        label: "Clear filters",
        onClick: onClear,
      },
    }),
  }),

  noItems: (itemName: string, onCreate?: () => void): EmptyStateProps => ({
    icon: Inbox,
    title: `No ${itemName} yet`,
    description: `Get started by creating your first ${itemName.toLowerCase()}.`,
    ...(onCreate && {
      action: {
        label: `Create ${itemName}`,
        onClick: onCreate,
        icon: Plus,
      },
    }),
  }),

  error: (message?: string, onRetry?: () => void): EmptyStateProps => ({
    icon: AlertCircle,
    title: "Something went wrong",
    description: message || "We encountered an error loading this data. Please try again.",
    variant: "error",
    ...(onRetry && {
      action: {
        label: "Try again",
        onClick: onRetry,
      },
    }),
  }),
};
