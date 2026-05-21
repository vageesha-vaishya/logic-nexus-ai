/**
 * Markets-only entrypoint — Path A Phase 2.3 step 2.
 *
 * Mirror of src/main.tsx but renders <MarketsApp /> instead of <App />.
 * Activated by a `transformIndexHtml` plugin in vite.config.ts that
 * rewrites index.html's `<script src="/src/main.tsx">` to point here
 * whenever VITE_DOMAIN_ONLY is set. Capacitor still loads dist/index.html
 * verbatim; only the entry module under the hood changes.
 *
 * See docs/plans/2026-05-21-path-a-per-domain-spa-bundles-design.md
 */
import { createRoot } from "react-dom/client";
import MarketsApp from "../MarketsApp";
import "../index.css";

import "@fontsource/source-serif-pro/400.css";
import "@fontsource/source-serif-pro/600.css";
import "@fontsource/source-serif-pro/400-italic.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";

if (typeof window !== "undefined") {
  const storedDark = localStorage.getItem("lnai_dark_mode");
  if (
    storedDark === "true" ||
    (!storedDark && typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches)
  ) {
    document.documentElement.classList.add("dark");
  }
}

import "../lib/i18n";
import { initSentry } from "../lib/sentry";
import { initPostHog } from "../lib/posthog";
import { GlobalErrorBoundary } from "../components/GlobalErrorBoundary";
import { logger } from "../lib/logger";
import { initGlobalErrorHandlers } from "../lib/global-error-handler";
import { initNetworkLogger } from "../lib/network-logger";
import { initPerformanceMonitoring } from "../lib/performance-logger";
import { supabase } from "../integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";

logger.info("Sthira Markets bundle: Pre-loading", { component: "MarketsEntry" });

if (typeof globalThis !== "undefined" && typeof (globalThis as any).crypto !== "undefined") {
  const c = (globalThis as any).crypto;
  if (typeof c.randomUUID !== "function") {
    c.randomUUID = () => uuidv4();
  }
}

initSentry();
initPostHog();
logger.initialize(supabase as any);
logger.enableConsoleInterception();
initGlobalErrorHandlers();
initNetworkLogger();
initPerformanceMonitoring();

logger.info("Sthira Markets bundle: Rendering", { component: "MarketsEntry" });

createRoot(document.getElementById("root")!).render(
  <GlobalErrorBoundary>
    <MarketsApp />
  </GlobalErrorBoundary>
);

logger.info("Sthira Markets bundle: Mount complete", { component: "MarketsEntry" });
