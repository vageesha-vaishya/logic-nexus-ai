import { describe, it, expect, vi, beforeEach } from "vitest";

import { requireOnline } from "./network";

vi.mock("@capacitor/core", () => ({
  Capacitor: { getPlatform: () => "web" },
}));

describe("requireOnline", () => {
  const origOnline = Object.getOwnPropertyDescriptor(window.navigator, "onLine");

  beforeEach(() => {
    // Reset navigator.onLine to true for each test.
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      get: () => true,
    });
  });

  afterAll(() => {
    if (origOnline) {
      Object.defineProperty(window.navigator, "onLine", origOnline);
    }
  });

  it("is a no-op when the device is online", () => {
    expect(() => requireOnline()).not.toThrow();
  });

  it("throws a friendly error when navigator reports offline", () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      get: () => false,
    });
    expect(() => requireOnline()).toThrow(/offline/i);
  });
});

// vitest exports describe/it/expect/vi from "vitest"; afterAll comes from the
// same default export of @vitest/runner — import it explicitly so this file
// stays self-contained even without a global setup file.
import { afterAll } from "vitest";
