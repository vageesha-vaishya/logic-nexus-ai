/**
 * oauthSignIn unit tests — pin the Supabase call shape that
 * AuthOAuthCallback + Supabase Auth depend on. Mock supabase-js so the
 * test doesn't actually navigate the JSDOM window.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// vi.mock is hoisted, so we use vi.hoisted() to define the spy in the
// hoisted scope and reference it from both the mock factory and the
// per-test assertions. Without this the import would fire before the
// spy is initialised.
const { signInWithOAuth } = vi.hoisted(() => ({ signInWithOAuth: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signInWithOAuth } },
}));

import { signInWithProviderOAuth } from "./oauthSignIn";

beforeEach(() => {
  signInWithOAuth.mockReset();
  signInWithOAuth.mockResolvedValue({
    data: { url: "https://accounts.google.com/o/oauth2/v2/auth?…" },
    error: null,
  });
});

describe("signInWithProviderOAuth", () => {
  it("calls supabase with provider=google and the right hints/scopes", async () => {
    await signInWithProviderOAuth("google", { redirectTo: "https://example.test/auth/callback" });
    expect(signInWithOAuth).toHaveBeenCalledTimes(1);
    const [{ provider, options }] = signInWithOAuth.mock.calls[0];
    expect(provider).toBe("google");
    expect(options.redirectTo).toBe("https://example.test/auth/callback");
    expect(options.scopes).toBe("email openid profile");
    expect(options.queryParams).toEqual({
      access_type: "offline",
      prompt: "consent select_account",
    });
  });

  it("calls supabase with provider=azure and Microsoft-appropriate scopes", async () => {
    await signInWithProviderOAuth("azure", { redirectTo: "https://example.test/auth/callback" });
    const [{ provider, options }] = signInWithOAuth.mock.calls[0];
    expect(provider).toBe("azure");
    // offline_access required for refresh tokens on the Azure side
    expect(options.scopes).toBe("email openid profile offline_access");
    expect(options.queryParams).toEqual({ prompt: "select_account" });
  });

  it("falls back to window.location.origin/auth/callback when no redirectTo supplied", async () => {
    const original = window.location.href;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: new URL("https://app.example/some/page"),
    });
    try {
      await signInWithProviderOAuth("google");
      const [{ options }] = signInWithOAuth.mock.calls[0];
      expect(options.redirectTo).toBe("https://app.example/auth/callback");
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: new URL(original) });
    }
  });

  it("throws the Supabase error message when signInWithOAuth fails", async () => {
    signInWithOAuth.mockResolvedValue({
      data: { url: null },
      error: { message: "provider misconfigured" },
    });
    await expect(
      signInWithProviderOAuth("google", { redirectTo: "https://example.test/auth/callback" }),
    ).rejects.toThrow("provider misconfigured");
  });

  it("uses a default error message when the Supabase error has no message", async () => {
    signInWithOAuth.mockResolvedValue({ data: { url: null }, error: {} });
    await expect(
      signInWithProviderOAuth("azure", { redirectTo: "https://example.test/auth/callback" }),
    ).rejects.toThrow(/azure sign-in failed/i);
  });

  it("does not double-call supabase on success (no retry/recovery)", async () => {
    await signInWithProviderOAuth("google", { redirectTo: "https://example.test/auth/callback" });
    await signInWithProviderOAuth("google", { redirectTo: "https://example.test/auth/callback" });
    expect(signInWithOAuth).toHaveBeenCalledTimes(2); // two distinct invocations, not a single retry
  });
});
