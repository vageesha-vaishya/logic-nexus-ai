/**
 * signInWithProviderOAuth — single helper for Google + Microsoft (Azure)
 * OAuth sign-in. Same code path for web and native (Capacitor).
 *
 * Design: docs/plans/2026-05-27-google-microsoft-auth-design.md
 *
 * Web behaviour:
 *   supabase.auth.signInWithOAuth() automatically navigates the current
 *   tab to the provider authorize URL. After the OAuth handshake,
 *   Supabase redirects back to `redirectTo` with #access_token=…&
 *   refresh_token=… in the URL hash. The Supabase client's
 *   detectSessionInUrl (default true) picks that up and sets the
 *   session. AuthOAuthCallback then routes to "/".
 *
 * Native (Capacitor) behaviour:
 *   We pass skipBrowserRedirect:true so supabase-js returns the
 *   authorize URL without navigating the WebView. We open that URL in
 *   Chrome Custom Tabs (Android) / SFSafariViewController (iOS) via
 *   @capacitor/browser. After the user signs in, the provider redirects
 *   to Supabase, which redirects to com.sos.sthira://auth-callback#…
 *   — the OS hands that URL to our app via App.addListener('appUrlOpen'),
 *   the useOAuthDeepLink hook parses the hash and calls
 *   supabase.auth.setSession() to establish the session.
 */
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";

import { supabase } from "@/integrations/supabase/client";

export type OAuthProvider = "google" | "azure";

export interface SignInOptions {
  /** Override the default redirectTo (testing / staging). */
  redirectTo?: string;
}

/**
 * Provider-specific query params we want on EVERY OAuth call.
 * - access_type=offline + prompt=consent → ask Google to issue a refresh
 *   token. Without this, repeat sign-ins skip the consent screen and the
 *   refresh token may not be re-issued.
 * - prompt=select_account → force the account picker so a user with
 *   multiple Google/Microsoft accounts always sees the chooser instead
 *   of being silently signed into the last-used one.
 */
function providerHints(provider: OAuthProvider): Record<string, string> {
  if (provider === "google") {
    return { access_type: "offline", prompt: "consent select_account" };
  }
  return { prompt: "select_account" };
}

function providerScopes(provider: OAuthProvider): string {
  if (provider === "azure") return "email openid profile offline_access";
  return "email openid profile";
}

/** Native deep-link target. Registered in AndroidManifest + iOS Info.plist. */
const NATIVE_REDIRECT_URI = "com.sos.sthira://auth-callback";

/**
 * Default redirect target. On native (Capacitor), points at our custom
 * URL scheme so the OS routes the callback back to the app. On web,
 * uses window.location.origin so staging/preview deploys work without
 * env-specific config. Tests override via SignInOptions.redirectTo.
 */
function defaultRedirectTo(): string {
  if (Capacitor.isNativePlatform()) return NATIVE_REDIRECT_URI;
  if (typeof window === "undefined") return "";  // SSR / Node test env
  return `${window.location.origin}/auth/callback`;
}

/**
 * Whether OAuth sign-in is enabled for this build. Gated behind a Vite
 * env flag so we can ship code without flipping it on in prod until
 * the external setup (Google Cloud + Azure + Supabase Dashboard) is
 * complete.
 */
export const OAUTH_SIGNIN_ENABLED: boolean =
  String(import.meta.env.VITE_ENABLE_OAUTH ?? "").toLowerCase() === "true";

export async function signInWithProviderOAuth(
  provider: OAuthProvider,
  options: SignInOptions = {},
): Promise<void> {
  const redirectTo = options.redirectTo ?? defaultRedirectTo();
  if (!redirectTo) {
    throw new Error("OAuth sign-in needs a redirectTo (no window.location available)");
  }
  const isNative = Capacitor.isNativePlatform();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      queryParams: providerHints(provider),
      scopes: providerScopes(provider),
      // On native we MUST suppress the auto-redirect: supabase-js would
      // try to navigate the WebView's location to the provider URL,
      // which on Capacitor means changing the host-page URL —
      // wrong-place, wrong-behavior. We want the URL returned to us so
      // we can open it via Capacitor Browser (Custom Tabs / SFSafari).
      skipBrowserRedirect: isNative,
    },
  });

  if (error) {
    throw new Error(error.message || `${provider} sign-in failed`);
  }

  if (isNative) {
    if (!data?.url) {
      throw new Error(
        "OAuth provider did not return an authorize URL. " +
        "Check the Supabase Auth provider configuration.",
      );
    }
    await Browser.open({ url: data.url, presentationStyle: "popover" });
    // Execution returns here immediately; the user signs in inside the
    // Custom Tab / Safari sheet. When they're done, Supabase redirects
    // to the NATIVE_REDIRECT_URI custom scheme; the OS hands it to the
    // app via App.addListener('appUrlOpen'); useOAuthDeepLink picks it
    // up and calls supabase.auth.setSession().
    return;
  }

  // Web: supabase-js navigated the current tab to the provider URL.
  // Execution effectively halts after the redirect commits.
}
