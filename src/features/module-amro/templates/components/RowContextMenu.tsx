/**
 * Row Context Menu Component
 * 
 * Features:
 * - Right-click context menu on grid rows
 * - Quick actions (Preview, Edit, Clone, Delete, etc.)
 * - Keyboard shortcut support
 * - Auto-positioning to avoid viewport overflow
 * - Full accessibility support
 */

import { useEffect, useRef, useCallback } from 'react';
import {
  CheckCircle2,
  Copy,
  Download,
  Eye,
  FileEdit,
  History,
  MoreHorizontal,
  Star,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WorkOrderTemplate } from '../AmroWorkOrderTemplatesPage';

// ── Types ──────────────────────────────────────────────────────────────────────

interface RowContextMenuProps {
  template: WorkOrderTemplate | null;
  x: number;
  y: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPreview: (template: WorkOrderTemplate) => void;
  onEdit: (template: WorkOrderTemplate) => void;
  onClone: (template: WorkOrderTemplate) => void;
  onDelete: (template: WorkOrderTemplate) => void;
  onManageVersions: (template: WorkOrderTemplate) => void;
  onSetDefault?: (template: WorkOrderTemplate) => void;
  onExport?: (template: WorkOrderTemplate) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RowContextMenu({
  template,
  x,
  y,
  open,
  onOpenChange,
  onPreview,
  onEdit,
  onClone,
  onDelete,
  onManageVersions,
  onSetDefault,
  onExport,
}: RowContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };

    if (open) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onOpenChange]);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, onOpenChange]);

  // Calculate position to avoid viewport overflow
  const getMenuPosition = useCallback(() => {
    const menuWidth = 220;
    const menuHeight = 300;
    const padding = 10;

    let posX = x;
    let posY = y;

    // Check right edge
    if (x + menuWidth > window.innerWidth - padding) {
      posX = x - menuWidth;
    }

    // Check bottom edge
    if (y + menuHeight > window.innerHeight - padding) {
      posY = y - menuHeight;
    }

    // Ensure minimum position
    posX = Math.max(padding, posX);
    posY = Math.max(padding, posY);

    return { x: posX, y: posY };
  }, [x, y]);

  const position = getMenuPosition();

  // Handle action click
  const handleAction = useCallback(
    (action: () => void) => {
      action();
      onOpenChange(false);
    },
    [onOpenChange]
  );

  if (!open || !template) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Context Menu */}
      <div
        ref={menuRef}
        className="fixed z-50 min-w-[220px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
        role="menu"
        aria-orientation="vertical"
        aria-label="Template actions"
      >
        {/* Template name header */}
        <div className="px-3 py-2 border-b">
          <p className="text-sm font-medium truncate max-w-[180px]">
            {template.template_name}
          </p>
          <p className="text-xs text-muted-foreground font-mono">
            {template.template_code}
          </p>
        </div>

        {/* Menu items */}
        <div className="py-1">
          {/* Preview */}
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
            onClick={() => handleAction(() => onPreview(template))}
            role="menuitem"
          >
            <Eye className="w-4 h-4" />
            <span>Preview</span>
          </button>

          {/* Edit Details */}
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
            onClick={() => handleAction(() => onEdit(template))}
            role="menuitem"
          >
            <FileEdit className="w-4 h-4" />
            <span>Edit Details</span>
            <span className="ml-auto text-xs text-muted-foreground">⌘E</span>
          </button>

          {/* Manage Versions */}
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
            onClick={() => handleAction(() => onManageVersions(template))}
            role="menuitem"
          >
            <History className="w-4 h-4" />
            <span>Manage Versions</span>
          </button>

          {/* Set as Default */}
          {onSetDefault && (
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
              onClick={() => handleAction(() => onSetDefault!(template))}
              role="menuitem"
            >
              <Star className="w-4 h-4" />
              <span>Set as Default</span>
            </button>
          )}
        </div>

        {/* Separator */}
        <div className="my-1 border-t" />

        <div className="py-1">
          {/* Clone */}
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
            onClick={() => handleAction(() => onClone(template))}
            role="menuitem"
          >
            <Copy className="w-4 h-4" />
            <span>Clone Template</span>
            <span className="ml-auto text-xs text-muted-foreground">⌘D</span>
          </button>

          {/* Export */}
          {onExport && (
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
              onClick={() => handleAction(() => onExport!(template))}
              role="menuitem"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
          )}
        </div>

        {/* Separator */}
        <div className="my-1 border-t" />

        <div className="py-1">
          {/* Delete */}
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-sm hover:bg-destructive hover:text-destructive-foreground cursor-pointer transition-colors text-destructive"
            onClick={() => handleAction(() => onDelete(template))}
            role="menuitem"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete</span>
            <span className="ml-auto text-xs">⌘⌫</span>
          </button>
        </div>

        {/* Footer */}
        <div className="px-3 py-2 border-t text-xs text-muted-foreground">
          Press ESC to close
        </div>
      </div>
    </>
  );
}
