import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Props for EntityCard, a compact, accessible preview card
 * used in card/list views to display entity summary information.
 * @property title Primary title of the entity
 * @property subtitle Optional secondary line under the title
 * @property meta Optional small metadata text block
 * @property tags Optional set of badges shown at the bottom
 * @property right Optional right-side content (icons, actions)
 * @property onClick Optional click handler; enables keyboard focus
 * @property className Optional container className
 */
interface EntityCardProps {
  /**
   * The primary title of the entity.
   */
  title: string;
  /**
   * Secondary text, usually a subtitle or category.
   */
  subtitle?: string;
  /**
   * Meta information string (e.g., joined by bullets).
   */
  meta?: string;
  /**
   * List of tags or status labels to display.
   */
  tags?: string[];
  /**
   * Optional element to render on the top right (e.g., actions menu).
   */
  right?: ReactNode;
  /**
   * Click handler for the card.
   */
  onClick?: () => void;
  /**
   * Optional selection state.
   */
  selected?: boolean;
  /**
   * Optional selection handler.
   */
  onSelect?: () => void;
  /**
   * Optional CSS class names.
   */
  className?: string;
}

export function EntityCard({ title, subtitle, meta, tags, right, onClick, selected, onSelect, className }: EntityCardProps) {
  return (
    <Card
      className={cn(
        "p-4 hover:shadow-md transition-shadow cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring relative group",
        selected && "ring-2 ring-primary border-primary",
        className
      )}
      onClick={onClick}
      tabIndex={0}
      aria-label={title}
      aria-selected={selected}
    >
      {onSelect && (
        <div 
          className={cn(
            "absolute top-2 left-2 z-10 transition-opacity",
            selected ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
          )}
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          <div className={cn(
            "h-5 w-5 rounded border border-primary bg-background flex items-center justify-center",
            selected && "bg-primary text-primary-foreground"
          )}>
            {selected && <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
        </div>
      )}
      <div className={cn("flex items-start justify-between", onSelect && "pl-6")}>
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">{title}</h3>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {right}
      </div>
      {meta && <p className="text-xs text-muted-foreground mt-3">{meta}</p>}
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {tags.map((t) => (
            <Badge key={t} variant="secondary">
              {t}
            </Badge>
          ))}
        </div>
      )}
    </Card>
  );
}
