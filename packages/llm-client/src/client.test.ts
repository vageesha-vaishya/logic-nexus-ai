import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  invoke,
  recordOutcome,
  configure,
  LlmClient,
  LlmGatewayError,
  _resetSingletonForTesting,
  NullProviderAdapter,
  NullPromptCache,
  MemoryPromptCache,
  composeCacheKey,
  AllowAllBudgetGuard,
  MemoryBudgetGuard,
  NullPiiRedactor,
  RegexPiiRedactor,
  NullInvocationLogger,
  MemoryInvocationLogger,
  hashVariables,
  summariseInvocation,
} from "./index.js";

// ── Test helpers: build a fake fetch that returns canned responses ──
function buildFakeFetch(
  responder: (url: string, init: RequestInit) => { status: number; body: unknown; headers?: Record<string, string> },
): typeof fetch {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const res = responder(url, init ?? {});
    const headers = new Headers({ "Content-Type": "application/json", ...(res.headers ?? {}) });
    return new Response(JSON.stringify(res.body), { status: res.status, headers });
  });
  return fn as unknown as typeof fetch;
}

describe("LlmClient — invoke() over the gateway", () => {
  beforeEach(() => {
    _resetSingletonForTesting();
  });

  it("posts to /v1/invoke with headers + body and returns the parsed response", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const client = new LlmClient({
      gatewayUrl: "http://gw.local",
      serviceToken: "lngw_test",
      platformId: "logic-nexus-ai",
      fetch: buildFakeFetch((url, init) => {
        calls.push({ url, init });
        return {
          status: 200,
          body: {
            invocation_id: "inv-1",
            output: { text: "ok" },
            cache_hit: false,
            model_used: "echo-v1",
            provider_kind: "echo",
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
            cost_usd: 0,
            latency_ms: 5,
          },
        };
      }),
    });

    const res = await client.invoke({
      tenant_id: "t1",
      module: "core",
      feature: "test",
      prompt_key: "core.test",
      variables: { x: 1 },
    });

    expect(res.invocation_id).toBe("inv-1");
    expect(res.model_used).toBe("echo-v1");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("http://gw.local/v1/invoke");
    const headers = calls[0]!.init.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer lngw_test");
    expect(headers.get("X-Platform-Id")).toBe("logic-nexus-ai");
    expect(headers.get("Content-Type")).toBe("application/json");
    const body = JSON.parse(calls[0]!.init.body as string);
    expect(body.prompt_key).toBe("core.test");
  });

  it("throws LlmGatewayError carrying code + status + request_id on non-2xx", async () => {
    const client = new LlmClient({
      gatewayUrl: "http://gw.local",
      fetch: buildFakeFetch(() => ({
        status: 401,
        body: {
          error: { code: "UNAUTHORIZED", message: "missing token", request_id: "req-42" },
        },
      })),
    });

    let caught: unknown;
    try {
      await client.invoke({
        tenant_id: "t1", module: "core", feature: "f", prompt_key: "core.f", variables: {},
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(LlmGatewayError);
    const e = caught as LlmGatewayError;
    expect(e.code).toBe("UNAUTHORIZED");
    expect(e.status).toBe(401);
    expect(e.request_id).toBe("req-42");
  });

  it("trims trailing slash from gatewayUrl", async () => {
    const calls: string[] = [];
    const client = new LlmClient({
      gatewayUrl: "http://gw.local///",
      fetch: buildFakeFetch((url) => {
        calls.push(url);
        return { status: 200, body: {
          invocation_id: "i", output: null, cache_hit: false, model_used: "m",
          provider_kind: "echo", usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          cost_usd: 0, latency_ms: 1,
        } };
      }),
    });
    await client.invoke({ tenant_id: "t", module: "core", feature: "f", prompt_key: "k", variables: {} });
    expect(calls[0]).toBe("http://gw.local/v1/invoke");
  });
});

describe("SDK parity — embed / fine-tune / tools / attachments", () => {
  beforeEach(() => { _resetSingletonForTesting(); });

  it("embed() POSTs to /v1/embed with the request body", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const client = new LlmClient({
      gatewayUrl: "http://gw.local",
      fetch: buildFakeFetch((url, init) => {
        calls.push({ url, init });
        return {
          status: 200,
          body: {
            invocation_id: "emb-1",
            model_used: "text-embedding-3-small",
            provider_kind: "openai",
            embeddings: [[0.1, 0.2, 0.3]],
            usage: { prompt_tokens: 3, total_tokens: 3 },
            cost_usd: 0,
            latency_ms: 4,
          },
        };
      }),
    });
    const res = await client.embed({ tenant_id: "t1", inputs: ["hi"] });
    expect(res.invocation_id).toBe("emb-1");
    expect(res.embeddings).toEqual([[0.1, 0.2, 0.3]]);
    expect(calls[0]!.url).toBe("http://gw.local/v1/embed");
  });

  it("submitFineTune() POSTs to /v1/fine-tunes and returns the job", async () => {
    const client = new LlmClient({
      gatewayUrl: "http://gw.local",
      fetch: buildFakeFetch(() => ({
        status: 201,
        body: {
          id: "ft-1", tenant_id: "t1", provider_kind: "openai",
          base_model_id: "gpt-4o-mini", status: "queued",
          hyperparameters: {}, result_metrics: {},
          created_at: "2026-06-03T00:00:00Z", updated_at: "2026-06-03T00:00:00Z",
        },
      })),
    });
    const job = await client.submitFineTune({
      tenant_id: "t1", provider_kind: "openai", base_model_id: "gpt-4o-mini",
    });
    expect(job.id).toBe("ft-1");
    expect(job.status).toBe("queued");
  });

  it("getFineTune() GETs /v1/fine-tunes/:id", async () => {
    const calls: string[] = [];
    const client = new LlmClient({
      gatewayUrl: "http://gw.local",
      fetch: buildFakeFetch((url) => {
        calls.push(url);
        return {
          status: 200,
          body: {
            id: "ft-1", tenant_id: "t1", provider_kind: "openai",
            base_model_id: "gpt-4o-mini", status: "training",
            hyperparameters: {}, result_metrics: {},
            created_at: "2026-06-03T00:00:00Z", updated_at: "2026-06-03T00:00:00Z",
          },
        };
      }),
    });
    const job = await client.getFineTune("ft-1");
    expect(job.status).toBe("training");
    expect(calls[0]).toBe("http://gw.local/v1/fine-tunes/ft-1");
  });

  it("cancelFineTune() POSTs to /v1/fine-tunes/:id/cancel with reason", async () => {
    let capturedBody = "";
    const client = new LlmClient({
      gatewayUrl: "http://gw.local",
      fetch: buildFakeFetch((_, init) => {
        capturedBody = init.body as string;
        return {
          status: 200,
          body: {
            id: "ft-1", tenant_id: "t1", provider_kind: "openai",
            base_model_id: "gpt-4o-mini", status: "cancelled",
            hyperparameters: {}, result_metrics: {}, cancel_reason: "budget exceeded",
            created_at: "2026-06-03T00:00:00Z", updated_at: "2026-06-03T00:00:00Z",
          },
        };
      }),
    });
    const job = await client.cancelFineTune("ft-1", "budget exceeded");
    expect(job.status).toBe("cancelled");
    expect(JSON.parse(capturedBody)).toEqual({ reason: "budget exceeded" });
  });

  it("InvokeRequest accepts tools + tool_choice + attachments + tool_calls round-trip", async () => {
    const client = new LlmClient({
      gatewayUrl: "http://gw.local",
      fetch: buildFakeFetch(() => ({
        status: 200,
        body: {
          invocation_id: "inv-1", output: null, cache_hit: false, model_used: "m",
          provider_kind: "echo", usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          cost_usd: 0, latency_ms: 1,
          tool_calls: [{ id: "tc1", name: "fetch_db", args: { q: "x" } }],
        },
      })),
    });
    const res = await client.invoke({
      tenant_id: "t1", module: "compliance", feature: "f", prompt_key: "k", variables: {},
      tools: [{ name: "fetch_db", parameters_schema: { type: "object" } }],
      tool_choice: "auto",
      attachments: [{ kind: "image", mime_type: "image/png", url: "https://x.png" }],
    });
    expect(res.tool_calls).toHaveLength(1);
    expect(res.tool_calls?.[0]?.name).toBe("fetch_db");
  });
});

describe("Module-singleton invoke() / configure()", () => {
  beforeEach(() => _resetSingletonForTesting());

  it("invoke() goes through the configured singleton", async () => {
    configure({
      gatewayUrl: "http://gw.local",
      serviceToken: "tok",
      fetch: buildFakeFetch(() => ({
        status: 200,
        body: {
          invocation_id: "singleton-inv", output: null, cache_hit: false, model_used: "m",
          provider_kind: "echo", usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          cost_usd: 0, latency_ms: 1,
        },
      })),
    });
    const res = await invoke({
      tenant_id: "t", module: "core", feature: "f", prompt_key: "k", variables: {},
    });
    expect(res.invocation_id).toBe("singleton-inv");
  });

  it("recordOutcome() swallows 404 (endpoint not yet implemented gateway-side)", async () => {
    configure({
      gatewayUrl: "http://gw.local",
      fetch: buildFakeFetch(() => ({
        status: 404,
        body: { error: { code: "INVALID_REQUEST", message: "no such route", request_id: "r" } },
      })),
    });
    // Must not throw
    await expect(recordOutcome("inv1", { kind: "ignored" })).resolves.toBeUndefined();
  });

  it("recordOutcome() rethrows non-404/503 errors", async () => {
    configure({
      gatewayUrl: "http://gw.local",
      fetch: buildFakeFetch(() => ({
        status: 500,
        body: { error: { code: "INTERNAL", message: "boom" } },
      })),
    });
    await expect(recordOutcome("inv1", { kind: "ignored" })).rejects.toBeInstanceOf(LlmGatewayError);
  });
});

describe("NullProviderAdapter", () => {
  it("declares it supports any model but always throws on call", async () => {
    const a = new NullProviderAdapter();
    expect(a.name).toBe("null");
    expect(a.supports("claude-haiku-4-5")).toBe(true);
    await expect(a.call({ model: "claude-haiku-4-5", user_prompt: "hi" })).rejects.toThrow();
  });
});

describe("NullPromptCache + MemoryPromptCache", () => {
  it("NullPromptCache always misses", async () => {
    const c = new NullPromptCache();
    await c.set("k", { response: { output: "x", model_used: "m", usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }, cost_usd: 0.001 }, stored_at: "t" }, 60);
    expect(await c.get("k")).toBeNull();
  });

  it("MemoryPromptCache stores and retrieves until TTL expires", async () => {
    const c = new MemoryPromptCache();
    await c.set("k", { response: { output: "x", model_used: "m", usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }, cost_usd: 0.001 }, stored_at: "t" }, 60);
    const hit = await c.get("k");
    expect(hit).not.toBeNull();
    expect(hit?.response.model_used).toBe("m");
  });

  it("MemoryPromptCache misses after TTL", async () => {
    const c = new MemoryPromptCache();
    await c.set("k", { response: { output: "x", model_used: "m", usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }, cost_usd: 0 }, stored_at: "t" }, 0.001);
    await new Promise((r) => setTimeout(r, 5));
    expect(await c.get("k")).toBeNull();
  });

  it("composeCacheKey is deterministic and contains all parts", () => {
    const k = composeCacheKey({
      prompt_key: "core.test",
      prompt_version: 2,
      model: "claude-haiku-4-5",
      tenant_id: "t1",
      normalised_variables_hash: "abc",
    });
    expect(k).toBe("core.test:v2:claude-haiku-4-5:t1:abc");
  });
});

