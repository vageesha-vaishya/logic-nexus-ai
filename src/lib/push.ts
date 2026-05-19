/**
 * Cross-platform push-notification registration (Phase 1 Addendum T24c).
 *
 * Thin wrapper around @capacitor/push-notifications. On web the plugin
 * doesn't exist meaningfully — we no-op so calling code can use the same
 * API in browser preview and on Android.
 *
 * Registration flow on Android:
 *   1. requestPermissions()  → 'granted' | 'denied'
 *   2. register()            → kicks off FCM token assignment
 *   3. addListener('registration', t => …) fires with the device token
 *
 * Tokens are POSTed to the markets-worker so the FCM dispatcher knows
 * where to send pushes. Re-registration is idempotent server-side.
 */
import { Capacitor } from "@capacitor/core";

import { supabase } from "@/integrations/supabase/client";

const WORKER_URL = import.meta.env.VITE_MARKETS_WORKER_URL ?? "http://localhost:8001";

const isWeb = (): boolean => Capacitor.getPlatform() === "web";

async function postRegister(token: string, platform: "android" | "ios" | "web"): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const access = session?.access_token;
  if (!access) return; // can't register without a logged-in user

  const resp = await fetch(`${WORKER_URL}/v1/retail/push/register`, {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${access}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ platform, token }),
  });
  if (!resp.ok) {
    throw new Error(`push register: ${resp.status}`);
  }
}

export type PushRegisterOutcome =
  | { ok: true;  token: string; platform: "android" | "ios" | "web" }
  | { ok: false; reason: "web" | "denied" | "unsupported" | "error"; message?: string };

/**
 * Request permission + register the device for push. Idempotent — Android
 * returns the same FCM token across calls until the user clears app data.
 *
 * Tests can mock this whole module by setting platform="web" in the
 * Capacitor mock — the function then short-circuits before touching the
 * plugin.
 */
export async function registerForPush(): Promise<PushRegisterOutcome> {
  if (isWeb()) {
    return { ok: false, reason: "web" };
  }

  let plugin: typeof import("@capacitor/push-notifications").PushNotifications | undefined;
  try {
    // Dynamic import so the web bundle doesn't drag in plugin code that
    // never runs in browsers.
    plugin = (await import("@capacitor/push-notifications")).PushNotifications;
  } catch (err) {
    return {
      ok:      false,
      reason:  "unsupported",
      message: err instanceof Error ? err.message : String(err),
    };
  }

  try {
    const perm = await plugin.requestPermissions();
    if (perm.receive !== "granted") {
      return { ok: false, reason: "denied" };
    }

    // Race-style: kick off register, await the next 'registration' event.
    const tokenPromise = new Promise<string>((resolve, reject) => {
      let resolved = false;
      const cleanup = (listeners: { remove(): Promise<void> }[]) => {
        for (const l of listeners) void l.remove();
      };
      const start = async () => {
        const onToken = await plugin!.addListener("registration", (t) => {
          if (resolved) return;
          resolved = true;
          cleanup(handles);
          resolve(t.value);
        });
        const onError = await plugin!.addListener("registrationError", (e) => {
          if (resolved) return;
          resolved = true;
          cleanup(handles);
          reject(new Error(e.error || "registrationError"));
        });
        const handles = [onToken, onError];
        await plugin!.register();
      };
      void start();
      // Give Android up to 15s — slow networks + first-launch handshakes.
      setTimeout(() => {
        if (resolved) return;
        resolved = true;
        reject(new Error("FCM registration timed out"));
      }, 15_000);
    });

    const token = await tokenPromise;
    const platform = Capacitor.getPlatform() === "ios" ? "ios" : "android";
    await postRegister(token, platform);
    return { ok: true, token, platform };
  } catch (err) {
    return {
      ok: false,
      reason: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
