import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { WidgetConfig, WidgetProps } from '@/types/dashboard';
import { getWidgetDefinition } from '@/config/widgets';
import { Button } from '@/components/ui/button';
import { GripVertical, X, Settings } from 'lucide-react';
import { Suspense } from 'react';
import { WidgetSkeleton } from './widgets/WidgetSkeleton';

interface DraggableWidgetProps {
  config: WidgetConfig;
  onRemove: (id: string) => void;
  onEdit: (id: string, newConfig: Partial<WidgetConfig>) => void;
  onSettings?: (id: string) => void;
  isEditMode: boolean;
}

export function DraggableWidget({ config, onRemove, onEdit, onSettings, isEditMode }: DraggableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: config.id, disabled: !isEditMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  const def = getWidgetDefinition(config.type);
  const Component = def?.component;

  if (!Component) {
    return (
      <Card className="p-4 text-destructive">
        Unknown widget type: {config.type}
      </Card>
    );
  }

  // Map size to grid columns
  const colSpan = {
    small: 'col-span-1',
    medium: 'col-span-1 md:col-span-2 lg:col-span-1', 
    large: 'col-span-1 md:col-span-2 lg:col-span-2',
    full: 'col-span-1 md:col-span-2 lg:col-span-4',
  }[config.size] || 'col-span-1';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative h-full",
        colSpan,
        isDragging && "opacity-50"
      )}
    >
      {isEditMode && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-background/80 backdrop-blur rounded-md border p-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab p-1 hover:bg-muted rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            role="button"
            tabIndex={0}
            aria-label="Drag to reorder widget"
            title="Drag to reorder"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </div>
          {onSettings && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onSettings(config.id)}
              aria-label="Widget settings"
              title="Widget settings"
            >
              <Settings className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:text-destructive"
            onClick={() => onRemove(config.id)}
            aria-label="Remove widget"
            title="Remove widget"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      )}

      <div className={cn("h-full", isEditMode && "group ring-1 ring-border rounded-lg")}>
        <Suspense fallback={<WidgetSkeleton />}>
          <Component 
            config={config} 
            onRemove={onRemove} 
            onEdit={onEdit} 
            isEditMode={isEditMode} 
          />
        </Suspense>
      </div>
    </div>
  );
}