describe("BudgetGuard", () => {
  it("AllowAllBudgetGuard always allows", async () => {
    const g = new AllowAllBudgetGuard();
    const r = await g.check({ tenant_id: "t1", feature: "f1", estimated_cost_usd: 999 });
    expect(r.allow).toBe(true);
  });

  it("MemoryBudgetGuard enforces a cap and accumulates records", async () => {
    const g = new MemoryBudgetGuard(1.0);
    expect((await g.check({ tenant_id: "t1", feature: "f1", estimated_cost_usd: 0.5 })).allow).toBe(true);
    await g.record({ tenant_id: "t1", feature: "f1", actual_cost_usd: 0.6, invocation_id: "i1" });
    const second = await g.check({ tenant_id: "t1", feature: "f1", estimated_cost_usd: 0.5 });
    expect(second.allow).toBe(false);
    if (!second.allow) {
      expect(second.reason).toBe("monthly_budget_exceeded");
    }
    expect(g.recorded).toHaveLength(1);
  });

  it("MemoryBudgetGuard isolates tenants", async () => {
    const g = new MemoryBudgetGuard(1.0);
    await g.record({ tenant_id: "t1", feature: "f1", actual_cost_usd: 0.9, invocation_id: "i1" });
    // t2 unaffected
    expect((await g.check({ tenant_id: "t2", feature: "f1", estimated_cost_usd: 0.9 })).allow).toBe(true);
  });
});

