/**
 * Template Row Component
 * 
 * Renders a single row in the templates grid with:
 * - Checkbox selection
 * - Sortable column headers
 * - Row actions dropdown
 * - Status badge
 * - Proper accessibility attributes
 * - Keyboard navigation support
 */

import { useState, useCallback, useMemo } from 'react';
import {
  CheckCircle2,
  CircleDot,
  Copy,
  Eye,
  FileEdit,
  History,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTemplateGridStore } from '../store/useTemplateGridStore';
import { WorkOrderTemplate } from '../AmroWorkOrderTemplatesPage';

// ── Types ──────────────────────────────────────────────────────────────────────

interface TemplateRowProps {
  template: WorkOrderTemplate;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onEdit: (template: WorkOrderTemplate) => void;
  onDelete: (template: WorkOrderTemplate) => void;
  onClone: (template: WorkOrderTemplate) => void;
  onPreview: (template: WorkOrderTemplate) => void;
  onManageVersions: (template: WorkOrderTemplate) => void;
  onContextMenu: (e: React.MouseEvent, templateId: string) => void;
  rowIndex: number;
  visibleColumns: string[];
}

// ── Constants ──────────────────────────────────────────────────────────────────

const MAINTENANCE_TYPE_LABELS: Record<string, string> = {
  line: 'Line Maintenance',
  base: 'Base Maintenance',
  component: 'Component Maintenance',
  inspection: 'Inspection',
  overhaul: 'Overhaul',
  repair: 'Repair',
  upgrade: 'Upgrade',
  modification: 'Modification',
};

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'Active', variant: 'default' },
  draft: { label: 'Draft', variant: 'secondary' },
  pending_review: { label: 'Pending Review', variant: 'outline' },
  approved: { label: 'Approved', variant: 'default' },
  deprecated: { label: 'Deprecated', variant: 'destructive' },
  archived: { label: 'Archived', variant: 'secondary' },
};

const STATUS_ICONS: Record<string, any> = {
  active: CheckCircle2,
  draft: CircleDot,
  pending_review: CircleDot,
  approved: CheckCircle2,
  deprecated: CircleDot,
  archived: CircleDot,
};

// ── Utility Functions ──────────────────────────────────────────────────────────

