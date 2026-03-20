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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ExternalLink, MoreHorizontal, Trash2 } from "lucide-react";

export interface KanbanItem {
  id: string;
  title: string;
  subtitle?: string;
  status: string;
  priority?: "low" | "medium" | "high" | "critical";
  probability?: number;
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
  onDelete?: (id: string) => Promise<void> | void;
  themeVariant?: "default" | "reference";
}

export const KanbanCard = memo(function KanbanCard({ item, isOverlay, onUpdate, onView, onDelete, themeVariant = "default" }: KanbanCardProps) {
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
    low: themeVariant === "reference" ? "border-l-blue-200" : "border-l-slate-400",
    medium: themeVariant === "reference" ? "border-l-blue-400" : "border-l-blue-400",
    high: themeVariant === "reference" ? "border-l-amber-500" : "border-l-amber-500",
    critical: themeVariant === "reference" ? "border-l-red-500" : "border-l-red-600",
  };

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn("opacity-40 h-[120px] rounded-lg border-2 border-dashed", themeVariant === "reference" ? "bg-white border-[#d8dee8]" : "bg-muted/50 border-primary/20")}
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
          "relative overflow-hidden transition-all duration-300 ease-in-out border-l-4 transform-gpu",
          priorityBorderColors[item.priority || "low"],
          themeVariant === "reference" ? "border border-[#e7ebf2] bg-white hover:shadow-sm hover:-translate-y-0.5 hover:scale-[1.02] active:scale-[0.995]" : "hover:shadow-md hover:-translate-y-0.5 active:scale-[0.995]",
          isOverlay ? "shadow-xl ring-2 ring-primary/20" : themeVariant === "reference" ? "shadow-none" : "shadow-sm"
        )}
      >
        <CardHeader className="p-2.5 space-y-1.5">
            <div className="flex justify-between items-start gap-2">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                   <Badge 
                    variant="outline" 
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0 h-5 border-0 transition-all duration-300 ease-in-out group-hover:scale-105 group-hover:-translate-y-px group-active:scale-95", 
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
                <div className="font-semibold text-sm leading-tight text-card-foreground line-clamp-2" onPointerDown={(e) => e.stopPropagation()}>
                   <EditableText 
                      value={item.title} 
                      onSave={(val) => handleUpdate('title', val)} 
                      inputClassName="font-semibold"
                    />
                </div>
              </div>
              
              <div className="flex items-center gap-1">
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
                {onDelete && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 -mr-1 -mt-1 text-muted-foreground hover:text-foreground"
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          void onDelete(item.id);
                        }}
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>

            {item.subtitle && (
              <p className="text-xs text-muted-foreground truncate">
                {item.subtitle}
              </p>
            )}

            <div className={cn("flex items-center justify-between pt-1.5 mt-1 border-t", themeVariant === "reference" ? "border-[#edf1f7]" : "border-border/40")}>
              <div className="font-medium text-xs tabular-nums" onPointerDown={(e) => e.stopPropagation()}>
                 <EditableText 
                    value={item.value || 0} 
                    type="currency"
                    currencySymbol={item.currency}
                    onSave={(val) => handleUpdate('value', val)}
                    className="text-xs"
                  />
              </div>

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
