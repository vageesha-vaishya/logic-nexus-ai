/**
 * SosLogo — the master umbrella mark for SOS Services.
 *
 * Used everywhere except Sthira-branded surfaces. Renders as a single
 * "S" inside a rounded-square container per the locked brand brief
 * (docs/plans/2026-05-22-brand-logos-design-brief.md).
 *
 * Today's render: a vector "S" hand-authored against the brief spec —
 * monoweight stroke, rounded terminals, ~60% interior padding inside
 * the rounded square. A *placeholder* — the commissioned mark from a
 * designer / AI workflow will replace the inner <path> below. When
 * that lands, no consumer of this component changes.
 *
 * Props mirror the legacy Logo.tsx shape so call sites can swap one
 * for the other without further plumbing.
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
   */
  productName?: string;
  /** Variant — default fills with --sos-ink; "light" reverses for light surfaces. */
  variant?:  "default" | "light";
  className?:           string;
  wordmarkClassName?:   string;
}

/**
 * The "S" path inside a 64×64 viewBox. Hand-authored placeholder —
 * monoweight, ~10px stroke, rounded terminals. The commissioned mark
 * will replace this single <path>.
 *
 * Constructed as: open path traced from the upper-right terminal, over
 * the top, down to the middle, across to the lower-right, around the
 * bottom, ending at the lower-left terminal. Stroke-painted (not filled)
 * so monoweight is enforced by stroke-width.
 */
const S_PATH = "M 47 21 \
  C 47 16, 43 13, 38 13 \
  L 26 13 \
  C 21 13, 17 16, 17 21 \
  C 17 26, 21 29, 26 29 \
  L 38 29 \
  C 43 29, 47 33, 47 38 \
  C 47 43, 43 47, 38 47 \
  L 26 47 \
  C 21 47, 17 43, 17 38";

export function SosLogo({
  size              = 40,
  showWordmark      = false,
  productName,
  variant           = "default",
  className,
  wordmarkClassName,
}: SosLogoProps) {
  const isLight = variant === "light";

  const bgFill     = isLight ? "#FFFFFF" : "#0F172A"; // --sos-mist (white-ish) vs --sos-ink
  const strokeOnBg = isLight ? "#0F172A" : "#FFFFFF";
  const ringStroke = isLight ? "#E2E8F0" : "transparent";

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <svg
        role="img"
        aria-label={productName ? `SOS Services — ${productName}` : "SOS Services"}
        viewBox="0 0 64 60"
        width={size}
        height={size}
        className="shrink-0"
      >
        <rect
          x="0"
          y="0"
          width="64"
          height="60"
          rx="12"
          fill={bgFill}
          stroke={ringStroke}
          strokeWidth="1"
        />
        <path
          d={S_PATH}
          fill="none"
          stroke={strokeOnBg}
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {showWordmark && (
        <div className={cn("leading-tight", wordmarkClassName)}>
          <div className={cn(
            "font-semibold",
            isLight ? "text-foreground" : "text-foreground",
          )}>
            SOS Services
          </div>
          {productName && (
            <div className="text-xs text-muted-foreground">
              {productName}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SosLogo;
