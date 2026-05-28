import { invoke as llmInvoke } from "@platform/llm-client";
import type { ImproverInput, PromptVariant } from "./types.js";
import { BaseImproverAgent } from "./base-agent.js";

/**
 * Anthropic-Workbench-style improver. Uses a meta-prompt (loaded
 * through @platform/llm-prompts via key `core.prompt_improver.workbench`)
 * to ask Claude to propose 1–3 variants from the observability data.
 *
 * Because it calls LLM providers, this agent goes THROUGH
 * @platform/llm-client (the only legal path per master §6.2 +
 * scripts/lint-llm-imports.mjs). It does NOT import provider SDKs
 * directly.
 *
 * Phase 0 scaffold — proposeVariantsRaw() throws because llmInvoke()
 * still throws in Phase 0. Real wiring in Phase 9 (master §7.4).
 */
export class WorkbenchImproverAgent extends BaseImproverAgent {
  constructor(
    private readonly options: {
      tenant_id: string;
      meta_prompt_key?: string;
    },
  ) {
    super();
  }

  protected async proposeVariantsRaw(input: ImproverInput): Promise<PromptVariant[]> {
    const meta_prompt_key = this.options.meta_prompt_key ?? "core.prompt_improver.workbench";

    const response = await llmInvoke<WorkbenchOutput>({
      tenant_id: this.options.tenant_id,
      module: "core",
      feature: "prompt_improver_workbench",
      prompt_key: meta_prompt_key,
      variables: {
        prompt_key: input.prompt_key,
        current_version: input.current_version,
        metrics: input.metrics,
        failure_cases_sample: input.failure_cases.slice(0, 5),
        success_cases_sample: input.success_cases.slice(0, 5),
        constraints: input.constraints,
      },
      subject: { type: "core.llm_prompt", id: input.prompt_key },
    });

    // The meta-prompt returns variants matching the WorkbenchOutput shape.
    return response.output.variants.map((v) => ({
      prompt_key: input.prompt_key,
      version: input.current_version.frontmatter.version + 1,
      body: v.body,
      rationale: v.rationale,
      expected_improvement: v.expected_improvement,
    }));
  }
}

interface WorkbenchOutput {
  variants: Array<{
    body: string;
    rationale: string;
    expected_improvement: string;
  }>;
}
