/**
 * Sthira splash controller — small wrapper over @capacitor/splash-screen.
 *
 * The native splash is configured with launchAutoHide=false in
 * capacitor.config.ts, so the app stays on the splash until the JS shell is
 * ready to take over (session + tenant resolved). The hide() call here
 * triggers the cross-fade. PR 2 wires this into the splash route.
 *
 * On non-native platforms (web preview), hide() is a no-op so callers don't
 * need a platform check.
 */
import { Capacitor } from "@capacitor/core";

let hidden = false;

export async function hideSthiraSplash(): Promise<void> {
  if (hidden) return;
  hidden = true;

  if (!Capacitor.isNativePlatform()) return;

  try {
    // Lazy-import so the web bundle doesn't pay for the plugin code.
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide({ fadeOutDuration: 250 });
  } catch (err) {
    // Splash failing to hide is non-fatal — the app still renders on top.
    // Surface for debugging but don't throw.
    // eslint-disable-next-line no-console
    console.warn("[sthira] failed to hide splash:", err);
  }
}

/** Test-only reset. Do not call from app code. */
export function __resetSthiraSplashForTests(): void {
  hidden = false;
}
