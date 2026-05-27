/**
 * useOAuthDeepLink unit tests — exercise the parseTokens helper indirectly
 * through the hook and assert that:
 *   • non-matching URLs are ignored
 *   • valid callback URLs call supabase.auth.setSession
 *   • error-URL callbacks navigate to /auth with an oauth_error param
 *   • web (non-Capacitor) is a no-op
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { isNativePlatform, addListener, setSession, navigate, browserClose } = vi.hoisted(() => ({
  isNativePlatform: vi.fn(),
  addListener:      vi.fn(),
  setSession:       vi.fn(),
  navigate:         vi.fn(),
  browserClose:     vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => isNativePlatform() },
}));

vi.mock("@capacitor/app", () => ({
  App: { addListener: (...args: unknown[]) => addListener(...args) },
}));

vi.mock("@capacitor/browser", () => ({
  Browser: { close: (...args: unknown[]) => browserClose(...args) },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { setSession: (...a: unknown[]) => setSession(...a) } },
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigate };
});

import { useOAuthDeepLink } from "./useOAuthDeepLink";

function Probe() {
  useOAuthDeepLink();
  return null;
}

function renderProbe() {
  render(
    <MemoryRouter>
      <Probe />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  isNativePlatform.mockReset();
  addListener.mockReset();
  setSession.mockReset();
  navigate.mockReset();
  browserClose.mockReset();
  setSession.mockResolvedValue({ error: null });
  browserClose.mockResolvedValue(undefined);
  // addListener returns a promise that resolves to { remove }
  addListener.mockResolvedValue({ remove: vi.fn() });
});

async function captureHandler() {
  // The hook calls App.addListener('appUrlOpen', handler). Pluck the handler.
  await new Promise((r) => setTimeout(r, 0));
  expect(addListener).toHaveBeenCalled();
  const [event, handler] = addListener.mock.calls[0];
  expect(event).toBe("appUrlOpen");
  return handler as (event: { url: string }) => Promise<void>;
}

describe("useOAuthDeepLink", () => {
  it("is a no-op on web (non-Capacitor)", () => {
    isNativePlatform.mockReturnValue(false);
    renderProbe();
    expect(addListener).not.toHaveBeenCalled();
  });

  it("registers an appUrlOpen listener on native", () => {
    isNativePlatform.mockReturnValue(true);
    renderProbe();
    expect(addListener).toHaveBeenCalledWith("appUrlOpen", expect.any(Function));
  });

  it("ignores deep-links that don't start with our scheme", async () => {
    isNativePlatform.mockReturnValue(true);
    renderProbe();
    const handler = await captureHandler();
    await handler({ url: "https://example.com/other-app" });
    expect(setSession).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("sets session and navigates to / on valid callback", async () => {
    isNativePlatform.mockReturnValue(true);
    renderProbe();
    const handler = await captureHandler();
    await handler({
      url:
        "com.sos.sthira://auth-callback#access_token=AT&refresh_token=RT&expires_in=3600&token_type=bearer",
    });
    expect(setSession).toHaveBeenCalledWith({
      access_token: "AT",
      refresh_token: "RT",
    });
    expect(browserClose).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("routes to /auth with oauth_error param when callback carries error", async () => {
    isNativePlatform.mockReturnValue(true);
    renderProbe();
    const handler = await captureHandler();
    await handler({
      url:
        "com.sos.sthira://auth-callback?error=access_denied&error_description=user_cancelled",
    });
    expect(setSession).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(
      "/auth?oauth_error=user_cancelled",
      { replace: true },
    );
  });

  it("routes to /auth with oauth_error when setSession fails", async () => {
    isNativePlatform.mockReturnValue(true);
    setSession.mockResolvedValue({ error: { message: "token_expired" } });
    renderProbe();
    const handler = await captureHandler();
    await handler({
      url:
        "com.sos.sthira://auth-callback#access_token=AT&refresh_token=RT",
    });
    expect(navigate).toHaveBeenCalledWith(
      "/auth?oauth_error=token_expired",
      { replace: true },
    );
  });

  it("rejects callbacks missing tokens", async () => {
    isNativePlatform.mockReturnValue(true);
    renderProbe();
    const handler = await captureHandler();
    await handler({ url: "com.sos.sthira://auth-callback#token_type=bearer" });
    expect(setSession).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(
      expect.stringMatching(/^\/auth\?oauth_error=/),
      { replace: true },
    );
  });
});
