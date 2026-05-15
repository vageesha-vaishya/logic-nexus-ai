import * as Sentry from "@sentry/react";

// Sampling tuned per §16.11 G-4 (2026-05-15). Production economics:
//   tracesSampleRate 1.0 → blows Sentry quota at >10k users
//   replaysSessionSampleRate 0.1 → same; sessions are expensive
// Errors are always captured (errorsSampleRate is implicit 1.0).
const IS_DEV = import.meta.env.DEV === true;

export const initSentry = () => {
  if (import.meta.env.VITE_SENTRY_DSN) {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.MODE,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration(),
      ],
      // Performance Monitoring — 100% in dev for visibility, 5% in prod to keep quota usable at scale.
      tracesSampleRate: IS_DEV ? 1.0 : 0.05,
      // Distributed tracing — only propagate trace headers to our own backends.
      tracePropagationTargets: [
        "localhost",
        /^https:\/\/[a-z0-9-]+\.supabase\.co/,
        /^\/api\//,
      ],
      // Session Replay — only on error in prod (random sampling is the cost killer).
      replaysSessionSampleRate: IS_DEV ? 0.1 : 0.0,
      replaysOnErrorSampleRate: 1.0,
    });
  } else {
    console.warn("Sentry DSN not found. Sentry is disabled.");
  }
};
