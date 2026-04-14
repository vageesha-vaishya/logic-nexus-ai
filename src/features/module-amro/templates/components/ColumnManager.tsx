/**
 * Column Manager Component
 * 
 * Features:
 * - Column resize with drag handles
 * - Column reorder with drag-and-drop
 * - Column show/hide toggle
 * - Reset to defaults
 * - Keyboard accessible
 * - Full accessibility support
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  GripVertical,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  RotateCcw,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTemplateGridStore } from '../store/useTemplateGridStore';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ColumnDefinition {
  id: string;
  label: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  resizable: boolean;
  reorderable: boolean;
  hideable: boolean;
}

interface ColumnManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: ColumnDefinition[];
}

interface DragState {
  index: number;
  overIndex: number | null;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const DEFAULT_COLUMN_DEFS: Record<string, Omit<ColumnDefinition, 'id' | 'label'>> = {
  select: {
    defaultWidth: 40,
    minWidth: 40,
    maxWidth: 60,
    resizable: false,
    reorderable: false,
    hideable: false,
  },
  template_code: {
    defaultWidth: 140,
    minWidth: 100,
    maxWidth: 300,
    resizable: true,
    reorderable: true,
    hideable: true,
  },
  template_name: {
    defaultWidth: 250,
    minWidth: 150,
    maxWidth: 500,
    resizable: true,
    reorderable: true,
    hideable: true,
  },
  maintenance_type: {
    defaultWidth: 150,
    minWidth: 100,
    maxWidth: 250,
    resizable: true,
    reorderable: true,
    hideable: true,
  },
  aircraft_model: {
    defaultWidth: 120,
    minWidth: 80,
    maxWidth: 200,
    resizable: true,
    reorderable: true,
    hideable: true,
  },
  version: {
    defaultWidth: 80,
    minWidth: 60,
    maxWidth: 120,
    resizable: true,
    reorderable: true,
    hideable: true,
  },
  status: {
    defaultWidth: 130,
    minWidth: 100,
    maxWidth: 200,
    resizable: true,
    reorderable: true,
    hideable: true,
  },
  tasks_count: {
    defaultWidth: 100,
    minWidth: 80,
    maxWidth: 150,
    resizable: true,
    reorderable: true,
    hideable: true,
  },
  description: {
    defaultWidth: 250,
    minWidth: 150,
    maxWidth: 500,
    resizable: true,
    reorderable: true,
    hideable: true,
  },
  updated_at: {
    defaultWidth: 120,
    minWidth: 100,
    maxWidth: 200,
    resizable: true,
    reorderable: true,
    hideable: true,
  },
  created_at: {
    defaultWidth: 120,
    minWidth: 100,
    maxWidth: 200,
    resizable: true,
    reorderable: true,
    hideable: true,
  },
  created_by: {
    defaultWidth: 140,
    minWidth: 100,
    maxWidth: 250,
    resizable: true,
    reorderable: true,
    hideable: true,
  },
  updated_by: {
    defaultWidth: 140,
    minWidth: 100,
    maxWidth: 250,
    resizable: true,
    reorderable: true,
    hideable: true,
  },
  estimated_labor_hours: {
    defaultWidth: 100,
    minWidth: 80,
    maxWidth: 150,
    resizable: true,
    reorderable: true,
    hideable: true,
  },
  actions: {
    defaultWidth: 100,
    minWidth: 80,
    maxWidth: 150,
    resizable: false,
    reorderable: false,
    hideable: false,
  },
};

// ── Utility Functions ──────────────────────────────────────────────────────────

function formatColumnName(id: string): string {
  return id
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ColumnManager({
  open,
  onOpenChange,
  columns,
}: ColumnManagerProps) {
  const {
    columnVisibility,
    columnOrder,
    columnSizes,
    setColumnVisibility,
    setColumnOrder,
    setColumnSize,
    resetColumnPreferences,
  } = useTemplateGridStore();

  const [localOrder, setLocalOrder] = useState<string[]>(columnOrder);
  const [localVisibility, setLocalVisibility] = useState<Record<string, boolean>>(columnVisibility);
  const [localSizes, setLocalSizes] = useState<Record<string, number>>(columnSizes);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // Initialize local state when dialog opens
  useEffect(() => {
    if (open) {
      setLocalOrder([...columnOrder]);
      setLocalVisibility({ ...columnVisibility });
      setLocalSizes({ ...columnSizes });
    }
  }, [open, columnOrder, columnVisibility, columnSizes]);

  // Handle visibility toggle
  const handleVisibilityToggle = useCallback((columnId: string) => {
    setLocalVisibility(prev => ({
      ...prev,
      [columnId]: !prev[columnId],
    }));
  }, []);

  // Handle size change
  const handleSizeChange = useCallback((columnId: string, size: number) => {
    const colDef = columns.find(c => c.id === columnId);
    if (!colDef || !colDef.resizable) return;

    const clampedSize = Math.max(colDef.minWidth, Math.min(colDef.maxWidth, size));
    setLocalSizes(prev => ({
      ...prev,
      [columnId]: clampedSize,
    }));
  }, [columns]);

  // Handle drag start
  const handleDragStart = useCallback((index: number) => {
    dragItem.current = index;
    setDragState({ index, overIndex: null });
  }, []);

  // Handle drag over
  const handleDragOver = useCallback((index: number) => {
    if (dragItem.current === null || dragItem.current === index) return;

    dragOverItem.current = index;
    setDragOverIndex(index);

    // Reorder in local state
    setLocalOrder(prev => {
      const newOrder = [...prev];
      const [draggedItem] = newOrder.splice(dragItem.current!, 1);
      newOrder.splice(index, 0, draggedItem);
      dragItem.current = index;
      return newOrder;
    });
  }, []);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    dragItem.current = null;
    dragOverItem.current = null;
    setDragState(null);
    setDragOverIndex(null);
  }, []);

  // Handle save
  const handleSave = useCallback(() => {
    setColumnVisibility(localVisibility);
    setColumnOrder(localOrder);
    setColumnSize('batch', localSizes); // Batch update
    onOpenChange(false);
  }, [localVisibility, localOrder, localSizes, setColumnVisibility, setColumnOrder, setColumnSize, onOpenChange]);

  // Handle reset
  const handleReset = useCallback(() => {
    resetColumnPreferences();
    setLocalOrder(columns.map(c => c.id));
    setLocalVisibility(
      columns.reduce((acc, col) => ({
        ...acc,
        [col.id]: DEFAULT_COLUMN_DEFS[col.id]?.hideable !== false,
      }), {})
    );
    setLocalSizes({});
  }, [columns, resetColumnPreferences]);

  // Get column definition
  const getColumnDef = useCallback((columnId: string): ColumnDefinition | null => {
    const col = columns.find(c => c.id === columnId);
    if (!col) return null;

    const defaults = DEFAULT_COLUMN_DEFS[columnId];
    if (!defaults) return null;

    return {
      id: columnId,
      label: col.label || formatColumnName(columnId),
      ...defaults,
    };
  }, [columns]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Customize Columns</DialogTitle>
          <DialogDescription>
            Drag columns to reorder, toggle visibility, and adjust widths.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-2 pr-4">
            {localOrder.map((columnId, index) => {
              const colDef = getColumnDef(columnId);
              if (!colDef) return null;

              const isVisible = localVisibility[columnId];
              const currentSize = localSizes[columnId] || colDef.defaultWidth;
              const isDragging = dragState?.index === index;
              const isDragOver = dragOverIndex === index;

              return (
                <div
                  key={columnId}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    isDragOver ? 'border-primary bg-primary/5' : 'border-border'
                  } ${isDragging ? 'opacity-50' : ''}`}
                  draggable={colDef.reorderable}
                  onDragStart={() => colDef.reorderable && handleDragStart(index)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    colDef.reorderable && handleDragOver(index);
                  }}
                  onDragEnd={handleDragEnd}
                >
                  {/* Drag handle */}
                  {colDef.reorderable ? (
                    <button
                      className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
                      aria-label={`Drag to reorder ${colDef.label}`}
                    >
                      <GripVertical className="w-4 h-4" />
                    </button>
                  ) : (
                    <div className="w-4" />
                  )}

                  {/* Visibility toggle */}
                  {colDef.hideable ? (
                    <button
                      onClick={() => handleVisibilityToggle(columnId)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={`${isVisible ? 'Hide' : 'Show'} ${colDef.label}`}
                    >
                      {isVisible ? (
                        <Eye className="w-4 h-4" />
                      ) : (
                        <EyeOff className="w-4 h-4" />
                      )}
                    </button>
                  ) : (
                    <div className="w-4" />
                  )}

                  {/* Column label */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${!isVisible ? 'text-muted-foreground line-through' : ''}`}>
                      {colDef.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {columnId.replace(/_/g, ' ')}
                    </p>
                  </div>

                  {/* Width control */}
                  {colDef.resizable && isVisible && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSizeChange(columnId, currentSize - 20)}
                        className="p-1 hover:bg-accent rounded"
                        aria-label="Decrease width"
                      >
                        <Minimize2 className="w-3 h-3" />
                      </button>
                      <span className="text-xs text-muted-foreground w-12 text-center">
                        {currentSize}px
                      </span>
                      <button
                        onClick={() => handleSizeChange(columnId, currentSize + 20)}
                        className="p-1 hover:bg-accent rounded"
                        aria-label="Increase width"
                      >
                        <Maximize2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* Status badge */}
                  <Badge variant={isVisible ? 'default' : 'secondary'} className="text-xs">
                    {isVisible ? 'Visible' : 'Hidden'}
                  </Badge>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            className="gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Default
          </Button>
          <div className="flex-1" />
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Apply Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
