import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./lib/i18n";
import { initSentry } from "./lib/sentry";
import { initPostHog } from "./lib/posthog";
import { GlobalErrorBoundary } from "./components/GlobalErrorBoundary";
import { logger } from "./lib/logger";
import { initGlobalErrorHandlers } from "./lib/global-error-handler";
import { initNetworkLogger } from "./lib/network-logger";
import { initPerformanceMonitoring } from "./lib/performance-logger";
import { supabase } from "./integrations/supabase/client";

// Initialize core services
logger.info("Platform Startup: Pre-loading", { component: "Main" });

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
