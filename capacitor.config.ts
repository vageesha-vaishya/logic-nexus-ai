import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for the Logic Nexus mobile shell (Addendum T24).
 *
 * Phase 1 = Android only. iOS lands in Phase 1.5 — `npx cap add ios` from
 * macOS will create the platform directory without touching this file.
 *
 * webDir = "dist" matches the Vite build output. Run `npm run mobile:build`
 * to rebuild + sync in one step.
 *
 * The `server.url` block is intentionally absent in this committed config so
 * the native shell loads the bundled `dist/` assets — that's the production
 * mode. For live-reload dev against the local Vite server, override with
 * `capacitor.config.local.ts` (gitignored) or pass --no-sync flags to
 * `cap run android`.
 */
const config: CapacitorConfig = {
  appId:   "com.sos.sthira",
  appName: "Sthira",
  webDir:  "dist",

  // androidScheme=https so cookies + Supabase storage behave like a real
  // origin instead of the default capacitor:// scheme, which trips some
  // libraries (e.g. supabase-js cookie storage falls back to localStorage
  // when scheme is non-http(s)).
  server: {
    androidScheme: "https",
  },

  // Plugin defaults. Keep this list minimal; plugin-specific behaviour
  // lives inside each plugin's call site (e.g. BiometricAuth in the
  // login screen, PushNotifications in main.tsx).
  plugins: {
    PushNotifications: {
      // FCM presentation options for foreground notifications.
      presentationOptions: ["badge", "sound", "alert"],
    },
  },

  // Hide the splash screen as soon as React mounts — no splash plugin
  // configured today, but if we add one later this is where to tune it.
  android: {
    // Allow our own dev server during local cap-live-reload sessions.
    allowMixedContent: false,
    captureInput: true,
  },
};

export default config;
