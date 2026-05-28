import { describe, it, expect } from "vitest";
import {
  NullImproverAgent,
  WorkbenchImproverAgent,
  BaseImproverAgent,
  type ImproverInput,
  type PromptVariant,
} from "./index.js";

const makeInput = (): ImproverInput => ({
  prompt_key: "core.party.dedup_suggestion",
  current_version: {
    frontmatter: {
      key: "core.party.dedup_suggestion",
      version: 3,
      status: "active",
      owner_module: "core",
      default_model: "claude-haiku-4-5",
      expected_inputs: [],
      pii_handling: "redact_emails_phones",
      safety_class: "business_advisory",
    },
    body: "Original prompt body.",
    source_path: "/fake/path.prompt.md",
  },
  historical_invocations: [],
  failure_cases: [],
  success_cases: [],
  metrics: {
    acceptance_rate: 0.65,
    override_rate: 0.2,
    override_distance: 0.3,
    latency_p50_ms: 200,
    latency_p95_ms: 800,
    cost_per_call_usd: 0.001,
    schema_validation_failure_rate: 0.01,
    confidence_calibration: null,
    sample_size: 1000,
  },
  constraints: {
    max_tokens: 600,
    model: "claude-haiku-4-5",
    safety_class: "business_advisory",
  },
});

describe("NullImproverAgent", () => {
  it("returns no variants regardless of input", async () => {
    const agent = new NullImproverAgent();
    const variants = await agent.proposeVariants(makeInput());
    expect(variants).toEqual([]);
  });
});

describe("BaseImproverAgent guardrails", () => {
  // Test the guardrail filter via a concrete subclass.
  class TestAgent extends BaseImproverAgent {
    constructor(private raw: PromptVariant[]) {
      super();
    }
    protected async proposeVariantsRaw(): Promise<PromptVariant[]> {
      return this.raw;
    }
  }

  it("filters out variants that change prompt_key", async () => {
    const agent = new TestAgent([
      {
        prompt_key: "different.key",
        version: 4,
        body: "x".repeat(100),
        rationale: "Tries to change the key — should be filtered",
        expected_improvement: "+5% acceptance",
      },
    ]);
    const out = await agent.proposeVariants(makeInput());
    expect(out).toEqual([]);
  });

  it("filters out variants with version <= current", async () => {
    const agent = new TestAgent([
      {
        prompt_key: "core.party.dedup_suggestion",
        version: 3,  // same as current
        body: "x".repeat(100),
        rationale: "Same version — should be filtered",
        expected_improvement: "+5% acceptance",
      },
      {
        prompt_key: "core.party.dedup_suggestion",
        version: 4,
        body: "valid body",
        rationale: "Strictly newer version — should pass",
        expected_improvement: "+5% acceptance",
      },
    ]);
    const out = await agent.proposeVariants(makeInput());
    expect(out).toHaveLength(1);
    expect(out[0].version).toBe(4);
  });

  it("filters out empty body, short rationale, or short expected_improvement", async () => {
    const agent = new TestAgent([
      { prompt_key: "core.party.dedup_suggestion", version: 4, body: "", rationale: "long enough rationale text", expected_improvement: "long enough" },
      { prompt_key: "core.party.dedup_suggestion", version: 4, body: "ok body", rationale: "short", expected_improvement: "long enough" },
      { prompt_key: "core.party.dedup_suggestion", version: 4, body: "ok body", rationale: "long enough rationale text", expected_improvement: "x" },
      { prompt_key: "core.party.dedup_suggestion", version: 4, body: "ok body", rationale: "long enough rationale text", expected_improvement: "long enough" },
    ]);
    const out = await agent.proposeVariants(makeInput());
    expect(out).toHaveLength(1);
  });
});

describe("WorkbenchImproverAgent", () => {
  it("instantiates with tenant_id options", () => {
    const agent = new WorkbenchImproverAgent({ tenant_id: "t1" });
    expect(agent).toBeInstanceOf(BaseImproverAgent);
  });

  it("proposeVariants() throws because llm-client is not yet wired", async () => {
    const agent = new WorkbenchImproverAgent({ tenant_id: "t1" });
    await expect(agent.proposeVariants(makeInput())).rejects.toThrow(/not yet wired/);
  });
});
