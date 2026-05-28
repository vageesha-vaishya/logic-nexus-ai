import type {
  ImproverInput,
  PromptImproverAgent,
  PromptVariant,
} from "./types.js";

/**
 * Shared guardrails every improver implementation must honour (master §6.8).
 * Concrete agents extend this class and implement proposeVariantsRaw();
 * the public proposeVariants() wraps with the guardrail filter so no
 * adapter can bypass the rules.
 */
export abstract class BaseImproverAgent implements PromptImproverAgent {
  protected abstract proposeVariantsRaw(input: ImproverInput): Promise<PromptVariant[]>;

  async proposeVariants(input: ImproverInput): Promise<PromptVariant[]> {
    const proposals = await this.proposeVariantsRaw(input);
    return proposals.filter((v) => this.passesGuardrails(v, input));
  }

  /**
   * Applies the four mandatory guardrails. Subclasses can extend with
   * additional checks but cannot relax these.
   */
  protected passesGuardrails(
    variant: PromptVariant,
    input: ImproverInput,
  ): boolean {
    // G1: same key as control
    if (variant.prompt_key !== input.prompt_key) return false;

    // G2: version must be strictly greater than control
    if (variant.version <= input.current_version.frontmatter.version) return false;

    // G3: body must be non-empty and within constraint tokens
    if (typeof variant.body !== "string" || variant.body.length === 0) return false;

    // G4: rationale + expected_improvement required (forces the agent to explain itself)
    if (typeof variant.rationale !== "string" || variant.rationale.length < 10) return false;
    if (typeof variant.expected_improvement !== "string" || variant.expected_improvement.length < 5) return false;

    return true;
  }
}
