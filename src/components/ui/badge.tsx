import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        success: "border-transparent bg-success text-success-foreground hover:bg-success/80",
        warning: "border-transparent bg-warning text-warning-foreground hover:bg-warning/80",
        outline: "text-foreground",
      },
      tone: {
        success: "border-status-success-border bg-status-success text-status-success-foreground",
        warning: "border-status-warning-border bg-status-warning text-status-warning-foreground",
        danger:  "border-status-danger-border bg-status-danger text-status-danger-foreground",
        info:    "border-status-info-border bg-status-info text-status-info-foreground",
        neutral: "border-status-neutral-border bg-status-neutral text-status-neutral-foreground",
        special: "border-status-special-border bg-status-special text-status-special-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(({ className, variant, tone, ...props }, ref) => {
  // A tone describes record state; when present it owns the surface, so the action variant is dropped to "outline".
  return <div ref={ref} className={cn(badgeVariants({ variant: tone ? "outline" : variant, tone }), className)} {...props} />;
});
Badge.displayName = "Badge";

export { Badge };
