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
 *   The library returns the authorize URL instead of redirecting.
 *   We open it in Chrome Custom Tabs / SFSafariViewController via
 *   @capacitor/browser. The OS deep-link handler at app boot picks up
 *   the callback URL (com.sos.sthira://auth-callback#…) and calls
 *   supabase.auth.setSession() — Slice 3 wires that part.
 *
 * Slice 1 (this commit): web path only. Native path emits a warning
 * toast directing the user to the web until Slice 3 ships.
 */
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

/**
 * Default redirect target. Pure function of window.location.origin so
 * staging/preview deploys work without env-specific config. Tests can
 * override via the SignInOptions.redirectTo escape hatch.
 */
function defaultRedirectTo(): string {
  if (typeof window === "undefined") {
    // SSR / Node test env — caller must override.
    return "";
  }
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

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      queryParams: providerHints(provider),
      scopes: providerScopes(provider),
    },
  });

  if (error) {
    throw new Error(error.message || `${provider} sign-in failed`);
  }

  // On web, supabase-js navigates the current tab to the provider URL —
  // execution effectively halts here. On native (Capacitor), Slice 3
  // will open data.url in @capacitor/browser; until then, the call
  // resolves with no navigation and the caller surfaces an error toast.
}
