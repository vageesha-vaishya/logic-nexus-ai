import { AlertTriangle, Info, AlertOctagon } from "lucide-react";

import { cn } from "@/lib/utils";

import { useAppStatusBanner } from "../hooks/useAppStatusBanner";

/**
 * Operator status banner — closed-beta #27.
 *
 * Reads markets.app_status_banners via useAppStatusBanner and renders
 * the highest-priority currently-active row. Hides itself when no banner
 * is active (the common case). Sits above OfflineBanner in
 * RetailNavLayout so urgent ops messages take visual priority over the
 * passive offline cue.
 */

const STYLES: Record<
  "info" | "warning" | "error",
  { wrap: string; Icon: typeof Info }
> = {
  info: {
    wrap: "bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-100",
    Icon: Info,
  },
  warning: {
    wrap: "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-100",
    Icon: AlertTriangle,
  },
  error: {
    wrap: "bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-100",
    Icon: AlertOctagon,
  },
};

export function AppStatusBanner() {
  const { data: banner } = useAppStatusBanner();
  if (!banner) return null;

  const { wrap, Icon } = STYLES[banner.severity] ?? STYLES.info;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium",
        wrap,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="line-clamp-2 text-center">{banner.message}</span>
    </div>
  );
}
