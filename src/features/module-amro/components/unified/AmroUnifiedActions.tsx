/**
 * AmroUnifiedActions
 * 
 * Standardized dropdown menu for row actions in all AMRO modules.
 * Provides consistent action patterns with:
 * - Icons and labels
 * - Separators for grouping
 * - Destructive action styling
 * - Disabled state support
 * - Keyboard navigation
 * 
 * Usage:
 * <AmroUnifiedActions
 *   actions={[
 *     { label: 'Preview', icon: Eye, onClick: () => handlePreview(row) },
 *     { label: 'Edit', icon: Pencil, onClick: () => handleEdit(row) },
 *     { separator: true },
 *     { label: 'Delete', icon: Trash2, onClick: () => handleDelete(row), destructive: true },
 *   ]}
 * />
 */

import { MoreHorizontal, Eye, BookOpen, Package, Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LucideIcon } from 'lucide-react';

export interface ActionItem {
  /** Action label */
  label: string;
  /** Action icon */
  icon: LucideIcon;
  /** Click handler */
  onClick: () => void;
  /** Whether action is disabled */
  disabled?: boolean;
  /** Whether action is destructive (red styling) */
  destructive?: boolean;
  /** Whether to show separator before this action */
  separator?: boolean;
  /** Tooltip text */
  tooltip?: string;
}

export interface AmroUnifiedActionsProps {
  /** Array of action items */
  actions: ActionItem[];
  /** Custom trigger button text (for accessibility) */
  triggerLabel?: string;
  /** Custom menu width */
  menuWidth?: string;
}

export function AmroUnifiedActions({
  actions,
  triggerLabel = 'Actions',
  menuWidth = 'w-48',
}: AmroUnifiedActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={triggerLabel}>
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">{triggerLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={menuWidth}>
        {actions.map((action, idx) => {
          if (action.separator) {
            return <DropdownMenuSeparator key={`sep-${idx}`} />;
          }

          const Icon = action.icon;

          return (
            <DropdownMenuItem
              key={action.label}
              onClick={action.onClick}
              disabled={action.disabled}
              className={action.destructive ? 'text-destructive focus:text-destructive' : ''}
            >
              <Icon className="h-4 w-4 mr-2" />
              {action.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Pre-defined action creators for common patterns
 */
export const AmroActions = {
  /** Create standard CRUD actions */
  crud: (handlers: {
    onPreview?: () => void;
    onEdit: () => void;
    onDelete?: () => void;
    onClone?: () => void;
    onManageVersions?: () => void;
  }): ActionItem[] => {
    const actions: ActionItem[] = [];

    if (handlers.onPreview) {
      actions.push({
        label: 'Preview',
        icon: Eye,
        onClick: handlers.onPreview,
      });
    }

    actions.push({
      label: 'Edit Details',
      icon: BookOpen,
      onClick: handlers.onEdit,
    });

    if (handlers.onManageVersions) {
      actions.push({
        label: 'Manage Versions',
        icon: Package,
        onClick: handlers.onManageVersions,
      });
    }

    if (handlers.onClone) {
      actions.push({
        label: 'Clone',
        icon: Copy,
        onClick: handlers.onClone,
      });
    }

    if (handlers.onDelete) {
      actions.push({ separator: true });
      actions.push({
        label: 'Delete',
        icon: Trash2,
        onClick: handlers.onDelete,
        destructive: true,
      });
    }

    return actions;
  },

  /** Create view-only actions */
  viewOnly: (handlers: {
    onPreview?: () => void;
    onEdit?: () => void;
  }): ActionItem[] => {
    const actions: ActionItem[] = [];

    if (handlers.onPreview) {
      actions.push({
        label: 'Preview',
        icon: Eye,
        onClick: handlers.onPreview,
      });
    }

    if (handlers.onEdit) {
      actions.push({
        label: 'Edit',
        icon: BookOpen,
        onClick: handlers.onEdit,
      });
    }

    return actions;
  },
};
