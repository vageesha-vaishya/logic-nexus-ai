import * as React from "react";
import { MoreHorizontal, Pencil, Trash2, Eye, Copy, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface RowAction {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  variant?: "default" | "destructive";
  separator?: boolean;
}

interface RowActionsProps {
  actions: RowAction[];
  label?: string;
}

export function RowActions({ actions, label = "Actions" }: RowActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        {actions.map((action, index) => (
          <React.Fragment key={index}>
            {action.separator && <DropdownMenuSeparator />}
            <DropdownMenuItem
              onClick={action.onClick}
              className={action.variant === "destructive" ? "text-destructive focus:text-destructive" : ""}
            >
              {action.icon && <action.icon className="mr-2 h-4 w-4" />}
              {action.label}
            </DropdownMenuItem>
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Pre-built common actions
export const commonActions = {
  view: (onClick: () => void): RowAction => ({
    label: "View Details",
    icon: Eye,
    onClick,
  }),
  edit: (onClick: () => void): RowAction => ({
    label: "Edit",
    icon: Pencil,
    onClick,
  }),
  duplicate: (onClick: () => void): RowAction => ({
    label: "Duplicate",
    icon: Copy,
    onClick,
  }),
  archive: (onClick: () => void): RowAction => ({
    label: "Archive",
    icon: Archive,
    onClick,
    separator: true,
  }),
  delete: (onClick: () => void): RowAction => ({
    label: "Delete",
    icon: Trash2,
    onClick,
    variant: "destructive",
    separator: true,
  }),
};
