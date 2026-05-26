import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Sthira mobile-brand fonts (lazy-loaded via @fontsource subsets).
// Source Serif Pro = headlines + tabular numerals; Inter = body/UI.
import "@fontsource/source-serif-pro/400.css";
import "@fontsource/source-serif-pro/600.css";
import "@fontsource/source-serif-pro/400-italic.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";

// Apply dark mode before first render to prevent flash
if (typeof window !== "undefined") {
  const storedDark = localStorage.getItem("lnai_dark_mode");
  if (
    storedDark === "true" ||
    (!storedDark && typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches)
  ) {
    document.documentElement.classList.add("dark");
  }
}

// Apply the persisted Sthira theme before first render so users with
// a non-default pick (e.g. Midnight) don't flash the Classic palette.
import { applyPersistedSthiraTheme } from "./features/markets/sthira/useSthiraTheme";
applyPersistedSthiraTheme();

import "./lib/i18n";
import { initSentry } from "./lib/sentry";
import { initPostHog } from "./lib/posthog";
import { GlobalErrorBoundary } from "./components/GlobalErrorBoundary";
import { logger } from "./lib/logger";
import { initGlobalErrorHandlers } from "./lib/global-error-handler";
import { initNetworkLogger } from "./lib/network-logger";
import { initPerformanceMonitoring } from "./lib/performance-logger";
import { supabase } from "./integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";

// Initialize core services
logger.info("Platform Startup: Pre-loading", { component: "Main" });

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

logger.info("Platform Startup: During-loading", { component: "Main", step: "Rendering App" });

createRoot(document.getElementById("root")!).render(
  <GlobalErrorBoundary>
    <App />
  </GlobalErrorBoundary>
);

logger.info("Platform Startup: Post-loading", { component: "Main", step: "Mount Complete" });
