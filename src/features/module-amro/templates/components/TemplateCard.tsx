/**
 * Template Card Component (Mobile View)
 * 
 * Features:
 * - Mobile-optimized card layout
 * - Touch-friendly interactions
 * - Swipe to select (future enhancement)
 * - Compact information display
 * - Quick action buttons
 * - Full accessibility support
 * - Responsive design
 */

import { useCallback } from 'react';
import {
  CheckCircle2,
  CircleDot,
  Clock,
  Copy,
  Eye,
  FileEdit,
  History,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { WorkPackageTemplate } from '../AmroWorkPackageTemplatesPage';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TemplateCardProps {
  template: WorkPackageTemplate;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onEdit: (template: WorkPackageTemplate) => void;
  onDelete: (template: WorkPackageTemplate) => void;
  onClone: (template: WorkPackageTemplate) => void;
  onPreview: (template: WorkPackageTemplate) => void;
  onManageVersions: (template: WorkPackageTemplate) => void;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const MAINTENANCE_TYPE_LABELS: Record<string, string> = {
  line: 'Line',
  base: 'Base',
  component: 'Component',
  inspection: 'Inspection',
  overhaul: 'Overhaul',
  repair: 'Repair',
  upgrade: 'Upgrade',
  modification: 'Modification',
};

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
  active: { label: 'Active', variant: 'default', icon: CheckCircle2 },
  draft: { label: 'Draft', variant: 'secondary', icon: CircleDot },
  pending_review: { label: 'Pending', variant: 'outline', icon: Clock },
  approved: { label: 'Approved', variant: 'default', icon: CheckCircle2 },
  deprecated: { label: 'Deprecated', variant: 'destructive', icon: CircleDot },
  archived: { label: 'Archived', variant: 'secondary', icon: CircleDot },
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
    month: 'short',
    day: 'numeric',
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TemplateCard({
  template,
  isSelected,
  onToggleSelect,
  onEdit,
  onDelete,
  onClone,
  onPreview,
  onManageVersions,
}: TemplateCardProps) {
  const statusConfig = STATUS_CONFIG[template.status] || STATUS_CONFIG.active;
  const StatusIcon = statusConfig.icon;

  // Handle card tap
  const handleCardTap = useCallback(() => {
    // On mobile, tapping the card (not checkbox) could open preview
    onPreview(template);
  }, [onPreview, template]);

  return (
    <Card
      className={`relative transition-all ${
        isSelected ? 'border-primary bg-primary/5' : 'border-border'
      }`}
      role="article"
      aria-label={`Template: ${template.template_name}`}
    >
      {/* Selection checkbox */}
      <div className="absolute top-3 left-3 z-10">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(template.id)}
          aria-label={`Select ${template.template_name}`}
        />
      </div>

      {/* Header */}
      <CardHeader className="pb-3 pt-3 pl-10 pr-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* Template name */}
            <button
              onClick={handleCardTap}
              className="text-left w-full"
              aria-label={`View ${template.template_name}`}
            >
              <h3 className="font-semibold text-base truncate">
                {template.template_name}
              </h3>
            </button>

            {/* Template code */}
            <p className="text-xs text-muted-foreground font-mono mt-1">
              {template.template_code}
            </p>
          </div>

          {/* Actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
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
                Clone
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
        </div>
      </CardHeader>

      {/* Content */}
      <CardContent className="pb-3 pt-0">
        <div className="space-y-3">
          {/* Status and type badges */}
          <div className="flex flex-wrap gap-2">
            <Badge variant={statusConfig.variant} className="gap-1 text-xs">
              <StatusIcon className="w-3 h-3" />
              {statusConfig.label}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {MAINTENANCE_TYPE_LABELS[template.maintenance_type] || template.maintenance_type}
            </Badge>
            {template.version > 1 && (
              <Badge variant="outline" className="text-xs font-mono">
                v{template.version}
              </Badge>
            )}
          </div>

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            {/* Aircraft model */}
            {template.aircraft_model && (
              <div>
                <p className="text-xs text-muted-foreground">Aircraft</p>
                <p className="font-medium truncate">{template.aircraft_model}</p>
              </div>
            )}

            {/* Tasks count */}
            <div>
              <p className="text-xs text-muted-foreground">Tasks</p>
              <p className="font-medium">{template.tasks_count}</p>
            </div>

            {/* Estimated hours */}
            {template.estimated_labor_hours && (
              <div>
                <p className="text-xs text-muted-foreground">Est. Hours</p>
                <p className="font-medium">{template.estimated_labor_hours}h</p>
              </div>
            )}

            {/* Description (truncated) */}
            {template.description && (
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Description</p>
                <p className="text-sm line-clamp-2">{template.description}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
            <time dateTime={template.updated_at}>
              Updated {formatDate(template.updated_at)}
            </time>
            {template.updated_by && (
              <span>by {template.updated_by}</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
