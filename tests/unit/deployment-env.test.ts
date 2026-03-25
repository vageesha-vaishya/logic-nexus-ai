import { describe, it, expect, vi, afterEach } from "vitest";
import { determineDeploymentContext, rewriteUrlPreservePort } from "../../scripts/deployment-env.mjs";

describe("deployment-env", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("forces local when DEPLOYMENT_TYPE=local", async () => {
    const ctx = await determineDeploymentContext({
      env: { DEPLOYMENT_TYPE: "local" } as any,
      logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } as any,
    });
    expect(ctx.type).toBe("local");
    expect(ctx.host).toBe("localhost");
  });

  it("uses SERVER_HOST as remote when provided", async () => {
    const ctx = await determineDeploymentContext({
      env: { SERVER_HOST: "api.example.com" } as any,
      logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } as any,
    });
    expect(ctx.type).toBe("remote");
    expect(ctx.host).toBe("api.example.com");
  });

  it("detects remote when a public IPv4 exists", async () => {
    const ctx = await determineDeploymentContext({
      env: {} as any,
      logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } as any,
      metadataDetector: async () => ({ provider: null, host: "" }),
      networkInterfacesFn: () =>
        ({
          en0: [{ family: "IPv4", internal: false, address: "8.8.8.8" }],
        }) as any,
    } as any);
    expect(ctx.type).toBe("remote");
    expect(ctx.host).toBe("8.8.8.8");
  });

  it("defaults to local for NODE_ENV=development when unresolved", async () => {
    const ctx = await determineDeploymentContext({
      env: { NODE_ENV: "development" } as any,
      logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } as any,
      metadataDetector: async () => ({ provider: null, host: "" }),
      networkInterfacesFn: () => ({}) as any,
    } as any);
    expect(ctx.type).toBe("local");
    expect(ctx.host).toBe("localhost");
  });

  it("preserves port while swapping hostname", () => {
    const out = rewriteUrlPreservePort("http://localhost:3001", { host: "api.example.com" } as any);
    expect(out).toBe("https://api.example.com:3001");
  });
});
