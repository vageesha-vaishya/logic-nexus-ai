import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { chooseEndpoint, probeWithRetry } from "../../scripts/server-health.mjs";

describe("server-health", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prefers local when local is reachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: any) => {
        if (String(url).includes("localhost")) return new Response(null, { status: 200 });
        return new Response(null, { status: 503 });
      })
    );

    const result = await chooseEndpoint({
      localUrl: "http://localhost:3000",
      remoteUrl: "https://api.example.com",
      prefer: "local",
      healthPath: "/health",
      attempts: 3,
      delayFn: async () => {},
    } as any);

    expect(result.kind).toBe("local");
    expect(result.url).toBe("http://localhost:3000");
  });

  it("falls back to remote when local is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: any) => {
        if (String(url).includes("localhost")) throw new Error("ECONNREFUSED");
        return new Response(null, { status: 200 });
      })
    );

    const result = await chooseEndpoint({
      localUrl: "http://localhost:3000",
      remoteUrl: "https://api.example.com",
      prefer: "local",
      healthPath: "/health",
      attempts: 3,
      delayFn: async () => {},
    } as any);

    expect(result.kind).toBe("remote");
    expect(result.url).toBe("https://api.example.com");
  });

  it("enforces minimum 3 attempts for retry probes", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("timeout");
    });
    vi.stubGlobal("fetch", fetchMock);

    const delayFn = vi.fn(async () => {});
    const result = await probeWithRetry("http://localhost:9999", {
      healthPath: "/health",
      attempts: 1,
      timeoutMs: 10,
      baseDelayMs: 1,
      maxDelayMs: 1,
      delayFn,
    });

    expect(result.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
