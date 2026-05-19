import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  isBiometricAvailable,
  requireBiometric,
} from "./biometric";

// ── Platform fixture ─────────────────────────────────────────────────────────
//
// vi.hoisted mutable so each test can flip Capacitor's reported platform.
const mockPlatform = vi.hoisted(() => ({ value: "web" as "web" | "android" | "ios" }));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    getPlatform: () => mockPlatform.value,
  },
}));

// Mock the plugin so we can drive different responses per test.
// vi.hoisted so the references exist when vi.mock's factory is hoisted.
const { authenticateMock, checkMock } = vi.hoisted(() => ({
  authenticateMock: vi.fn(),
  checkMock: vi.fn(),
}));

vi.mock("@aparajita/capacitor-biometric-auth", async () => {
  // Re-export the real enums so the wrapper can compare codes.
  const actual = await vi.importActual<
    typeof import("@aparajita/capacitor-biometric-auth")
  >("@aparajita/capacitor-biometric-auth");
  return {
    ...actual,
    BiometricAuth: {
      authenticate: authenticateMock,
      checkBiometry: checkMock,
    },
  };
});

describe("biometric wrapper — web platform", () => {
  beforeEach(() => {
    mockPlatform.value = "web";
    authenticateMock.mockClear();
    checkMock.mockClear();
  });

  it("isBiometricAvailable returns true on web (so UI affordances stay testable)", async () => {
    await expect(isBiometricAvailable()).resolves.toBe(true);
    expect(checkMock).not.toHaveBeenCalled();
  });

  it("requireBiometric passes through with method='web' and never calls the plugin", async () => {
    const out = await requireBiometric({ reason: "test" });
    expect(out).toEqual({ ok: true, method: "web" });
    expect(authenticateMock).not.toHaveBeenCalled();
  });
});

describe("biometric wrapper — native (Android) platform", () => {
  beforeEach(() => {
    mockPlatform.value = "android";
    authenticateMock.mockReset();
    checkMock.mockReset();
  });

  it("returns ok+method='biometric' when authenticate resolves", async () => {
    authenticateMock.mockResolvedValueOnce(undefined);
    const out = await requireBiometric({ reason: "Authorise this rebalance" });
    expect(out).toEqual({ ok: true, method: "biometric" });
    expect(authenticateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "Authorise this rebalance",
        allowDeviceCredential: true,
      }),
    );
  });

  it("maps userCancel into a non-error 'userCancel' outcome", async () => {
    const { BiometryError, BiometryErrorType } = await import(
      "@aparajita/capacitor-biometric-auth"
    );
    authenticateMock.mockRejectedValueOnce(
      new BiometryError("user tapped Cancel", BiometryErrorType.userCancel),
    );
    const out = await requireBiometric({ reason: "x" });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.reason).toBe("userCancel");
    }
  });

  it("maps lockout into the lockout outcome", async () => {
    const { BiometryError, BiometryErrorType } = await import(
      "@aparajita/capacitor-biometric-auth"
    );
    authenticateMock.mockRejectedValueOnce(
      new BiometryError("locked", BiometryErrorType.biometryLockout),
    );
    const out = await requireBiometric({ reason: "x" });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("lockout");
  });

  it("maps not-enrolled / not-available into the unavailable outcome", async () => {
    const { BiometryError, BiometryErrorType } = await import(
      "@aparajita/capacitor-biometric-auth"
    );
    authenticateMock.mockRejectedValueOnce(
      new BiometryError("no fingerprints enrolled", BiometryErrorType.biometryNotEnrolled),
    );
    const out = await requireBiometric({ reason: "x" });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("unavailable");
  });

  it("isBiometricAvailable reads checkBiometry().isAvailable", async () => {
    checkMock.mockResolvedValueOnce({ isAvailable: true });
    await expect(isBiometricAvailable()).resolves.toBe(true);

    checkMock.mockResolvedValueOnce({ isAvailable: false });
    await expect(isBiometricAvailable()).resolves.toBe(false);
  });

  it("isBiometricAvailable returns false when the plugin throws", async () => {
    checkMock.mockRejectedValueOnce(new Error("plugin missing"));
    await expect(isBiometricAvailable()).resolves.toBe(false);
  });
});