function formatDate(dateString: string): string {
  if (!dateString) return '—';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TemplateRow({
  template,
  isSelected,
  onToggleSelect,
  onEdit,
  onDelete,
  onClone,
  onPreview,
  onManageVersions,
  onContextMenu,
  rowIndex,
  visibleColumns,
}: TemplateRowProps) {
  const { columnSizes } = useTemplateGridStore();
  const [isActionsOpen, setIsActionsOpen] = useState(false);

  // Handle context menu
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onContextMenu(e, template.id);
    },
    [onContextMenu, template.id]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onToggleSelect(template.id);
      }
    },
    [onToggleSelect, template.id]
  );

  // Get column width
  const getColumnWidth = useCallback(
    (columnId: string) => {
      const size = columnSizes[columnId];
      return size ? `${size}px` : 'auto';
    },
    [columnSizes]
  );

  // Status configuration
  const statusConfig = STATUS_CONFIG[template.status] || STATUS_CONFIG.active;
  const StatusIcon = STATUS_ICONS[template.status] || CircleDot;

  // Render cell based on column
  const renderCell = useCallback(
    (columnId: string) => {
      switch (columnId) {
        case 'select':
          return (
            <TableCell
              className="w-[40px] text-center"
              style={{ width: getColumnWidth(columnId) }}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggleSelect(template.id)}
                aria-label={`Select template ${template.template_name}`}
              />
            </TableCell>
          );

        case 'template_code':
          return (
            <TableCell
              className="font-mono text-sm"
              style={{ width: getColumnWidth(columnId) }}
            >
              {template.template_code || '—'}
            </TableCell>
          );

        case 'template_name':
          return (
            <TableCell
              className="font-medium"
              style={{ width: getColumnWidth(columnId) }}
            >
              <div className="flex items-center gap-2">
                <span className="truncate max-w-[250px]">
                  {template.template_name}
                </span>
                {template.version > 1 && (
                  <Badge variant="outline" className="text-xs">
                    v{template.version}
                  </Badge>
                )}
              </div>
            </TableCell>
          );

        case 'maintenance_type':
          return (
            <TableCell style={{ width: getColumnWidth(columnId) }}>
              <Badge variant="secondary" className="text-xs">
                {MAINTENANCE_TYPE_LABELS[template.maintenance_type] || template.maintenance_type}
              </Badge>
            </TableCell>
          );

        case 'aircraft_model':
          return (
            <TableCell style={{ width: getColumnWidth(columnId) }}>
              {template.aircraft_model || '—'}
            </TableCell>
          );

        case 'version':
          return (
            <TableCell
              className="text-center"
              style={{ width: getColumnWidth(columnId) }}
            >
              <Badge variant="outline" className="font-mono">
                v{template.version}
              </Badge>
            </TableCell>
          );

        case 'status':
          return (
            <TableCell style={{ width: getColumnWidth(columnId) }}>
              <Badge variant={statusConfig.variant} className="gap-1">
                <StatusIcon className="w-3 h-3" />
                {statusConfig.label}
              </Badge>
            </TableCell>
          );

        case 'tasks_count':
          return (
            <TableCell
              className="text-center"
              style={{ width: getColumnWidth(columnId) }}
            >
              <div className="flex items-center justify-center gap-1">
                <span className="font-medium">{template.tasks_count}</span>
                <span className="text-muted-foreground text-xs">tasks</span>
              </div>
            </TableCell>
          );

        case 'description':
          return (
            <TableCell
              className="max-w-[300px]"
              style={{ width: getColumnWidth(columnId) }}
            >
              <p className="truncate text-sm text-muted-foreground">
                {template.description || '—'}
              </p>
            </TableCell>
          );

        case 'updated_at':
          return (
            <TableCell style={{ width: getColumnWidth(columnId) }}>
              <time dateTime={template.updated_at} className="text-sm">
                {formatDate(template.updated_at)}
              </time>
            </TableCell>
          );

        case 'created_at':
          return (
            <TableCell style={{ width: getColumnWidth(columnId) }}>
              <time dateTime={template.created_at} className="text-sm">
                {formatDate(template.created_at)}
              </time>
            </TableCell>
          );

        case 'created_by':
          return (
            <TableCell style={{ width: getColumnWidth(columnId) }}>
              <span className="text-sm">{template.created_by || '—'}</span>
            </TableCell>
          );

        case 'updated_by':
          return (
            <TableCell style={{ width: getColumnWidth(columnId) }}>
              <span className="text-sm">{template.updated_by || '—'}</span>
            </TableCell>
          );

        case 'estimated_labor_hours':
          return (
            <TableCell
              className="text-right"
              style={{ width: getColumnWidth(columnId) }}
            >
              {template.estimated_labor_hours
                ? `${template.estimated_labor_hours}h`
                : '—'}
            </TableCell>
          );

        case 'actions':
          return (
            <TableCell className="w-[100px] text-right">
              <DropdownMenu open={isActionsOpen} onOpenChange={setIsActionsOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    aria-label={`Actions for ${template.template_name}`}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onPreview(template)}>
                    <Eye className="w-4 h-4 mr-2" />
                    Preview
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onEdit(template)}>
                    <FileEdit className="w-4 h-4 mr-2" />
                    Edit Details
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onManageVersions(template)}>
                    <History className="w-4 h-4 mr-2" />
                    Manage Versions
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onClone(template)}>
                    <Copy className="w-4 h-4 mr-2" />
                    Clone Template
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(template)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          );

        default:
          return <TableCell>—</TableCell>;
      }
    },
    [
      template,
      isSelected,
      onToggleSelect,
      onEdit,
      onDelete,
      onClone,
      onPreview,
      onManageVersions,
      isActionsOpen,
      statusConfig,
      StatusIcon,
      getColumnWidth,
    ]
  );

  return (
    <TableRow
      data-state={isSelected ? 'selected' : undefined}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-selected={isSelected}
      aria-label={`Template: ${template.template_name}`}
      className="cursor-pointer hover:bg-muted/50 data-[state=selected]:bg-muted"
    >
      {visibleColumns.map((columnId) => (
        <div key={columnId} className="contents">
          {renderCell(columnId)}
        </div>
      ))}
    </TableRow>
  );
}
