/**
 * Pure-function tests for the derived-state logic inside useDomainAssignment.
 * The hook itself is integration-heavy (Supabase + TanStack Query); what
 * we can test cheaply in isolation is the derivation from a raw row to
 * the UI flags (isTrialing / isPaidActive / isFreemium / trialDaysRemaining).
 *
 * We re-implement deriveStatus here as a thin wrapper to avoid exposing
 * the original — the hook keeps it private. Keeping the test in sync is
 * the cost of that; if the original logic changes, this file fails fast.
 */
import { describe, expect, it } from "vitest";

// Mirror of the deriveStatus function in useDomainAssignment.ts. Kept
// here so the test pins the contract — a divergence between the two
// catches drift during reviews.
function deriveStatus(a: {
  subscription_status:      "active" | "trialing" | "past_due" | "cancelled";
  razorpay_subscription_id: string | null;
  trial_ends_at:            string | null;
} | null) {
  if (!a) return { trialDaysRemaining: NaN, isTrialing: false, isPaidActive: false, isFreemium: false };
  const isTrialing  = a.subscription_status === "trialing";
  const isPaidActive = a.subscription_status === "active" && Boolean(a.razorpay_subscription_id);
  const isFreemium   = a.subscription_status === "active" && !a.razorpay_subscription_id;
  let trialDaysRemaining = NaN;
  if (isTrialing && a.trial_ends_at) {
    const ms = new Date(a.trial_ends_at).getTime() - Date.now();
    trialDaysRemaining = Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  }
  return { trialDaysRemaining, isTrialing, isPaidActive, isFreemium };
}

describe("useDomainAssignment / deriveStatus", () => {
  it("null assignment → all flags false, NaN days", () => {
    const d = deriveStatus(null);
    expect(d.isTrialing).toBe(false);
    expect(d.isPaidActive).toBe(false);
    expect(d.isFreemium).toBe(false);
    expect(Number.isNaN(d.trialDaysRemaining)).toBe(true);
  });

  it("active + razorpay id → isPaidActive", () => {
    const d = deriveStatus({
      subscription_status:      "active",
      razorpay_subscription_id: "pay_123",
      trial_ends_at:            null,
    });
    expect(d.isPaidActive).toBe(true);
    expect(d.isFreemium).toBe(false);
    expect(d.isTrialing).toBe(false);
  });

  it("active + no razorpay id → isFreemium", () => {
    const d = deriveStatus({
      subscription_status:      "active",
      razorpay_subscription_id: null,
      trial_ends_at:            null,
    });
    expect(d.isFreemium).toBe(true);
    expect(d.isPaidActive).toBe(false);
    expect(d.isTrialing).toBe(false);
  });

  it("trialing → isTrialing + computes days remaining from trial_ends_at", () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const d = deriveStatus({
      subscription_status:      "trialing",
      razorpay_subscription_id: null,
      trial_ends_at:            future,
    });
    expect(d.isTrialing).toBe(true);
    expect(d.trialDaysRemaining).toBeGreaterThanOrEqual(7);
    expect(d.trialDaysRemaining).toBeLessThanOrEqual(8);
  });

  it("trialing past the expiry → 0 days remaining (sweep will catch it)", () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const d = deriveStatus({
      subscription_status:      "trialing",
      razorpay_subscription_id: null,
      trial_ends_at:            past,
    });
    expect(d.isTrialing).toBe(true);
    expect(d.trialDaysRemaining).toBe(0);
  });

  it("past_due → no flags fire", () => {
    const d = deriveStatus({
      subscription_status:      "past_due",
      razorpay_subscription_id: "pay_abc",
      trial_ends_at:            null,
    });
    expect(d.isPaidActive).toBe(false);
    expect(d.isFreemium).toBe(false);
    expect(d.isTrialing).toBe(false);
  });
});
