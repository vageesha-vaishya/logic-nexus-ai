/**
 * SosLogo — the master umbrella mark for SOS Services.
 *
 * Used everywhere except Sthira-branded surfaces (Sthira keeps its own
 * wordmark). Until the commissioned mark lands, this renders a temporary
 * type-only "SOS" mark on --sos-ink background — readable as a parent
 * brand placeholder. Swapping in the real mark is a one-file change
 * here once design delivers it.
 *
 * Props mirror the existing Logo.tsx shape so call sites can swap one
 * for the other without further plumbing.
 *
 * See docs/plans/2026-05-22-platform-brand-architecture-design.md §Logo + typography.
 */
import { cn } from "@/lib/utils";

interface SosLogoProps {
  /** Square edge length in pixels. Default 40px. */
  size?:     number;
  /** Show the "SOS Services" wordmark to the right of the mark. */
  showWordmark?: boolean;
  /**
   * Product name displayed below the wordmark (e.g. "Logistics",
   * "Markets Advisor"). Only renders when showWordmark is true.
   * Use for product-context headers (e.g., signup form for SOS Logistics).
   */
  productName?: string;
  /** Variant — default fills with --sos-ink; "light" reverses for light backgrounds. */
  variant?:  "default" | "light";
  className?:           string;
  wordmarkClassName?:   string;
}

export function SosLogo({
  size              = 40,
  showWordmark      = false,
  productName,
  variant           = "default",
  className,
  wordmarkClassName,
}: SosLogoProps) {
  const isLight = variant === "light";

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        role="img"
        aria-label={productName ? `SOS Services — ${productName}` : "SOS Services"}
        className={cn(
          "shrink-0 rounded-md flex items-center justify-center font-bold tracking-tight select-none",
          isLight
            ? "bg-white text-[hsl(var(--sos-ink))] ring-1 ring-[hsl(var(--sos-fog))]"
            : "bg-[hsl(var(--sos-ink))] text-white",
        )}
        style={{
          width:    size,
          height:   size,
          fontSize: Math.round(size * 0.34),
          letterSpacing: "-0.04em",
        }}
      >
        SOS
      </div>

      {showWordmark && (
        <div className={cn("leading-tight", wordmarkClassName)}>
          <div className={cn(
            "font-semibold",
            isLight ? "text-white" : "text-foreground",
          )}>
            SOS Services
          </div>
          {productName && (
            <div className={cn(
              "text-xs",
              isLight ? "text-white/70" : "text-muted-foreground",
            )}>
              {productName}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SosLogo;
