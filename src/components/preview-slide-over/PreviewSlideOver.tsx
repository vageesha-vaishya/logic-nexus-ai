import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const PREVIEW_FIELD_SOFT_CAP = 6;

export type PreviewField = {
  label: string;
  value: React.ReactNode;
  /** If true, value spans the full width instead of label/value two-column. */
  fullWidth?: boolean;
};

export interface PreviewSlideOverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  fields: PreviewField[];
  actions?: React.ReactNode;
  side?: "left" | "right";
  className?: string;
}

/**
 * Slide-over preview for an associated record. Use when the user clicks a
 * related entity (a Part on a Work Order, a Contact on a Deal) and wants
 * to see the key properties without leaving the current screen.
 *
 * Soft cap: ~6 fields. More than that, the panel turns into a full record
 * page in disguise — route to the full record instead.
 */
export function PreviewSlideOver({
  open,
  onOpenChange,
  title,
  subtitle,
  fields,
  actions,
  side = "right",
  className,
}: PreviewSlideOverProps): JSX.Element {
  if (
    typeof process !== "undefined" &&
    process.env?.NODE_ENV !== "production" &&
    fields.length > PREVIEW_FIELD_SOFT_CAP
  ) {
    // eslint-disable-next-line no-console
    console.warn(
      `[PreviewSlideOver] "${title}" has ${fields.length} fields; the recommended cap is ${PREVIEW_FIELD_SOFT_CAP}. Consider routing to the full record instead.`,
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={cn("w-full sm:max-w-md flex flex-col", className)}
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {subtitle ? (
            <SheetDescription>{subtitle}</SheetDescription>
          ) : (
            <SheetDescription className="sr-only">
              {title} preview
            </SheetDescription>
          )}
        </SheetHeader>

        <dl className="mt-4 flex-1 overflow-y-auto space-y-3 pr-1">
          {fields.map((field) => (
            <div
              key={field.label}
              className={cn(
                field.fullWidth
                  ? "space-y-1"
                  : "grid grid-cols-[120px_1fr] items-start gap-3",
              )}
            >
              <dt className="text-xs text-muted-foreground">{field.label}</dt>
              <dd className="text-sm font-medium break-words">{field.value}</dd>
            </div>
          ))}
        </dl>

        {actions && <SheetFooter className="mt-4">{actions}</SheetFooter>}
      </SheetContent>
    </Sheet>
  );
}
