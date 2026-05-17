import posthog from 'posthog-js';
import { logger } from "@/lib/logger";

export const initPostHog = () => {
  const apiKey = import.meta.env.VITE_POSTHOG_KEY;
  const apiHost = import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com';

  if (apiKey) {
    posthog.init(apiKey, {
      api_host: apiHost,
      person_profiles: 'identified_only', // or 'always' to create profiles for anonymous users as well
      loaded: (ph) => {
        if (import.meta.env.DEV) {
          // Optional: You might want to keep it enabled in dev for testing, 
          // or disable it to avoid noise.
          // ph.opt_out_capturing(); 
          logger.debug('PostHog loaded in development mode');
        }
      },
    });
  } else {
    logger.warn("PostHog Key not found. PostHog is disabled.");
  }
};
