import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { motion, useMotionValue } from "framer-motion";
import { memo } from "react";
import { EditableText } from "@/components/ui/editable-text";
import { ExternalLink, GripVertical } from "lucide-react";

export interface KanbanItem {
  id: string;
  title: string;
  subtitle?: string;
  status: string;
  priority?: "low" | "medium" | "high" | "critical";
  value?: number;
  currency?: string;
  assignee?: {
    name: string;
    avatarUrl?: string;
  };
  assignees?: {
    name: string;
    avatarUrl?: string;
  }[];
  tags?: string[];
  updatedAt?: string;
}

interface KanbanCardProps {
  item: KanbanItem;
  isOverlay?: boolean;
  onUpdate?: (id: string, updates: Partial<KanbanItem>) => Promise<void>;
  onView?: (id: string) => void;
}

export const KanbanCard = memo(function KanbanCard({ item, isOverlay, onUpdate, onView }: KanbanCardProps) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    data: {
      type: "Item",
      item,
    },
  });

  // Drag Tilt Logic
  const rotate = useMotionValue(0);
  
  const style = {
    transition,
    transform: CSS.Translate.toString(transform),
  };

  const priorityColors = {
    low: "bg-slate-100 text-slate-700 border-slate-200",
    medium: "bg-blue-100 text-blue-700 border-blue-200",
    high: "bg-amber-100 text-amber-700 border-amber-200",
    critical: "bg-red-100 text-red-700 border-red-200",
  };

  const priorityBorderColors = {
    low: "border-l-slate-400",
    medium: "border-l-blue-400",
    high: "border-l-amber-500",
    critical: "border-l-red-600",
  };

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="opacity-40 bg-muted/50 h-[120px] rounded-lg border-2 border-dashed border-primary/20"
      />
    );
  }

  const assignees = item.assignees || (item.assignee ? [item.assignee] : []);

  const handleUpdate = async (field: keyof KanbanItem, value: string | number) => {
    if (onUpdate) {
      await onUpdate(item.id, { [field]: value });
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "touch-none group relative",
        isOverlay ? "cursor-grabbing rotate-2 scale-105 z-50" : "cursor-grab",
        "focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-lg"
      )}
    >
      <Card 
        className={cn(
          "relative overflow-hidden transition-all duration-200 border-l-4 hover:shadow-md",
          priorityBorderColors[item.priority || "low"],
          isOverlay ? "shadow-xl ring-2 ring-primary/20" : "shadow-sm"
        )}
      >
        <CardHeader className="p-2.5 space-y-1.5">
            {/* Header: Badges & Title */}
            <div className="flex justify-between items-start gap-2">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                   <Badge 
                    variant="outline" 
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0 h-5 border-0", 
                      priorityColors[item.priority || "low"]
                    )}
                  >
                    {item.priority || "Normal"}
                  </Badge>
                  {item.updatedAt && (
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {new Date(item.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
                {/* Editable Title */}
                <div className="font-semibold text-sm leading-tight text-card-foreground line-clamp-2" onPointerDown={(e) => e.stopPropagation()}>
                   <EditableText 
                      value={item.title} 
                      onSave={(val) => handleUpdate('title', val)} 
                      inputClassName="font-semibold"
                    />
                </div>
              </div>
              
              {onView && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 -mr-1 -mt-1 text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    onView(item.id);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              )}
            </div>

            {/* Subtitle / Company */}
            {item.subtitle && (
              <p className="text-xs text-muted-foreground truncate">
                {item.subtitle}
              </p>
            )}

            {/* Footer: Value & Assignees */}
            <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-border/40">
              <div className="font-medium text-xs tabular-nums" onPointerDown={(e) => e.stopPropagation()}>
                 <EditableText 
                    value={item.value || 0} 
                    type="currency"
                    currencySymbol={item.currency}
                    onSave={(val) => handleUpdate('value', val)}
                    className="text-xs"
                  />
              </div>

              {/* Avatar Group */}
              <div className="flex items-center -space-x-1.5">
                {assignees.slice(0, 3).map((u, i) => (
                  <Avatar key={i} className="h-5 w-5 border-2 border-background ring-1 ring-border/10">
                    <AvatarImage src={u.avatarUrl} />
                    <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                      {u.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {assignees.length > 3 && (
                  <div className="h-5 w-5 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[8px] font-medium text-muted-foreground ring-1 ring-border/10">
                    +{assignees.length - 3}
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>
    </div>
  );
});
