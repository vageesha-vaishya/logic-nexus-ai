import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  capacitorAsyncStorage,
  shouldPersistQuery,
} from "./queryPersistence";

// Mock @capacitor/preferences so we can assert the storage adapter
// forwards calls 1:1 and swallows errors instead of throwing.
const prefsGet    = vi.hoisted(() => vi.fn());
const prefsSet    = vi.hoisted(() => vi.fn());
const prefsRemove = vi.hoisted(() => vi.fn());
vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get:    prefsGet,
    set:    prefsSet,
    remove: prefsRemove,
  },
}));

describe("capacitorAsyncStorage", () => {
  beforeEach(() => {
    prefsGet.mockReset();
    prefsSet.mockReset();
    prefsRemove.mockReset();
  });

  it("getItem forwards the key and unwraps the plugin's {value} shape", async () => {
    prefsGet.mockResolvedValueOnce({ value: "cached-string" });
    await expect(capacitorAsyncStorage.getItem("k")).resolves.toBe("cached-string");
    expect(prefsGet).toHaveBeenCalledWith({ key: "k" });
  });

  it("getItem returns null when the plugin reports a missing key", async () => {
    prefsGet.mockResolvedValueOnce({ value: null });
    await expect(capacitorAsyncStorage.getItem("missing")).resolves.toBeNull();
  });

  it("getItem swallows plugin errors and returns null", async () => {
    prefsGet.mockRejectedValueOnce(new Error("native unavailable"));
    await expect(capacitorAsyncStorage.getItem("k")).resolves.toBeNull();
  });

  it("setItem forwards key + value and never throws", async () => {
    prefsSet.mockResolvedValueOnce(undefined);
    await expect(capacitorAsyncStorage.setItem("k", "v")).resolves.toBeUndefined();
    expect(prefsSet).toHaveBeenCalledWith({ key: "k", value: "v" });
  });

  it("setItem still resolves when the plugin throws", async () => {
    prefsSet.mockRejectedValueOnce(new Error("quota"));
    // Must not propagate the error — persistence is best-effort.
    await expect(capacitorAsyncStorage.setItem("k", "v")).resolves.toBeUndefined();
  });

  it("removeItem forwards the key", async () => {
    prefsRemove.mockResolvedValueOnce(undefined);
    await capacitorAsyncStorage.removeItem("k");
    expect(prefsRemove).toHaveBeenCalledWith({ key: "k" });
  });
});

describe("shouldPersistQuery whitelist", () => {
  it("persists retail profile / tiers / signals / risk-score / rebalance", () => {
    expect(shouldPersistQuery(["markets", "retail", "profile"])).toBe(true);
    expect(shouldPersistQuery(["markets", "retail", "tiers"])).toBe(true);
    expect(shouldPersistQuery(["markets", "retail", "signals", {}])).toBe(true);
    expect(shouldPersistQuery(["markets", "retail", "risk-score"])).toBe(true);
    expect(shouldPersistQuery(["markets", "retail", "rebalance", "pending"])).toBe(true);
    expect(shouldPersistQuery(["markets", "retail", "starter-templates"])).toBe(true);
    expect(shouldPersistQuery(["markets", "retail", "behavioral", "events"])).toBe(true);
    expect(shouldPersistQuery(["markets", "portfolios", "list", {}])).toBe(true);
  });

  it("does NOT persist broker / order / trading paths", () => {
    expect(shouldPersistQuery(["markets", "brokers", "connections"])).toBe(false);
    expect(shouldPersistQuery(["markets", "orders"])).toBe(false);
    expect(shouldPersistQuery(["markets", "retail", "behavioral", "stress"])).toBe(false);
    expect(shouldPersistQuery(["markets", "ltp", "RELIANCE"])).toBe(false);
  });

  it("does NOT persist unrelated CRM / logistics / system queries", () => {
    expect(shouldPersistQuery(["crm", "leads"])).toBe(false);
    expect(shouldPersistQuery(["logistics", "shipments"])).toBe(false);
    expect(shouldPersistQuery(["system", "feature-flags"])).toBe(false);
  });

  it("ignores keys shorter than the prefix", () => {
    expect(shouldPersistQuery(["markets"])).toBe(false);
    expect(shouldPersistQuery([])).toBe(false);
  });
});
