import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for the Sthira mobile shell.
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
    SplashScreen: {
      // Sthira splash — navy background, copper wordmark.
      // See docs/plans/2026-05-20-sthira-mobile-onboarding-and-markets-ux-design.md
      //
      // PR 1: launchAutoHide stays true so the native splash dismisses on
      // its own after launchShowDuration. PR 2 will flip this to false and
      // call hideSthiraSplash() once session + tenant config resolve.
      // Without that programmatic hide, false would freeze the app on the
      // splash forever — observed today on Nord after PR 1 install.
      launchShowDuration:        1500,
      launchAutoHide:            true,
      backgroundColor:           "#0F1A2E",
      androidSplashResourceName: "splash",
      androidScaleType:          "CENTER_CROP",
      showSpinner:               false,
      splashFullScreen:          true,
      splashImmersive:           true,
    },
  },

  android: {
    // Allow our own dev server during local cap-live-reload sessions.
    allowMixedContent: false,
    captureInput: true,
  },
};

export default config;
