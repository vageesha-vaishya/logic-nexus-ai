/**
 * Open a URL in the device's external browser.
 *
 * On Capacitor native (Sthira APK), `window.open(..., "_blank")` silently
 * no-ops inside the WebView — so we must route through @capacitor/browser
 * which uses Android Custom Tabs / iOS SFSafariViewController. Falls back
 * to window.open on web.
 */
import { Capacitor } from "@capacitor/core";

export async function openExternal(url: string): Promise<void> {
  if (!url) return;
  if (Capacitor.isNativePlatform()) {
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url });
      return;
    } catch {
      // Plugin not available — fall through to window.open.
    }
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
