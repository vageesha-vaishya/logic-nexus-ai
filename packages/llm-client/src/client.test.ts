import { describe, it, expect } from "vitest";
import {
  invoke,
  recordOutcome,
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

describe("invoke() / recordOutcome() — Phase 0 stubs", () => {
  it("invoke() throws with a helpful message", async () => {
    await expect(
      invoke({
        tenant_id: "t1",
        module: "core",
        feature: "test",
        prompt_key: "core.test",
        variables: {},
      }),
    ).rejects.toThrow(/not yet wired/);
  });

  it("recordOutcome() throws with the same message", async () => {
    await expect(recordOutcome("inv1", { kind: "ignored" })).rejects.toThrow(/not yet wired/);
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
