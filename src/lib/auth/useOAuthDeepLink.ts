/**
 * useOAuthDeepLink — registers a Capacitor App.appUrlOpen listener that
 * catches the OAuth callback returned to com.sos.sthira://auth-callback
 * and establishes the Supabase session.
 *
 * Flow (native only):
 *   1. User taps a Continue-with-X button.
 *   2. signInWithProviderOAuth opens the provider URL in Custom Tabs /
 *      SFSafariViewController.
 *   3. User signs in at provider; provider redirects to Supabase Auth;
 *      Supabase exchanges the code, then 302s to
 *      com.sos.sthira://auth-callback#access_token=…&refresh_token=…
 *   4. Android / iOS sees the custom scheme and hands the URL to our
 *      app via App.appUrlOpen. The in-app browser sheet auto-closes.
 *   5. This hook parses the URL hash, calls supabase.auth.setSession(),
 *      explicitly closes any lingering Browser instance, and routes to
 *      "/" so RootRedirect handles the destination shell.
 *
 * No-op on web — supabase-js's detectSessionInUrl + AuthOAuthCallback
 * cover that path.
 *
 * Mount once at the top of <App />, NOT inside a route component
 * (otherwise unmounting the route removes the listener mid-OAuth-flow).
 *
 * Design: docs/plans/2026-05-27-google-microsoft-auth-design.md
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { App as CapacitorApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";

import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

const SCHEME_PREFIX = "com.sos.sthira://auth-callback";

interface ParsedTokens {
  access_token:  string;
  refresh_token: string;
  expires_in?:   string;
  token_type?:   string;
}

/**
 * Parse the URL fragment Supabase appends after a successful OAuth
 * round-trip. Falls back to query params for providers/configurations
 * that put tokens in ?query= instead of #hash.
 */
function parseTokens(url: string): ParsedTokens | { error: string } {
  // URL constructor strips trailing #fragment if no hash, so we use
  // string splitting to capture both ?query and #hash variants.
  const hashIdx = url.indexOf("#");
  const qIdx    = url.indexOf("?");
  const part = hashIdx >= 0 ? url.slice(hashIdx + 1)
              : qIdx    >= 0 ? url.slice(qIdx + 1)
              : "";
  const params = new URLSearchParams(part);
  // Prefer error_description (human-readable per OAuth 2.0 §4.1.2.1)
  // and fall back to error code when no description is supplied.
  const err = params.get("error_description") ?? params.get("error");
  if (err) return { error: err };
  const access_token  = params.get("access_token")  ?? "";
  const refresh_token = params.get("refresh_token") ?? "";
  if (!access_token || !refresh_token) {
    return { error: "OAuth callback missing tokens" };
  }
  return {
    access_token, refresh_token,
    expires_in: params.get("expires_in") ?? undefined,
    token_type: params.get("token_type") ?? undefined,
  };
}

export function useOAuthDeepLink() {
  const navigate = useNavigate();

  useEffect(() => {
    // Web has no Capacitor App plugin available. Bail early so the
    // hook is safe to mount at the top of <App /> regardless of
    // platform.
    if (!Capacitor.isNativePlatform()) return;

    let active = true;
    const sub = CapacitorApp.addListener("appUrlOpen", async (event) => {
      if (!active) return;
      const url = event?.url ?? "";
      if (!url.startsWith(SCHEME_PREFIX)) return;

      logger.info("[auth-oauth] deep-link received");

      const parsed = parseTokens(url);
      if ("error" in parsed) {
        logger.warn("[auth-oauth] deep-link parse failed", { reason: parsed.error });
        // Best-effort close of any still-visible Browser tab; ignore
        // close failures (the tab may already be closing on its own).
        await Browser.close().catch(() => undefined);
        navigate(`/auth?oauth_error=${encodeURIComponent(parsed.error)}`, { replace: true });
        return;
      }

      try {
        const { error } = await supabase.auth.setSession({
          access_token:  parsed.access_token,
          refresh_token: parsed.refresh_token,
        });
        if (error) throw error;
      } catch (e: any) {
        logger.error("[auth-oauth] setSession failed", { error: e?.message ?? String(e) });
        await Browser.close().catch(() => undefined);
        navigate(`/auth?oauth_error=${encodeURIComponent(e?.message ?? "session_error")}`, { replace: true });
        return;
      }

      // Session established. Close the in-app browser sheet (no-op on
      // Android Custom Tabs since the tab auto-closed when the OS
      // routed to our scheme, but iOS SFSafariViewController needs the
      // explicit close call to dismiss).
      await Browser.close().catch(() => undefined);

      // RootRedirect at "/" routes the now-signed-in user to the right
      // shell based on their active membership (retail → Sthira;
      // else → /dashboard).
      navigate("/", { replace: true });
    });

    return () => {
      active = false;
      // Capacitor's removeAllListeners is the modern API; the older
      // sub.then(s => s.remove()) pattern also works but is harder to
      // read. We use the .remove() returned by the promise.
      void sub.then((handle) => handle.remove()).catch(() => undefined);
    };
  }, [navigate]);
}
