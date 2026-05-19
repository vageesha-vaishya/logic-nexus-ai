import { describe, it, expect, vi, beforeEach } from "vitest";

import { registerForPush } from "./push";

const mockPlatform = vi.hoisted(() => ({ value: "web" as "web" | "android" | "ios" }));
vi.mock("@capacitor/core", () => ({
  Capacitor: { getPlatform: () => mockPlatform.value },
}));

// We never call the worker on web — but if a test ever did, this mock
// gives us a controllable target instead of a real fetch.
const fetchMock = vi.hoisted(() => vi.fn());

describe("registerForPush — web platform", () => {
  beforeEach(() => {
    mockPlatform.value = "web";
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("short-circuits with reason='web' and never touches the plugin or fetch", async () => {
    const out = await registerForPush();
    expect(out).toEqual({ ok: false, reason: "web" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
