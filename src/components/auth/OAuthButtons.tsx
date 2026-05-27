/**
 * OAuthButtons — "Continue with Google" + "Continue with Microsoft"
 * buttons rendered above the email/password form on the Auth page
 * (and later on the Sthira splash).
 *
 * Behaviour:
 *   - Hidden entirely when VITE_ENABLE_OAUTH is not "true", so the
 *     code can ship dormant until the external setup (Google Cloud +
 *     Azure + Supabase Dashboard) is complete.
 *   - On click, calls signInWithProviderOAuth — supabase-js navigates
 *     the current tab to the provider authorize URL. No further
 *     in-component work; AuthOAuthCallback handles the return.
 *   - Native (Capacitor) hint: until Slice 3 wires deep-link return,
 *     these buttons surface a "use web for now" toast on native
 *     instead of opening a broken in-app browser flow.
 *
 * Design: docs/plans/2026-05-27-google-microsoft-auth-design.md
 */
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";

import {
  OAUTH_SIGNIN_ENABLED,
  signInWithProviderOAuth,
  type OAuthProvider,
} from "@/lib/auth/oauthSignIn";

export interface OAuthButtonsProps {
  /** Disable while the email/password form is busy. */
  disabled?: boolean;
  /** Show "or continue with email" divider below. Default true. */
  showDivider?: boolean;
  /** Tailwind override for the divider+button stack. */
  className?: string;
}

export function OAuthButtons({
  disabled, showDivider = true, className,
}: OAuthButtonsProps) {
  const [pending, setPending] = useState<OAuthProvider | null>(null);

  if (!OAUTH_SIGNIN_ENABLED) return null;

  async function handleClick(provider: OAuthProvider) {
    if (pending) return;
    // Slice 1 ships web only; native deep-link handling lands in Slice 3.
    if (Capacitor.isNativePlatform()) {
      toast.info(
        "Google / Microsoft sign-in on the app is coming soon. " +
        "Please use email and password for now.",
      );
      return;
    }
    setPending(provider);
    try {
      await signInWithProviderOAuth(provider);
      // On web, signInWithOAuth navigates the tab away; we won't reach
      // here unless something prevented the redirect.
    } catch (e: any) {
      toast.error(e?.message ?? `${provider} sign-in failed`);
      setPending(null);
    }
  }

  return (
    <div className={className ?? "space-y-3"}>
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => handleClick("google")}
          disabled={disabled || pending !== null}
          data-testid="oauth-google"
          className="flex w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {pending === "google" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <GoogleGlyph />
          )}
          Continue with Google
        </button>
        <button
          type="button"
          onClick={() => handleClick("azure")}
          disabled={disabled || pending !== null}
          data-testid="oauth-microsoft"
          className="flex w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {pending === "azure" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MicrosoftGlyph />
          )}
          Continue with Microsoft
        </button>
      </div>
      {showDivider && (
        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
            <span className="bg-card px-2 text-muted-foreground">
              or continue with email
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// Brand glyphs — minimal SVG so we don't add an icon-font dep.
// Sized to match Lucide icons (h-4 w-4 in surrounding buttons).

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
      <path fill="#FBBC04" d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
    </svg>
  );
}

function MicrosoftGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <rect x="2"  y="2"  width="9.5" height="9.5" fill="#F25022" />
      <rect x="12.5" y="2"  width="9.5" height="9.5" fill="#7FBA00" />
      <rect x="2"  y="12.5" width="9.5" height="9.5" fill="#00A4EF" />
      <rect x="12.5" y="12.5" width="9.5" height="9.5" fill="#FFB900" />
    </svg>
  );
}
