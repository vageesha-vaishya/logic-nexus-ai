/**
 * Cross-platform biometric prompt (Phase 1 Addendum T24b).
 *
 * Thin wrapper around `@aparajita/capacitor-biometric-auth`. The plugin is
 * a no-op on web — we add an explicit `getPlatform() === 'web'` guard so
 * the per-trade gate works as a pass-through in the browser preview
 * without firing a meaningless "authentication unavailable" error.
 *
 * Auth boundary (per addendum §2): biometric is a LOCAL re-confirmation
 * layered on top of an active Supabase session. It's not a separate
 * identity; failure to authenticate just blocks the next action. This
 * module never touches the session itself.
 */
import { Capacitor } from "@capacitor/core";
import {
  BiometricAuth,
  BiometryError,
  BiometryErrorType,
} from "@aparajita/capacitor-biometric-auth";

export type BiometricOutcome =
  | { ok: true; method: "biometric" | "web" }
  | { ok: false; reason: "userCancel" | "lockout" | "unavailable" | "error"; message: string };

const isWeb = (): boolean => Capacitor.getPlatform() === "web";

/**
 * Quick check before showing UI affordances ("Enable biometric login").
 * Always returns true on web so the toggle remains testable in the
 * browser preview; the actual prompt then no-ops at the right moment.
 */
export async function isBiometricAvailable(): Promise<boolean> {
  if (isWeb()) return true;
  try {
    const info = await BiometricAuth.checkBiometry();
    return Boolean(info.isAvailable);
  } catch {
    return false;
  }
}

/**
 * Prompt the OS biometric dialog. Resolves with structured outcome.
 * Web platform passes through with method='web' so we can record the
 * audit method consistently (e.g. on the rebalance execute payload).
 */
export async function requireBiometric(opts: {
  reason: string;
  cancelTitle?: string;
}): Promise<BiometricOutcome> {
  if (isWeb()) {
    return { ok: true, method: "web" };
  }

  try {
    await BiometricAuth.authenticate({
      reason:      opts.reason,
      cancelTitle: opts.cancelTitle ?? "Cancel",
      // Allow device PIN fallback so a user without a working fingerprint
      // sensor isn't locked out of trading entirely.
      allowDeviceCredential: true,
    });
    return { ok: true, method: "biometric" };
  } catch (err) {
    // The plugin throws BiometryError with a typed `.code`.
    if (err instanceof BiometryError) {
      const code = err.code;
      if (
        code === BiometryErrorType.userCancel ||
        code === BiometryErrorType.appCancel ||
        code === BiometryErrorType.systemCancel
      ) {
        return { ok: false, reason: "userCancel", message: "Authentication cancelled" };
      }
      if (code === BiometryErrorType.biometryLockout) {
        return {
          ok: false,
          reason: "lockout",
          message: "Too many attempts — try again later or use device PIN",
        };
      }
      if (
        code === BiometryErrorType.biometryNotAvailable ||
        code === BiometryErrorType.biometryNotEnrolled ||
        code === BiometryErrorType.noDeviceCredential
      ) {
        return {
          ok: false,
          reason: "unavailable",
          message: err.message || "Biometric not set up on this device",
        };
      }
      return { ok: false, reason: "error", message: err.message };
    }
    // Non-BiometryError — surface the message and call it generic.
    return {
      ok: false,
      reason: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
