import type {
  ImproverInput,
  PromptImproverAgent,
  PromptVariant,
} from "./types.js";

/**
 * Default Phase 0 implementation: collects data, proposes nothing.
 * Activates the observability loop without making changes — safe to run anywhere.
 */
export class NullImproverAgent implements PromptImproverAgent {
  async proposeVariants(input: ImproverInput): Promise<PromptVariant[]> {
    void input;
    return [];
  }
}