describe("PiiRedactor", () => {
  it("NullPiiRedactor is identity", () => {
    const r = new NullPiiRedactor();
    const out = r.redact("Email me at alice@example.com", "redact_emails_phones");
    expect(out.redacted).toBe("Email me at alice@example.com");
    expect(out.placeholders).toEqual({});
  });

  it("RegexPiiRedactor redacts emails and round-trips via restore", () => {
    const r = new RegexPiiRedactor();
    const result = r.redact(
      "Hi, contact alice@example.com or bob.smith@company.io for details",
      "redact_emails_phones",
    );
    expect(result.redacted).not.toContain("alice@example.com");
    expect(result.redacted).toContain("<EMAIL_1>");
    expect(result.redacted).toContain("<EMAIL_2>");
    expect(result.counts.email).toBe(2);
    const restored = r.restore(result.redacted, result.placeholders);
    expect(restored).toBe("Hi, contact alice@example.com or bob.smith@company.io for details");
  });

  it("RegexPiiRedactor redacts E.164 phone numbers", () => {
    const r = new RegexPiiRedactor();
    const result = r.redact("Call me at +1 555 123 4567 today", "redact_emails_phones");
    expect(result.redacted).not.toContain("+1 555");
    expect(result.redacted).toContain("<PHONE_1>");
    expect(result.counts.phone).toBe(1);
  });

  it("pass_through mode does nothing even with PII present", () => {
    const r = new RegexPiiRedactor();
    const result = r.redact("alice@example.com", "pass_through");
    expect(result.redacted).toBe("alice@example.com");
    expect(result.counts).toEqual({});
  });
});

