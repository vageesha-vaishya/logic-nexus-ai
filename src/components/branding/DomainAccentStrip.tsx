/**
 * DomainAccentStrip — 4px horizontal bar that expresses the active
 * product on the otherwise-neutral SOS chrome.
 *
 * Mount once at the top of DashboardLayout. The strip reads
 * --domain-accent, which useDomainAccent() sets at the :root level
 * from the active membership's domain_code. Sthira retail surfaces
 * don't render the strip — Sthira chrome is the exception.
 *
 * See docs/plans/2026-05-22-platform-brand-architecture-design.md §Color palette.
 */
import { cn } from "@/lib/utils";

interface DomainAccentStripProps {
  className?: string;
  /** Bar height in pixels. Default 4. */
  height?:    number;
}

export function DomainAccentStrip({ className, height = 4 }: DomainAccentStripProps) {
  return (
    <div
      role="presentation"
      aria-hidden="true"
      className={cn("w-full transition-colors duration-200", className)}
      style={{ height, background: "var(--domain-accent)" }}
    />
  );
}

export default DomainAccentStrip;