describe("InvocationLogger", () => {
  it("NullInvocationLogger silently discards", async () => {
    const l = new NullInvocationLogger();
    await expect(l.write({} as never)).resolves.toBeUndefined();
  });

  it("MemoryInvocationLogger captures rows", async () => {
    const l = new MemoryInvocationLogger();
    await l.write({
      invocation_id: "i1",
      tenant_id: "t1",
      occurred_at: "2026-05-28T00:00:00.000Z",
      module: "core",
      feature: "f1",
      prompt_key: "core.test",
      prompt_version: 1,
      variables: {},
      resolved_prompt: "p",
      model_used: "claude-haiku-4-5",
      cache_hit: false,
      cost_usd: 0.001,
      latency_ms: 42,
    });
    expect(l.invocations).toHaveLength(1);
    expect(l.invocations[0].invocation_id).toBe("i1");

    await l.writeOutcome({
      invocation_id: "i1",
      outcome: { kind: "accepted", user_id: "u1" },
      recorded_at: "2026-05-28T00:01:00.000Z",
    });
    expect(l.outcomes).toHaveLength(1);
  });
});

describe("hashVariables", () => {
  it("is stable across key insertion order", () => {
    const a = hashVariables({ b: 2, a: 1 });
    const b = hashVariables({ a: 1, b: 2 });
    expect(a).toBe(b);
  });
  it("differs for different content", () => {
    expect(hashVariables({ x: 1 })).not.toBe(hashVariables({ x: 2 }));
  });
});

describe("summariseInvocation", () => {
  it("flattens request + response into a single InvocationLog row", () => {
    const log = summariseInvocation(
      {
        tenant_id: "t1",
        module: "sales",
        feature: "lead_scoring",
        prompt_key: "sales.lead.score",
        variables: { foo: "bar" },
        subject: { type: "sales.lead", id: "lead-1" },
      },
      {
        invocation_id: "i1",
        output: { score: 80 },
        cache_hit: false,
        model_used: "claude-haiku-4-5",
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        cost_usd: 0.0005,
        latency_ms: 200,
      },
      { prompt_version: 3, resolved_prompt: "prompt body", occurred_at: "2026-05-28T00:00:00Z" },
    );
    expect(log.tenant_id).toBe("t1");
    expect(log.subject_type).toBe("sales.lead");
    expect(log.subject_id).toBe("lead-1");
    expect(log.total_tokens).toBe(150);
  });
});
